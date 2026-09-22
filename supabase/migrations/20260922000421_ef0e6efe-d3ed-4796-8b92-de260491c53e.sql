ALTER TABLE public.despesas_imoveis
  ADD COLUMN IF NOT EXISTS rip_situacao text NOT NULL DEFAULT 'nao_informado';

ALTER TABLE public.despesas_imoveis
  DROP CONSTRAINT IF EXISTS despesas_imoveis_rip_situacao_check;
ALTER TABLE public.despesas_imoveis
  ADD CONSTRAINT despesas_imoveis_rip_situacao_check
  CHECK (rip_situacao IN ('possui', 'nao_possui', 'nao_informado'));

CREATE TABLE public.despesas_duplicidades_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_a_id uuid NOT NULL REFERENCES public.despesas_lancamentos(id) ON DELETE CASCADE,
  lancamento_b_id uuid NOT NULL REFERENCES public.despesas_lancamentos(id) ON DELETE CASCADE,
  justificativa text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT despesas_duplicidades_revisoes_ordem_ck CHECK (lancamento_a_id::text < lancamento_b_id::text),
  CONSTRAINT despesas_duplicidades_revisoes_justificativa_ck CHECK (length(btrim(justificativa)) >= 10),
  CONSTRAINT despesas_duplicidades_revisoes_pair_uk UNIQUE (lancamento_a_id, lancamento_b_id)
);
GRANT SELECT, INSERT ON public.despesas_duplicidades_revisoes TO authenticated;
GRANT ALL ON public.despesas_duplicidades_revisoes TO service_role;
ALTER TABLE public.despesas_duplicidades_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY despesas_duplicidades_revisoes_select
ON public.despesas_duplicidades_revisoes
FOR SELECT TO authenticated
USING (
  public.despesas_pode_ver_aba(auth.uid(), 'calendario')
  AND EXISTS (
    SELECT 1 FROM public.despesas_lancamentos l
    WHERE l.id IN (lancamento_a_id, lancamento_b_id)
      AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
);

CREATE POLICY despesas_duplicidades_revisoes_insert
ON public.despesas_duplicidades_revisoes
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.despesas_pode_editar_aba(auth.uid(), 'calendario')
  AND EXISTS (
    SELECT 1 FROM public.despesas_lancamentos l
    WHERE l.id IN (lancamento_a_id, lancamento_b_id)
      AND l.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
);

DROP POLICY IF EXISTS desp_lanc_select ON public.despesas_lancamentos;
CREATE POLICY desp_lanc_select
ON public.despesas_lancamentos
FOR SELECT TO authenticated
USING (
  centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  AND (
    public.despesas_pode_ver_aba(auth.uid(), 'calendario')
    OR (
      veiculo_id IS NOT NULL
      AND public.despesas_pode_ver_aba(auth.uid(), 'veiculos')
    )
  )
);

CREATE OR REPLACE FUNCTION public.despesas_gerar_encargos_veiculo_detalhado(_veiculo_id uuid, _ano integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  i integer;
  v_parcelas integer;
  v_venc date;
  v_valor numeric(14,2);
  v_desc text;
  v_centro uuid;
  v_nome text;
  v_criados integer := 0;
  v_existentes integer := 0;
  v_sem_valor integer := 0;
BEGIN
  IF NOT public.despesas_pode_editar_aba(auth.uid(), 'veiculos') THEN
    RAISE EXCEPTION 'Sem permissão para gerar encargos de veículos';
  END IF;

  SELECT centro_custo_id, modelo || COALESCE(' (' || placa || ')', '')
    INTO v_centro, v_nome
    FROM public.despesas_veiculos
   WHERE id = _veiculo_id
     AND is_active = true
     AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veículo não encontrado ou fora dos centros permitidos';
  END IF;
  IF v_centro IS NULL THEN
    RAISE EXCEPTION 'Veículo sem centro de custo definido';
  END IF;

  FOR r IN
    SELECT * FROM public.despesas_veiculo_documentos
    WHERE veiculo_id = _veiculo_id AND ativo = true
  LOOP
    v_parcelas := GREATEST(COALESCE(r.parcelas, 1), 1);
    v_venc := make_date(
      _ano,
      EXTRACT(MONTH FROM r.vencimento_primeira_parcela)::integer,
      EXTRACT(DAY FROM r.vencimento_primeira_parcela)::integer
    );
    v_valor := CASE WHEN COALESCE(r.valor, 0) > 0 THEN round(r.valor / v_parcelas, 2) ELSE NULL END;

    FOR i IN 1..v_parcelas LOOP
      v_desc := format('%s %s — %s, parcela %s/%s', upper(r.tipo), _ano::text, v_nome, i, v_parcelas);

      IF EXISTS (
        SELECT 1 FROM public.despesas_lancamentos
        WHERE tipo = 'a_pagar'
          AND descricao = v_desc
          AND veiculo_id = _veiculo_id
      ) THEN
        v_existentes := v_existentes + 1;
      ELSE
        INSERT INTO public.despesas_lancamentos(
          tipo, descricao, centro_custo_id, categoria_id, veiculo_id,
          data_competencia, data_vencimento, valor_total, status, observacao
        ) VALUES (
          'a_pagar', v_desc, v_centro, r.categoria_id, _veiculo_id,
          make_date(_ano, 1, 1),
          (v_venc + ((i - 1) || ' months')::interval)::date,
          v_valor, 'a_vencer',
          CASE WHEN v_valor IS NULL
            THEN format('Valor pendente — gerado automaticamente do documento de veículo (%s)', r.tipo)
            ELSE format('Gerado automaticamente do documento de veículo (%s)', r.tipo)
          END
        );
        v_criados := v_criados + 1;
        IF v_valor IS NULL THEN v_sem_valor := v_sem_valor + 1; END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'criados', v_criados,
    'existentes', v_existentes,
    'sem_valor', v_sem_valor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.despesas_gerar_encargos_veiculo_detalhado(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.despesas_gerar_encargos_veiculo_detalhado(uuid, integer) TO authenticated;