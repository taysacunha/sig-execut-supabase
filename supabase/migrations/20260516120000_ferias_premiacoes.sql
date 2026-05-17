-- ============================================================================
-- Tabela ferias_premiacoes: lançamento da premiação (1/3) por período de gozo
-- de cada férias, com 4 cenários de cálculo (não vende / vende 5 / 10 / 15).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ferias_premiacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferias_id uuid NOT NULL REFERENCES public.ferias_ferias(id) ON DELETE CASCADE,
  periodo integer NOT NULL CHECK (periodo IN (1, 2)),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias_gozados integer NOT NULL CHECK (dias_gozados IN (0, 5, 10, 15)),
  dias_vendidos integer NOT NULL DEFAULT 0 CHECK (dias_vendidos IN (0, 5, 10, 15)),
  valor_premiacao numeric(12,2) NOT NULL CHECK (valor_premiacao >= 0),
  data_recebimento date NOT NULL,
  observacao text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ferias_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_ferias_premiacoes_ferias_id
  ON public.ferias_premiacoes(ferias_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_ferias_premiacoes_updated_at ON public.ferias_premiacoes;
CREATE TRIGGER trg_ferias_premiacoes_updated_at
  BEFORE UPDATE ON public.ferias_premiacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ===== Regras de ordem (1º antes do 2º) =====
CREATE OR REPLACE FUNCTION public.ferias_premiacoes_check_ordem()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.periodo = 2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ferias_premiacoes
      WHERE ferias_id = NEW.ferias_id AND periodo = 1
        AND (TG_OP = 'INSERT' OR id <> NEW.id)
    ) THEN
      RAISE EXCEPTION 'Não é possível lançar a premiação do 2º período sem antes ter lançado o 1º período.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.periodo = 1 THEN
    IF EXISTS (
      SELECT 1 FROM public.ferias_premiacoes
      WHERE ferias_id = OLD.ferias_id AND periodo = 2
    ) THEN
      RAISE EXCEPTION 'Não é possível apagar a premiação do 1º período enquanto existir lançamento do 2º período.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_ferias_premiacoes_ordem_iu ON public.ferias_premiacoes;
CREATE TRIGGER trg_ferias_premiacoes_ordem_iu
  BEFORE INSERT OR UPDATE ON public.ferias_premiacoes
  FOR EACH ROW EXECUTE FUNCTION public.ferias_premiacoes_check_ordem();

DROP TRIGGER IF EXISTS trg_ferias_premiacoes_ordem_d ON public.ferias_premiacoes;
CREATE TRIGGER trg_ferias_premiacoes_ordem_d
  BEFORE DELETE ON public.ferias_premiacoes
  FOR EACH ROW EXECUTE FUNCTION public.ferias_premiacoes_check_ordem();

-- ===== RLS =====
ALTER TABLE public.ferias_premiacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_premiacoes_select" ON public.ferias_premiacoes;
CREATE POLICY "ferias_premiacoes_select" ON public.ferias_premiacoes
  FOR SELECT TO authenticated
  USING (can_view_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "ferias_premiacoes_insert" ON public.ferias_premiacoes;
CREATE POLICY "ferias_premiacoes_insert" ON public.ferias_premiacoes
  FOR INSERT TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "ferias_premiacoes_update" ON public.ferias_premiacoes;
CREATE POLICY "ferias_premiacoes_update" ON public.ferias_premiacoes
  FOR UPDATE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'))
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "ferias_premiacoes_delete" ON public.ferias_premiacoes;
CREATE POLICY "ferias_premiacoes_delete" ON public.ferias_premiacoes
  FOR DELETE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'));

-- ===== Auditoria: incluir nova tabela na função e anexar trigger =====
CREATE OR REPLACE FUNCTION public.audit_module_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module_name text;
  v_old_data jsonb;
  v_new_data jsonb;
  v_changed_fields text[];
  v_user_id uuid;
  v_user_email text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'brokers', 'locations', 'schedule_assignments', 'generated_schedules',
         'location_period_configs', 'saturday_queue', 'location_rotation_queues' THEN
      v_module_name := 'escalas';
    WHEN 'sales', 'sales_brokers', 'sales_teams', 'broker_evaluations',
         'monthly_leads', 'proposals', 'sale_partners' THEN
      v_module_name := 'vendas';
    WHEN 'estoque_materiais', 'estoque_locais_armazenamento', 'estoque_saldos',
         'estoque_gestores', 'estoque_solicitacoes', 'estoque_solicitacao_itens',
         'estoque_movimentacoes', 'estoque_notificacoes', 'estoque_usuarios_unidades',
         'estoque_categorias' THEN
      v_module_name := 'estoque';
    WHEN 'ferias_colaboradores', 'ferias_ferias', 'ferias_folgas', 'ferias_folgas_escala',
         'ferias_folgas_creditos', 'ferias_folgas_perdas', 'ferias_afastamentos',
         'ferias_setores', 'ferias_equipes', 'ferias_cargos', 'ferias_unidades',
         'ferias_feriados', 'ferias_formulario_anual', 'ferias_gozo_periodos',
         'ferias_periodos_quitados', 'ferias_configuracoes', 'ferias_setor_chefes',
         'ferias_colaborador_setores_substitutos', 'ferias_conflitos', 'ferias_quinzenas',
         'ferias_premiacoes' THEN
      v_module_name := 'ferias';
    ELSE
      v_module_name := 'sistema';
  END CASE;

  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NULL THEN
    BEGIN
      v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  v_user_email := COALESCE(v_user_email, 'sistema@interno');

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
    v_changed_fields := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    SELECT ARRAY_AGG(changes.key) INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    ) AS changes;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
  END IF;

  IF TG_OP <> 'UPDATE' OR v_changed_fields IS NOT NULL THEN
    INSERT INTO public.module_audit_logs (
      module_name, table_name, record_id, action,
      old_data, new_data, changed_fields, changed_by, changed_by_email
    ) VALUES (
      v_module_name, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
      v_old_data, v_new_data, v_changed_fields, v_user_id, v_user_email
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

DROP TRIGGER IF EXISTS audit_ferias_premiacoes_changes ON public.ferias_premiacoes;
CREATE TRIGGER audit_ferias_premiacoes_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_premiacoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();
