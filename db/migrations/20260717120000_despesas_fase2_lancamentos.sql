-- =====================================================================
-- Fase 2 — Módulo Despesas: Calendário (Contas a Pagar / a Receber)
--
-- Cria as tabelas transacionais da aba "calendario":
--   • despesas_lancamentos            → conta a pagar/receber (fiel ao GIMOB)
--   • despesas_lancamento_pagamentos  → múltiplas formas de pagamento por conta
--
-- Regras de segurança (RLS) reaproveitam os helpers criados na Fase 1:
--   despesas_pode_ver_aba / despesas_pode_editar_aba / despesas_pode_excluir_aba
--   despesas_centros_permitidos (filtro por centro de custo)
--
-- Ordem obrigatória por tabela (fase 1 estabeleceu):
--   1) CREATE TABLE
--   2) GRANT
--   3) ENABLE RLS
--   4) POLICIES
-- Triggers de auditoria/updated_at são anexados no final via loop.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) despesas_lancamentos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('a_pagar', 'a_receber')),
  descricao text NOT NULL,
  documento_numero text,
  pessoa_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  centro_custo_id uuid NOT NULL REFERENCES public.despesas_centros_custo(id) ON DELETE RESTRICT,
  categoria_id uuid REFERENCES public.despesas_categorias(id) ON DELETE SET NULL,
  plano_conta_id uuid REFERENCES public.despesas_planos_conta(id) ON DELETE SET NULL,
  subcategoria_id uuid REFERENCES public.despesas_subcategorias(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.despesas_contas_bancarias(id) ON DELETE SET NULL,
  data_competencia date NOT NULL,
  data_vencimento date NOT NULL,
  valor_total numeric(14,2) NOT NULL CHECK (valor_total >= 0),
  valor_pago numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
  status text NOT NULL DEFAULT 'a_vencer'
    CHECK (status IN ('a_vencer','vencido','pago_parcial','pago','cancelado')),
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_lanc_vencimento ON public.despesas_lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_desp_lanc_status ON public.despesas_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_desp_lanc_centro ON public.despesas_lancamentos(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_desp_lanc_pessoa ON public.despesas_lancamentos(pessoa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_lancamentos TO authenticated;
GRANT ALL ON public.despesas_lancamentos TO service_role;

ALTER TABLE public.despesas_lancamentos ENABLE ROW LEVEL SECURITY;

-- SELECT: precisa ver a aba E ter acesso ao centro de custo do lançamento.
CREATE POLICY "desp_lanc_select"
  ON public.despesas_lancamentos FOR SELECT
  TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- INSERT: precisa poder editar e o centro de custo escolhido estar na sua lista permitida.
CREATE POLICY "desp_lanc_insert"
  ON public.despesas_lancamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- UPDATE: precisa poder editar; both USING e WITH CHECK usam a mesma regra.
CREATE POLICY "desp_lanc_update"
  ON public.despesas_lancamentos FOR UPDATE
  TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- DELETE: precisa da permissão explícita de excluir na aba.
CREATE POLICY "desp_lanc_delete"
  ON public.despesas_lancamentos FOR DELETE
  TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'calendario')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 2) despesas_lancamento_pagamentos (formas de pagamento por conta)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_lancamento_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id uuid NOT NULL REFERENCES public.despesas_lancamentos(id) ON DELETE CASCADE,
  data_pagamento date NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  forma_pagamento text NOT NULL
    CHECK (forma_pagamento IN ('dinheiro','pix','boleto','cartao','transferencia','cheque','outro')),
  conta_bancaria_id uuid REFERENCES public.despesas_contas_bancarias(id) ON DELETE SET NULL,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_pag_lancamento ON public.despesas_lancamento_pagamentos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_desp_pag_data ON public.despesas_lancamento_pagamentos(data_pagamento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_lancamento_pagamentos TO authenticated;
GRANT ALL ON public.despesas_lancamento_pagamentos TO service_role;

ALTER TABLE public.despesas_lancamento_pagamentos ENABLE ROW LEVEL SECURITY;

-- As policies dos pagamentos espelham as do lançamento pai (via EXISTS).
CREATE POLICY "desp_pag_select"
  ON public.despesas_lancamento_pagamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.despesas_lancamentos l
      WHERE l.id = lancamento_id
        AND public.despesas_pode_ver_aba(auth.uid(), 'calendario')
        AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

CREATE POLICY "desp_pag_insert"
  ON public.despesas_lancamento_pagamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.despesas_lancamentos l
      WHERE l.id = lancamento_id
        AND public.despesas_pode_editar_aba(auth.uid(), 'calendario')
        AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

CREATE POLICY "desp_pag_update"
  ON public.despesas_lancamento_pagamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.despesas_lancamentos l
      WHERE l.id = lancamento_id
        AND public.despesas_pode_editar_aba(auth.uid(), 'calendario')
        AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.despesas_lancamentos l
      WHERE l.id = lancamento_id
        AND public.despesas_pode_editar_aba(auth.uid(), 'calendario')
        AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

CREATE POLICY "desp_pag_delete"
  ON public.despesas_lancamento_pagamentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.despesas_lancamentos l
      WHERE l.id = lancamento_id
        AND public.despesas_pode_editar_aba(auth.uid(), 'calendario')
        AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- 3) Trigger que mantém valor_pago e status sincronizados
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_recalcular_lancamento(_lancamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(14,2);
  v_pago numeric(14,2);
  v_venc date;
  v_status text;
BEGIN
  SELECT valor_total, data_vencimento, status
    INTO v_total, v_venc, v_status
  FROM public.despesas_lancamentos
  WHERE id = _lancamento_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_pago
  FROM public.despesas_lancamento_pagamentos
  WHERE lancamento_id = _lancamento_id;

  -- Cancelado é estado terminal manual: nunca sobrescrever automaticamente.
  IF v_status = 'cancelado' THEN
    UPDATE public.despesas_lancamentos
       SET valor_pago = v_pago, updated_at = now()
     WHERE id = _lancamento_id;
    RETURN;
  END IF;

  IF v_pago >= v_total AND v_total > 0 THEN
    v_status := 'pago';
  ELSIF v_pago > 0 THEN
    v_status := 'pago_parcial';
  ELSIF v_venc < current_date THEN
    v_status := 'vencido';
  ELSE
    v_status := 'a_vencer';
  END IF;

  UPDATE public.despesas_lancamentos
     SET valor_pago = v_pago,
         status = v_status,
         updated_at = now()
   WHERE id = _lancamento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.despesas_pagamento_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.despesas_recalcular_lancamento(OLD.lancamento_id);
    RETURN OLD;
  ELSE
    PERFORM public.despesas_recalcular_lancamento(NEW.lancamento_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_pag_recalc ON public.despesas_lancamento_pagamentos;
CREATE TRIGGER trg_desp_pag_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.despesas_lancamento_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.despesas_pagamento_trg();

-- ---------------------------------------------------------------------
-- 4) Trigger updated_at + auditoria (apenas na tabela pai)
-- ---------------------------------------------------------------------
-- Garante que audit_module_changes reconheça as tabelas do módulo despesas.
-- A função da Fase 1 já usa TG_TABLE_NAME + CASE; estendemos o CASE aqui
-- para incluir todas as tabelas 'despesas_*' que produzem log operacional.
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
    WHEN 'estoque_locais_armazenamento', 'estoque_materiais', 'estoque_saldos',
         'estoque_gestores', 'estoque_solicitacoes', 'estoque_solicitacao_itens',
         'estoque_movimentacoes', 'estoque_notificacoes' THEN
      v_module_name := 'estoque';
    WHEN 'despesas_lancamentos', 'despesas_lancamento_pagamentos',
         'despesas_categorias', 'despesas_centros_custo', 'despesas_contas_bancarias',
         'despesas_perfis_acesso', 'despesas_pessoas', 'despesas_planos_conta',
         'despesas_subcategorias', 'despesas_veiculos',
         'despesas_aba_permissoes', 'despesas_centros_custo_permissoes' THEN
      v_module_name := 'despesas';
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

  IF TG_OP != 'UPDATE' OR v_changed_fields IS NOT NULL THEN
    INSERT INTO public.module_audit_logs (
      module_name, table_name, record_id, action,
      old_data, new_data, changed_fields,
      changed_by, changed_by_email
    ) VALUES (
      v_module_name, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
      v_old_data, v_new_data, v_changed_fields,
      v_user_id, v_user_email
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['despesas_lancamentos','despesas_lancamento_pagamentos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
      t, t
    );
  END LOOP;

  -- Auditoria apenas no pai: evita dobrar log em pagamentos.
  EXECUTE 'DROP TRIGGER IF EXISTS trg_despesas_lancamentos_audit ON public.despesas_lancamentos';
  EXECUTE 'CREATE TRIGGER trg_despesas_lancamentos_audit
           AFTER INSERT OR UPDATE OR DELETE ON public.despesas_lancamentos
           FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes()';
END $$;