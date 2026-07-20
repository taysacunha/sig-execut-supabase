-- Restringe visibilidade e mutações de despesas_veiculos e
-- despesas_veiculo_documentos aos centros de custo permitidos ao usuário,
-- alinhando com o padrão de despesas_imoveis/lancamentos/repasses.

-- 1) despesas_veiculos
DROP POLICY IF EXISTS "despesas_veic_view" ON public.despesas_veiculos;
DROP POLICY IF EXISTS "despesas_veic_edit" ON public.despesas_veiculos;

CREATE POLICY "despesas_veic_view" ON public.despesas_veiculos
  FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'cadastros')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

CREATE POLICY "despesas_veic_insert" ON public.despesas_veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'cadastros')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

CREATE POLICY "despesas_veic_update" ON public.despesas_veiculos
  FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'cadastros')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'cadastros')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

CREATE POLICY "despesas_veic_delete" ON public.despesas_veiculos
  FOR DELETE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'cadastros')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- 2) despesas_veiculo_documentos — herda o escopo via join com o veículo.
DROP POLICY IF EXISTS "desp_veic_doc_select" ON public.despesas_veiculo_documentos;
DROP POLICY IF EXISTS "desp_veic_doc_insert" ON public.despesas_veiculo_documentos;
DROP POLICY IF EXISTS "desp_veic_doc_update" ON public.despesas_veiculo_documentos;
DROP POLICY IF EXISTS "desp_veic_doc_delete" ON public.despesas_veiculo_documentos;

CREATE POLICY "desp_veic_doc_select" ON public.despesas_veiculo_documentos
  FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'cadastros')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

CREATE POLICY "desp_veic_doc_insert" ON public.despesas_veiculo_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'cadastros')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

CREATE POLICY "desp_veic_doc_update" ON public.despesas_veiculo_documentos
  FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'cadastros')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'cadastros')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

CREATE POLICY "desp_veic_doc_delete" ON public.despesas_veiculo_documentos
  FOR DELETE TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'cadastros')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );