CREATE OR REPLACE FUNCTION public.despesas_pessoas_lookup()
RETURNS TABLE(id uuid, nome text, tipo_pessoa text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.tipo_pessoa
  FROM public.despesas_pessoas p
  WHERE p.is_active = true
    AND (
      public.despesas_pode_ver_aba(auth.uid(), 'cadastros')
      OR public.despesas_pode_ver_aba(auth.uid(), 'calendario')
      OR public.despesas_pode_ver_aba(auth.uid(), 'repasses')
      OR public.despesas_pode_ver_aba(auth.uid(), 'imoveis')
      OR public.despesas_pode_ver_aba(auth.uid(), 'veiculos')
      OR public.despesas_pode_ver_aba(auth.uid(), 'bens')
    )
  ORDER BY p.nome;
$$;
REVOKE ALL ON FUNCTION public.despesas_pessoas_lookup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.despesas_pessoas_lookup() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.despesas_centros_lookup()
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.nome
  FROM public.despesas_centros_custo c
  WHERE c.is_active = true
    AND c.id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    AND (
      public.despesas_pode_ver_aba(auth.uid(), 'cadastros')
      OR public.despesas_pode_ver_aba(auth.uid(), 'calendario')
      OR public.despesas_pode_ver_aba(auth.uid(), 'repasses')
      OR public.despesas_pode_ver_aba(auth.uid(), 'imoveis')
      OR public.despesas_pode_ver_aba(auth.uid(), 'veiculos')
      OR public.despesas_pode_ver_aba(auth.uid(), 'bens')
    )
  ORDER BY c.nome;
$$;
REVOKE ALL ON FUNCTION public.despesas_centros_lookup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.despesas_centros_lookup() TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('despesas_veiculos', 'despesas_veiculo_documentos')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname,
      CASE WHEN r.policyname LIKE '%doc%' THEN 'despesas_veiculo_documentos' ELSE 'despesas_veiculos' END);
  END LOOP;
END $$;

CREATE POLICY "veiculos_select" ON public.despesas_veiculos
  FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'veiculos')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "veiculos_insert" ON public.despesas_veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'veiculos')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "veiculos_update" ON public.despesas_veiculos
  FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'veiculos')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'veiculos')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "veiculos_delete" ON public.despesas_veiculos
  FOR DELETE TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'veiculos')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

CREATE POLICY "veiculo_docs_select" ON public.despesas_veiculo_documentos
  FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'veiculos')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );
CREATE POLICY "veiculo_docs_insert" ON public.despesas_veiculo_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'veiculos')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );
CREATE POLICY "veiculo_docs_update" ON public.despesas_veiculo_documentos
  FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'veiculos')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'veiculos')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );
CREATE POLICY "veiculo_docs_delete" ON public.despesas_veiculo_documentos
  FOR DELETE TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'veiculos')
    AND EXISTS (
      SELECT 1 FROM public.despesas_veiculos v
      WHERE v.id = despesas_veiculo_documentos.veiculo_id
        AND v.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.despesas_gerar_ocorrencias(
  _serie uuid,
  _ate date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.despesas_recorrencias%ROWTYPE;
  cursor_dt date;
  limite_dt date;
  criados integer := 0;
  mes smallint;
BEGIN
  SELECT * INTO r FROM public.despesas_recorrencias WHERE id = _serie;
  IF NOT FOUND OR NOT r.ativo THEN RETURN 0; END IF;

  limite_dt := LEAST(
    COALESCE(_ate, (now() + (r.janela_geracao_meses || ' months')::interval)::date),
    COALESCE(r.data_fim, DATE '9999-01-01')
  );
  cursor_dt := COALESCE(
    r.ultima_geracao_ate,
    make_date(EXTRACT(YEAR FROM r.data_inicio)::int,
              EXTRACT(MONTH FROM r.data_inicio)::int, 1) - INTERVAL '1 day'
  )::date;

  LOOP
    cursor_dt := date_trunc('month', cursor_dt + INTERVAL '1 month')::date;
    IF cursor_dt > limite_dt THEN EXIT; END IF;
    mes := EXTRACT(MONTH FROM cursor_dt)::smallint;
    IF r.tipo IN ('fixa_meses','intercalada') AND NOT (mes = ANY(r.meses_fixos)) THEN CONTINUE; END IF;
    IF r.tipo = 'anual' AND mes <> EXTRACT(MONTH FROM r.data_inicio)::smallint THEN CONTINUE; END IF;

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
        observacao, serie_recorrencia_id, is_manual, created_by,
        referencia_tipo, referencia_numero, imovel_id,
        referencia_numero_pasta, referencia_numero_venda, veiculo_id
      ) VALUES (
        r.lanc_tipo, r.descricao, r.pessoa_id, r.centro_custo_id, r.categoria_id,
        r.plano_conta_id, r.subcategoria_id, r.conta_bancaria_id,
        venc, venc, r.valor_total, 'a_vencer',
        r.observacao, r.id, false, r.created_by,
        r.referencia_tipo, r.referencia_numero, r.imovel_id,
        r.referencia_numero_pasta, r.referencia_numero_venda, r.veiculo_id
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

ALTER TABLE public.despesas_imoveis
  DROP CONSTRAINT IF EXISTS despesas_imoveis_situacao_check;
ALTER TABLE public.despesas_imoveis
  ADD CONSTRAINT despesas_imoveis_situacao_check
  CHECK (situacao IN ('alugado','vago','vendido','proprio_uso','em_aquisicao'));