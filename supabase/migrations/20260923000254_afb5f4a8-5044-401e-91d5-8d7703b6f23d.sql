DROP POLICY IF EXISTS despesas_duplicidades_revisoes_select ON public.despesas_duplicidades_revisoes;
CREATE POLICY despesas_duplicidades_revisoes_select
ON public.despesas_duplicidades_revisoes
FOR SELECT TO authenticated
USING (
  public.despesas_pode_ver_aba(auth.uid(), 'calendario')
  AND EXISTS (
    SELECT 1 FROM public.despesas_lancamentos l
    WHERE l.id = lancamento_a_id
      AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  AND EXISTS (
    SELECT 1 FROM public.despesas_lancamentos l
    WHERE l.id = lancamento_b_id
      AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
);

DROP POLICY IF EXISTS despesas_duplicidades_revisoes_insert ON public.despesas_duplicidades_revisoes;
CREATE POLICY despesas_duplicidades_revisoes_insert
ON public.despesas_duplicidades_revisoes
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.despesas_pode_editar_aba(auth.uid(), 'calendario')
  AND EXISTS (
    SELECT 1 FROM public.despesas_lancamentos l
    WHERE l.id = lancamento_a_id
      AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  AND EXISTS (
    SELECT 1 FROM public.despesas_lancamentos l
    WHERE l.id = lancamento_b_id
      AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
);