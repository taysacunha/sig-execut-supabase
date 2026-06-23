-- =============================================
-- MÓDULO ESTOQUE - GESTÃO DE PLACAS
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS public.estoque_placas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  material_id uuid REFERENCES public.estoque_materiais(id) ON DELETE RESTRICT NOT NULL,
  tipo_uso text NOT NULL CHECK (tipo_uso IN ('venda','aluga')),
  tamanho text NOT NULL CHECK (tamanho IN ('1x1','2x2','outro')),
  tamanho_outro text,
  local_armazenamento_id uuid REFERENCES public.estoque_locais_armazenamento(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','instalada','roubada','perdida','baixada')),
  imovel_codigo_atual text,
  data_instalacao_atual date,
  observacoes text,
  substitui_placa_id uuid REFERENCES public.estoque_placas(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo, versao)
);

CREATE UNIQUE INDEX IF NOT EXISTS estoque_placas_codigo_ativo_unico
  ON public.estoque_placas (codigo)
  WHERE status IN ('disponivel','instalada');

CREATE INDEX IF NOT EXISTS idx_estoque_placas_status ON public.estoque_placas(status);
CREATE INDEX IF NOT EXISTS idx_estoque_placas_codigo ON public.estoque_placas(codigo);
CREATE INDEX IF NOT EXISTS idx_estoque_placas_local  ON public.estoque_placas(local_armazenamento_id);

CREATE TABLE IF NOT EXISTS public.estoque_placas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa_id uuid REFERENCES public.estoque_placas(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('criacao','reposicao','instalacao','retirada','roubo','perda','baixa')),
  imovel_codigo text,
  data_evento date NOT NULL DEFAULT CURRENT_DATE,
  data_retorno date,
  observacoes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_placas_historico_placa ON public.estoque_placas_historico(placa_id);
CREATE INDEX IF NOT EXISTS idx_placas_historico_tipo  ON public.estoque_placas_historico(tipo);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_placas TO authenticated;
GRANT ALL ON public.estoque_placas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_placas_historico TO authenticated;
GRANT ALL ON public.estoque_placas_historico TO service_role;

-- RLS
ALTER TABLE public.estoque_placas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_placas_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "placas_select"            ON public.estoque_placas;
DROP POLICY IF EXISTS "placas_insert_admin"      ON public.estoque_placas;
DROP POLICY IF EXISTS "placas_update_any_editor" ON public.estoque_placas;
DROP POLICY IF EXISTS "placas_delete_admin"      ON public.estoque_placas;
DROP POLICY IF EXISTS "placas_hist_select"       ON public.estoque_placas_historico;
DROP POLICY IF EXISTS "placas_hist_insert"       ON public.estoque_placas_historico;
DROP POLICY IF EXISTS "placas_hist_delete_admin" ON public.estoque_placas_historico;

CREATE POLICY "placas_select" ON public.estoque_placas
  FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'estoque'));

CREATE POLICY "placas_insert_admin" ON public.estoque_placas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );

CREATE POLICY "placas_update_any_editor" ON public.estoque_placas
  FOR UPDATE TO authenticated
  USING (public.has_system_access(auth.uid(), 'estoque'))
  WITH CHECK (public.has_system_access(auth.uid(), 'estoque'));

CREATE POLICY "placas_delete_admin" ON public.estoque_placas
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );

CREATE POLICY "placas_hist_select" ON public.estoque_placas_historico
  FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'estoque'));

CREATE POLICY "placas_hist_insert" ON public.estoque_placas_historico
  FOR INSERT TO authenticated
  WITH CHECK (public.has_system_access(auth.uid(), 'estoque'));

CREATE POLICY "placas_hist_delete_admin" ON public.estoque_placas_historico
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- updated_at
DROP TRIGGER IF EXISTS set_updated_at_estoque_placas ON public.estoque_placas;
CREATE TRIGGER set_updated_at_estoque_placas
  BEFORE UPDATE ON public.estoque_placas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auditoria: incluir novas tabelas
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
         'estoque_categorias', 'estoque_placas', 'estoque_placas_historico' THEN
      v_module_name := 'estoque';
    WHEN 'ferias_colaboradores', 'ferias_ferias', 'ferias_folgas', 'ferias_folgas_escala',
         'ferias_folgas_creditos', 'ferias_folgas_perdas', 'ferias_afastamentos',
         'ferias_setores', 'ferias_equipes', 'ferias_cargos', 'ferias_unidades',
         'ferias_feriados', 'ferias_formulario_anual', 'ferias_gozo_periodos',
         'ferias_periodos_quitados', 'ferias_configuracoes', 'ferias_setor_chefes',
         'ferias_colaborador_setores_substitutos', 'ferias_conflitos', 'ferias_quinzenas' THEN
      v_module_name := 'ferias';
    ELSE
      v_module_name := 'sistema';
  END CASE;

  BEGIN v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;
  IF v_user_id IS NULL THEN
    BEGIN v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;
  END IF;
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;
  v_user_email := COALESCE(v_user_email, 'sistema@interno');

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW); v_old_data := NULL;
    v_changed_fields := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW);
    SELECT ARRAY_AGG(changes.key) INTO v_changed_fields FROM (
      SELECT key FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
        AND key NOT IN ('id','created_at','updated_at','created_by')
    ) AS changes;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD); v_new_data := NULL; v_changed_fields := NULL;
  END IF;

  IF TG_OP <> 'UPDATE'
     OR (v_changed_fields IS NOT NULL AND array_length(v_changed_fields,1) > 0) THEN
    INSERT INTO public.module_audit_logs (
      module_name, table_name, record_id, action,
      old_data, new_data, changed_fields, changed_by, changed_by_email
    ) VALUES (
      v_module_name, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
      v_old_data, v_new_data, v_changed_fields, v_user_id, v_user_email
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS audit_estoque_placas ON public.estoque_placas;
CREATE TRIGGER audit_estoque_placas
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_placas
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_placas_historico ON public.estoque_placas_historico;
CREATE TRIGGER audit_estoque_placas_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_placas_historico
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

-- Saldo automático do material "Placa"
CREATE OR REPLACE FUNCTION public.recalcular_saldo_placas(_material_id uuid, _local_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_qtd integer;
BEGIN
  IF _material_id IS NULL OR _local_id IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO v_qtd FROM public.estoque_placas
   WHERE material_id = _material_id
     AND local_armazenamento_id = _local_id
     AND status = 'disponivel';
  IF v_qtd = 0 THEN
    DELETE FROM public.estoque_saldos
     WHERE material_id = _material_id AND local_armazenamento_id = _local_id;
  ELSE
    INSERT INTO public.estoque_saldos (material_id, local_armazenamento_id, quantidade)
    VALUES (_material_id, _local_id, v_qtd)
    ON CONFLICT (material_id, local_armazenamento_id)
    DO UPDATE SET quantidade = EXCLUDED.quantidade, updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalcular_saldo_placas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalcular_saldo_placas(NEW.material_id, NEW.local_armazenamento_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalcular_saldo_placas(OLD.material_id, OLD.local_armazenamento_id);
    IF NEW.material_id IS DISTINCT FROM OLD.material_id
       OR NEW.local_armazenamento_id IS DISTINCT FROM OLD.local_armazenamento_id THEN
      PERFORM public.recalcular_saldo_placas(NEW.material_id, NEW.local_armazenamento_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_saldo_placas(OLD.material_id, OLD.local_armazenamento_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recalc_saldo_placas ON public.estoque_placas;
CREATE TRIGGER recalc_saldo_placas
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_placas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalcular_saldo_placas();

-- Backfill inicial
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT material_id, local_armazenamento_id
           FROM public.estoque_placas WHERE local_armazenamento_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_saldo_placas(r.material_id, r.local_armazenamento_id);
  END LOOP;
END $$;

-- estoque_saldos precisa de UNIQUE para o ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'estoque_saldos' AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(material_id, local_armazenamento_id)%'
  ) THEN
    ALTER TABLE public.estoque_saldos
      ADD CONSTRAINT estoque_saldos_material_local_unq UNIQUE (material_id, local_armazenamento_id);
  END IF;
END $$;
