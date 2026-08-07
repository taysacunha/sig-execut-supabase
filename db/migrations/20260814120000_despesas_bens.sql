-- =====================================================================
-- Bens Permanentes (patrimônio) — módulo Despesas
--   • despesas_bens                     (carteira de bens)
--   • despesas_bem_pagamentos           (aquisições/pagamentos)
--   • despesas_bem_situacao_historico   (histórico de situação)
--   • nova aba de permissão: 'bens'
-- Ordem: CREATE TABLE → GRANT → ENABLE RLS → POLICIES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Nova aba 'bens' no controle de permissões
-- ---------------------------------------------------------------------
ALTER TABLE public.despesas_aba_permissoes
  DROP CONSTRAINT IF EXISTS despesas_aba_permissoes_aba_check;
ALTER TABLE public.despesas_aba_permissoes
  ADD CONSTRAINT despesas_aba_permissoes_aba_check
  CHECK (aba IN ('calendario','imoveis','repasses','cadastros','bens'));

-- ---------------------------------------------------------------------
-- 1) Bens permanentes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_bens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  descricao text NOT NULL,
  categoria text NOT NULL DEFAULT 'equipamento'
    CHECK (categoria IN ('equipamento','movel','informatica','outro')),
  situacao text NOT NULL DEFAULT 'em_uso'
    CHECK (situacao IN ('em_uso','em_estoque','em_manutencao','baixado','doado_vendido')),
  centro_custo_id uuid NOT NULL REFERENCES public.despesas_centros_custo(id) ON DELETE RESTRICT,
  responsavel_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  local text,
  marca text,
  modelo text,
  numero_serie text,
  quantidade int NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  data_aquisicao date,
  nota_fiscal text,
  garantia_ate date,
  observacao text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_bens_centro ON public.despesas_bens(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_desp_bens_situacao ON public.despesas_bens(situacao);
CREATE INDEX IF NOT EXISTS idx_desp_bens_responsavel ON public.despesas_bens(responsavel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_bens TO authenticated;
GRANT ALL ON public.despesas_bens TO service_role;

ALTER TABLE public.despesas_bens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desp_bens_select" ON public.despesas_bens;
CREATE POLICY "desp_bens_select" ON public.despesas_bens FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'bens')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
DROP POLICY IF EXISTS "desp_bens_insert" ON public.despesas_bens;
CREATE POLICY "desp_bens_insert" ON public.despesas_bens FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'bens')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
DROP POLICY IF EXISTS "desp_bens_update" ON public.despesas_bens;
CREATE POLICY "desp_bens_update" ON public.despesas_bens FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'bens')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'bens')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
DROP POLICY IF EXISTS "desp_bens_delete" ON public.despesas_bens;
CREATE POLICY "desp_bens_delete" ON public.despesas_bens FOR DELETE TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'bens')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

DROP TRIGGER IF EXISTS trg_desp_bens_updated ON public.despesas_bens;
CREATE TRIGGER trg_desp_bens_updated
BEFORE UPDATE ON public.despesas_bens
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 2) Aquisições / pagamentos do bem
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_bem_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id uuid NOT NULL REFERENCES public.despesas_bens(id) ON DELETE CASCADE,
  data_compra date NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  descricao text NOT NULL,
  categoria_id uuid REFERENCES public.despesas_categorias(id) ON DELETE SET NULL,
  plano_conta_id uuid REFERENCES public.despesas_planos_conta(id) ON DELETE SET NULL,
  lancamento_id uuid REFERENCES public.despesas_lancamentos(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_bem_pag_bem ON public.despesas_bem_pagamentos(bem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_bem_pagamentos TO authenticated;
GRANT ALL ON public.despesas_bem_pagamentos TO service_role;

ALTER TABLE public.despesas_bem_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desp_bem_pag_select" ON public.despesas_bem_pagamentos;
CREATE POLICY "desp_bem_pag_select" ON public.despesas_bem_pagamentos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_bens b
    WHERE b.id = bem_id
      AND public.despesas_pode_ver_aba(auth.uid(), 'bens')
      AND b.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
DROP POLICY IF EXISTS "desp_bem_pag_insert" ON public.despesas_bem_pagamentos;
CREATE POLICY "desp_bem_pag_insert" ON public.despesas_bem_pagamentos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_bens b
    WHERE b.id = bem_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'bens')
      AND b.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
DROP POLICY IF EXISTS "desp_bem_pag_update" ON public.despesas_bem_pagamentos;
CREATE POLICY "desp_bem_pag_update" ON public.despesas_bem_pagamentos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_bens b
    WHERE b.id = bem_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'bens')
      AND b.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_bens b
    WHERE b.id = bem_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'bens')
      AND b.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
DROP POLICY IF EXISTS "desp_bem_pag_delete" ON public.despesas_bem_pagamentos;
CREATE POLICY "desp_bem_pag_delete" ON public.despesas_bem_pagamentos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_bens b
    WHERE b.id = bem_id
      AND public.despesas_pode_excluir_aba(auth.uid(), 'bens')
      AND b.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

DROP TRIGGER IF EXISTS trg_desp_bem_pag_updated ON public.despesas_bem_pagamentos;
CREATE TRIGGER trg_desp_bem_pag_updated
BEFORE UPDATE ON public.despesas_bem_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 3) Histórico de situação
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_bem_situacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id uuid NOT NULL REFERENCES public.despesas_bens(id) ON DELETE CASCADE,
  situacao_anterior text,
  situacao_nova text NOT NULL,
  data date NOT NULL DEFAULT current_date,
  motivo text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_bem_hist_bem ON public.despesas_bem_situacao_historico(bem_id);

GRANT SELECT, INSERT ON public.despesas_bem_situacao_historico TO authenticated;
GRANT ALL ON public.despesas_bem_situacao_historico TO service_role;

ALTER TABLE public.despesas_bem_situacao_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desp_bem_hist_select" ON public.despesas_bem_situacao_historico;
CREATE POLICY "desp_bem_hist_select" ON public.despesas_bem_situacao_historico FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_bens b
    WHERE b.id = bem_id
      AND public.despesas_pode_ver_aba(auth.uid(), 'bens')
      AND b.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
DROP POLICY IF EXISTS "desp_bem_hist_insert" ON public.despesas_bem_situacao_historico;
CREATE POLICY "desp_bem_hist_insert" ON public.despesas_bem_situacao_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_bens b
    WHERE b.id = bem_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'bens')
      AND b.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

CREATE OR REPLACE FUNCTION public.despesas_bem_situacao_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    INSERT INTO public.despesas_bem_situacao_historico(
      bem_id, situacao_anterior, situacao_nova, data, changed_by
    ) VALUES (NEW.id, OLD.situacao, NEW.situacao, current_date, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_bem_situacao ON public.despesas_bens;
CREATE TRIGGER trg_desp_bem_situacao
AFTER UPDATE OF situacao ON public.despesas_bens
FOR EACH ROW EXECUTE FUNCTION public.despesas_bem_situacao_trg();

-- ---------------------------------------------------------------------
-- 4) Gerar lançamento único no calendário (data da compra)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_gerar_lancamento_bem(_pagamento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  b record;
  v_desc text;
  v_id uuid;
BEGIN
  SELECT * INTO p FROM public.despesas_bem_pagamentos WHERE id = _pagamento_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;
  IF p.lancamento_id IS NOT NULL THEN RETURN p.lancamento_id; END IF;

  SELECT * INTO b FROM public.despesas_bens WHERE id = p.bem_id;
  IF b IS NULL THEN RAISE EXCEPTION 'Bem não encontrado'; END IF;

  v_desc := format('%s — %s',
    COALESCE(NULLIF(b.codigo, '') || ' - ', '') || b.descricao,
    p.descricao);

  SELECT id INTO v_id FROM public.despesas_lancamentos
  WHERE centro_custo_id = b.centro_custo_id
    AND tipo = 'a_pagar'
    AND descricao = v_desc
    AND data_vencimento = p.data_compra
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.despesas_lancamentos(
      tipo, descricao, pessoa_id, centro_custo_id, categoria_id, plano_conta_id,
      data_competencia, data_vencimento, valor_total, status, observacao
    ) VALUES (
      'a_pagar', v_desc, b.fornecedor_id, b.centro_custo_id, p.categoria_id, p.plano_conta_id,
      date_trunc('month', p.data_compra)::date, p.data_compra, p.valor, 'a_vencer',
      'Gerado automaticamente da aquisição de bem permanente'
    )
    RETURNING id INTO v_id;
  END IF;

  UPDATE public.despesas_bem_pagamentos SET lancamento_id = v_id WHERE id = _pagamento_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_gerar_lancamento_bem(uuid) TO authenticated;