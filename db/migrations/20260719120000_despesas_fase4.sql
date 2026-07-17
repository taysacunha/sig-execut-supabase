-- =====================================================================
-- Fase 4 — Módulo Despesas: recorrências, notificações, duplicidade
--                          e auditoria estendida.
--
-- Ordem por tabela: CREATE → GRANT → ENABLE RLS → POLICIES.
-- Depois: colunas novas em despesas_lancamentos, funções auxiliares,
-- triggers e extensão do CASE de audit_module_changes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) despesas_recorrencias  (template da série)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_recorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo boolean NOT NULL DEFAULT true,
  tipo text NOT NULL CHECK (tipo IN ('mensal','anual','fixa_meses','intercalada')),
  data_inicio date NOT NULL,
  data_fim date,
  dia_vencimento smallint NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  meses_fixos smallint[] NOT NULL DEFAULT '{}',
  janela_geracao_meses smallint NOT NULL DEFAULT 12 CHECK (janela_geracao_meses BETWEEN 1 AND 36),
  ultima_geracao_ate date,

  -- Template do lançamento
  lanc_tipo text NOT NULL CHECK (lanc_tipo IN ('a_pagar','a_receber')),
  descricao text NOT NULL,
  valor_total numeric(14,2) NOT NULL CHECK (valor_total >= 0),
  centro_custo_id uuid NOT NULL REFERENCES public.despesas_centros_custo(id) ON DELETE RESTRICT,
  categoria_id uuid REFERENCES public.despesas_categorias(id) ON DELETE SET NULL,
  plano_conta_id uuid REFERENCES public.despesas_planos_conta(id) ON DELETE SET NULL,
  subcategoria_id uuid REFERENCES public.despesas_subcategorias(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.despesas_contas_bancarias(id) ON DELETE SET NULL,
  pessoa_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  observacao text,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_rec_ativo ON public.despesas_recorrencias(ativo);
CREATE INDEX IF NOT EXISTS idx_desp_rec_centro ON public.despesas_recorrencias(centro_custo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_recorrencias TO authenticated;
GRANT ALL ON public.despesas_recorrencias TO service_role;

ALTER TABLE public.despesas_recorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_rec_select" ON public.despesas_recorrencias
  FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(),'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_rec_insert" ON public.despesas_recorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(),'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_rec_update" ON public.despesas_recorrencias
  FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(),'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(),'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_rec_delete" ON public.despesas_recorrencias
  FOR DELETE TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(),'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 2) Extensão de despesas_lancamentos
-- ---------------------------------------------------------------------
ALTER TABLE public.despesas_lancamentos
  ADD COLUMN IF NOT EXISTS serie_recorrencia_id uuid
    REFERENCES public.despesas_recorrencias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_desp_lanc_serie ON public.despesas_lancamentos(serie_recorrencia_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_lanc_serie_venc
  ON public.despesas_lancamentos(serie_recorrencia_id, data_vencimento)
  WHERE serie_recorrencia_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3) despesas_notificacoes_preferencias
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_notificacoes_preferencias (
  user_id uuid PRIMARY KEY,
  dias_antecedencia smallint[] NOT NULL DEFAULT '{7,1}',
  notificar_vencidos boolean NOT NULL DEFAULT true,
  notificar_pagos boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_notificacoes_preferencias TO authenticated;
GRANT ALL ON public.despesas_notificacoes_preferencias TO service_role;

ALTER TABLE public.despesas_notificacoes_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_notif_pref_own" ON public.despesas_notificacoes_preferencias
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4) despesas_notificacoes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lancamento_id uuid NOT NULL REFERENCES public.despesas_lancamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('proximidade','vencido','pago','cancelado')),
  dias_para_vencer smallint,
  mensagem text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_notif_user_lida ON public.despesas_notificacoes(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_desp_notif_lanc ON public.despesas_notificacoes(lancamento_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_notif_dedup
  ON public.despesas_notificacoes(user_id, lancamento_id, tipo, COALESCE(dias_para_vencer, -1));

GRANT SELECT, UPDATE ON public.despesas_notificacoes TO authenticated;
GRANT ALL ON public.despesas_notificacoes TO service_role;

ALTER TABLE public.despesas_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_notif_select_own" ON public.despesas_notificacoes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "desp_notif_update_own" ON public.despesas_notificacoes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- INSERTs feitos via service_role (edge function); nenhuma policy authenticated.

-- ---------------------------------------------------------------------
-- 5) Função: gerar próximas ocorrências de uma série
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_gerar_ocorrencias(
  _serie uuid,
  _ate date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r         public.despesas_recorrencias%ROWTYPE;
  cursor_dt date;
  limite_dt date;
  criados   integer := 0;
  mes       smallint;
BEGIN
  SELECT * INTO r FROM public.despesas_recorrencias WHERE id = _serie;
  IF NOT FOUND OR NOT r.ativo THEN RETURN 0; END IF;

  limite_dt := LEAST(
    COALESCE(_ate, (now() + (r.janela_geracao_meses || ' months')::interval)::date),
    COALESCE(r.data_fim, DATE '9999-01-01')
  );

  -- Ponto de partida: dia_vencimento do mês inicial (ou próximo cursor)
  cursor_dt := COALESCE(
    r.ultima_geracao_ate,
    make_date(EXTRACT(YEAR FROM r.data_inicio)::int,
              EXTRACT(MONTH FROM r.data_inicio)::int, 1) - INTERVAL '1 day'
  )::date;

  -- Anda mês a mês
  LOOP
    cursor_dt := (date_trunc('month', cursor_dt + INTERVAL '1 month'))::date;
    IF cursor_dt > limite_dt THEN EXIT; END IF;
    mes := EXTRACT(MONTH FROM cursor_dt)::smallint;

    -- Filtro por tipo
    IF r.tipo IN ('fixa_meses','intercalada') AND NOT (mes = ANY(r.meses_fixos)) THEN
      CONTINUE;
    END IF;
    IF r.tipo = 'anual' AND mes <> EXTRACT(MONTH FROM r.data_inicio)::smallint THEN
      CONTINUE;
    END IF;

    DECLARE
      venc date := make_date(
        EXTRACT(YEAR FROM cursor_dt)::int,
        EXTRACT(MONTH FROM cursor_dt)::int,
        LEAST(r.dia_vencimento,
              EXTRACT(DAY FROM (date_trunc('month', cursor_dt) + INTERVAL '1 month - 1 day'))::int)
      );
    BEGIN
      IF venc < r.data_inicio OR venc > limite_dt THEN CONTINUE; END IF;

      INSERT INTO public.despesas_lancamentos (
        tipo, descricao, pessoa_id, centro_custo_id, categoria_id,
        plano_conta_id, subcategoria_id, conta_bancaria_id,
        data_competencia, data_vencimento, valor_total, status,
        observacao, serie_recorrencia_id, is_manual, created_by
      ) VALUES (
        r.lanc_tipo, r.descricao, r.pessoa_id, r.centro_custo_id, r.categoria_id,
        r.plano_conta_id, r.subcategoria_id, r.conta_bancaria_id,
        venc, venc, r.valor_total, 'a_vencer',
        r.observacao, r.id, false, r.created_by
      )
      ON CONFLICT (serie_recorrencia_id, data_vencimento) DO NOTHING;

      IF FOUND THEN criados := criados + 1; END IF;
    END;
  END LOOP;

  UPDATE public.despesas_recorrencias
     SET ultima_geracao_ate = limite_dt, updated_at = now()
   WHERE id = r.id;

  RETURN criados;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_gerar_ocorrencias(uuid, date) TO authenticated, service_role;

-- Trigger: ao criar uma série, gera as ocorrências iniciais.
CREATE OR REPLACE FUNCTION public.despesas_recorrencia_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.despesas_gerar_ocorrencias(NEW.id, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_rec_after_insert ON public.despesas_recorrencias;
CREATE TRIGGER trg_desp_rec_after_insert
  AFTER INSERT ON public.despesas_recorrencias
  FOR EACH ROW EXECUTE FUNCTION public.despesas_recorrencia_after_insert();

-- ---------------------------------------------------------------------
-- 6) Função: marcar lançamentos vencidos e cancelar série se aplicável
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_marcar_vencidos()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.despesas_lancamentos
     SET status = 'vencido'
   WHERE status = 'a_vencer' AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_marcar_vencidos() TO service_role;

-- ---------------------------------------------------------------------
-- 7) Função: detectar duplicidades para um lançamento em edição/criação
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_detectar_duplicidades(
  _valor numeric,
  _data_venc date,
  _centro_custo_id uuid,
  _pessoa_id uuid,
  _plano_conta_id uuid,
  _conta_bancaria_id uuid,
  _ignorar_id uuid DEFAULT NULL,
  _janela_dias integer DEFAULT 3
) RETURNS TABLE (
  id uuid,
  descricao text,
  valor_total numeric,
  data_vencimento date,
  status text,
  pessoa_nome text,
  centro_nome text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT l.id, l.descricao, l.valor_total, l.data_vencimento, l.status,
         p.nome, c.nome
    FROM public.despesas_lancamentos l
    LEFT JOIN public.despesas_pessoas p ON p.id = l.pessoa_id
    LEFT JOIN public.despesas_centros_custo c ON c.id = l.centro_custo_id
   WHERE l.status <> 'cancelado'
     AND (l.id IS DISTINCT FROM _ignorar_id)
     AND l.centro_custo_id = _centro_custo_id
     AND ABS(l.valor_total - _valor) < 0.01
     AND l.data_vencimento BETWEEN (_data_venc - _janela_dias) AND (_data_venc + _janela_dias)
     AND (_pessoa_id IS NULL OR l.pessoa_id = _pessoa_id OR l.pessoa_id IS NULL)
     AND (_plano_conta_id IS NULL OR l.plano_conta_id = _plano_conta_id OR l.plano_conta_id IS NULL)
     AND (_conta_bancaria_id IS NULL OR l.conta_bancaria_id = _conta_bancaria_id OR l.conta_bancaria_id IS NULL)
   ORDER BY l.data_vencimento
   LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_detectar_duplicidades(
  numeric, date, uuid, uuid, uuid, uuid, uuid, integer
) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8) Marcar ocorrência como manual quando editada individualmente
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_lanc_marcar_manual()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.serie_recorrencia_id IS NOT NULL
     AND NEW.is_manual = false
     AND (
       NEW.data_vencimento <> OLD.data_vencimento
       OR NEW.valor_total <> OLD.valor_total
       OR NEW.descricao <> OLD.descricao
       OR COALESCE(NEW.status,'') <> COALESCE(OLD.status,'')
     ) THEN
    NEW.is_manual := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_lanc_marcar_manual ON public.despesas_lancamentos;
CREATE TRIGGER trg_desp_lanc_marcar_manual
  BEFORE UPDATE ON public.despesas_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.despesas_lanc_marcar_manual();

-- ---------------------------------------------------------------------
-- 9) updated_at nas novas tabelas
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'despesas_recorrencias',
    'despesas_notificacoes_preferencias'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 10) Estender audit_module_changes para novas tabelas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_module_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    WHEN 'estoque_locais_armazenamento', 'estoque_materiais', 'estoque_saldos',
         'estoque_gestores', 'estoque_solicitacoes', 'estoque_solicitacao_itens',
         'estoque_movimentacoes', 'estoque_notificacoes' THEN
      v_module_name := 'estoque';
    WHEN 'despesas_lancamentos', 'despesas_lancamento_pagamentos',
         'despesas_categorias', 'despesas_centros_custo', 'despesas_contas_bancarias',
         'despesas_perfis_acesso', 'despesas_pessoas', 'despesas_planos_conta',
         'despesas_subcategorias', 'despesas_veiculos',
         'despesas_aba_permissoes', 'despesas_centros_custo_permissoes',
         'despesas_recorrencias', 'despesas_notificacoes_preferencias' THEN
      v_module_name := 'despesas';
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
    v_new_data := to_jsonb(NEW);
    v_changed_fields := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    SELECT ARRAY_AGG(changes.key) INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    ) AS changes;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
  END IF;

  IF TG_OP != 'UPDATE' OR v_changed_fields IS NOT NULL THEN
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

-- Trigger de auditoria para as novas tabelas
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'despesas_recorrencias',
    'despesas_notificacoes_preferencias'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes()',
      t, t
    );
  END LOOP;
END $$;