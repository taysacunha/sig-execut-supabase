-- =====================================================================
-- Repasses: conta por Proprietário + Centro de custo com histórico de
-- competências. Limite anual opcional por beneficiário.
-- =====================================================================

-- 1) Conta de repasse ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_repasse_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES public.despesas_pessoas(id) ON DELETE RESTRICT,
  centro_custo_id uuid NOT NULL REFERENCES public.despesas_centros_custo(id) ON DELETE RESTRICT,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proprietario_id, centro_custo_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_repasse_contas TO authenticated;
GRANT ALL ON public.despesas_repasse_contas TO service_role;

ALTER TABLE public.despesas_repasse_contas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desp_rep_conta_select" ON public.despesas_repasse_contas;
CREATE POLICY "desp_rep_conta_select" ON public.despesas_repasse_contas
  FOR SELECT TO authenticated USING (
    public.despesas_pode_ver_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

DROP POLICY IF EXISTS "desp_rep_conta_insert" ON public.despesas_repasse_contas;
CREATE POLICY "desp_rep_conta_insert" ON public.despesas_repasse_contas
  FOR INSERT TO authenticated WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

DROP POLICY IF EXISTS "desp_rep_conta_update" ON public.despesas_repasse_contas;
CREATE POLICY "desp_rep_conta_update" ON public.despesas_repasse_contas
  FOR UPDATE TO authenticated USING (
    public.despesas_pode_editar_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ) WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

DROP POLICY IF EXISTS "desp_rep_conta_delete" ON public.despesas_repasse_contas;
CREATE POLICY "desp_rep_conta_delete" ON public.despesas_repasse_contas
  FOR DELETE TO authenticated USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- 2) Vínculo das competências à conta ----------------------------------
ALTER TABLE public.despesas_repasses
  ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES public.despesas_repasse_contas(id) ON DELETE CASCADE;

INSERT INTO public.despesas_repasse_contas (proprietario_id, centro_custo_id)
SELECT DISTINCT r.proprietario_id, r.centro_custo_id
FROM public.despesas_repasses r
ON CONFLICT (proprietario_id, centro_custo_id) DO NOTHING;

UPDATE public.despesas_repasses r
   SET conta_id = c.id
  FROM public.despesas_repasse_contas c
 WHERE c.proprietario_id = r.proprietario_id
   AND c.centro_custo_id = r.centro_custo_id
   AND r.conta_id IS DISTINCT FROM c.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_rep_conta_comp
  ON public.despesas_repasses(conta_id, competencia);

CREATE INDEX IF NOT EXISTS idx_desp_rep_conta ON public.despesas_repasses(conta_id);

-- 3) Limite anual opcional por beneficiário ----------------------------
CREATE TABLE IF NOT EXISTS public.despesas_repasse_benef_limite_anual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.despesas_repasse_contas(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.despesas_pessoas(id) ON DELETE CASCADE,
  ano int NOT NULL,
  valor_limite numeric(14,2) NOT NULL CHECK (valor_limite >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, pessoa_id, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_repasse_benef_limite_anual TO authenticated;
GRANT ALL ON public.despesas_repasse_benef_limite_anual TO service_role;

ALTER TABLE public.despesas_repasse_benef_limite_anual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desp_rep_lim_anual_select" ON public.despesas_repasse_benef_limite_anual;
CREATE POLICY "desp_rep_lim_anual_select" ON public.despesas_repasse_benef_limite_anual
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasse_contas c
     WHERE c.id = conta_id
       AND public.despesas_pode_ver_aba(auth.uid(), 'repasses')
       AND c.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

DROP POLICY IF EXISTS "desp_rep_lim_anual_insert" ON public.despesas_repasse_benef_limite_anual;
CREATE POLICY "desp_rep_lim_anual_insert" ON public.despesas_repasse_benef_limite_anual
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasse_contas c
     WHERE c.id = conta_id
       AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
       AND c.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

DROP POLICY IF EXISTS "desp_rep_lim_anual_update" ON public.despesas_repasse_benef_limite_anual;
CREATE POLICY "desp_rep_lim_anual_update" ON public.despesas_repasse_benef_limite_anual
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasse_contas c
     WHERE c.id = conta_id
       AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
       AND c.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasse_contas c
     WHERE c.id = conta_id
       AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
       AND c.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

DROP POLICY IF EXISTS "desp_rep_lim_anual_delete" ON public.despesas_repasse_benef_limite_anual;
CREATE POLICY "desp_rep_lim_anual_delete" ON public.despesas_repasse_benef_limite_anual
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasse_contas c
     WHERE c.id = conta_id
       AND public.despesas_pode_excluir_aba(auth.uid(), 'repasses')
       AND c.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

-- 4) RPC: criar/obter conta -------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_repasse_criar_conta(
  _proprietario_id uuid, _centro_custo_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.despesas_pode_editar_aba(auth.uid(), 'repasses') THEN
    RAISE EXCEPTION 'Sem permissão para criar repasses.';
  END IF;

  INSERT INTO public.despesas_repasse_contas(proprietario_id, centro_custo_id, created_by)
  VALUES (_proprietario_id, _centro_custo_id, auth.uid())
  ON CONFLICT (proprietario_id, centro_custo_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_repasse_criar_conta(uuid, uuid) TO authenticated;

-- 5) RPC: adicionar competência à conta --------------------------------
CREATE OR REPLACE FUNCTION public.despesas_repasse_add_competencia(
  _conta_id uuid, _competencia date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conta record;
  v_ini date;
  v_repasse_id uuid;
  v_prev_id uuid;
BEGIN
  IF NOT public.despesas_pode_editar_aba(auth.uid(), 'repasses') THEN
    RAISE EXCEPTION 'Sem permissão para editar repasses.';
  END IF;

  SELECT * INTO v_conta FROM public.despesas_repasse_contas WHERE id = _conta_id;
  IF v_conta IS NULL THEN
    RAISE EXCEPTION 'Conta de repasse não encontrada.';
  END IF;

  v_ini := date_trunc('month', _competencia)::date;

  SELECT id INTO v_repasse_id
    FROM public.despesas_repasses
   WHERE conta_id = _conta_id AND competencia = v_ini;

  IF v_repasse_id IS NOT NULL THEN
    RETURN v_repasse_id;
  END IF;

  -- competência anterior (para copiar os beneficiários)
  SELECT id INTO v_prev_id
    FROM public.despesas_repasses
   WHERE conta_id = _conta_id AND competencia < v_ini
   ORDER BY competencia DESC
   LIMIT 1;

  v_repasse_id := public.despesas_montar_repasse(
    v_conta.proprietario_id, v_ini, v_conta.centro_custo_id
  );

  UPDATE public.despesas_repasses SET conta_id = _conta_id WHERE id = v_repasse_id;

  IF v_prev_id IS NOT NULL THEN
    INSERT INTO public.despesas_repasse_beneficiarios(
      repasse_id, pessoa_id, valor, valor_limite, is_residual, ordem, observacao
    )
    SELECT v_repasse_id, b.pessoa_id, 0, b.valor_limite, b.is_residual, b.ordem, b.observacao
      FROM public.despesas_repasse_beneficiarios b
     WHERE b.repasse_id = v_prev_id
    ON CONFLICT (repasse_id, pessoa_id) DO NOTHING;
  END IF;

  RETURN v_repasse_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_repasse_add_competencia(uuid, date) TO authenticated;
