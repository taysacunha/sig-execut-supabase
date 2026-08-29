-- =====================================================================
-- Fix: a geração de encargos de veículos falhava com
--   new row for relation "despesas_lancamentos" violates check
--   constraint "despesas_lancamentos_referencia_ck"
-- porque a regra de referência exigia pessoa, imóvel, pasta ou venda,
-- e os encargos de frota só possuem o vínculo com o veículo.
-- Passamos a aceitar `veiculo_id` como referência válida.
-- =====================================================================

ALTER TABLE public.despesas_lancamentos
  DROP CONSTRAINT IF EXISTS despesas_lancamentos_referencia_ck;
ALTER TABLE public.despesas_lancamentos
  ADD CONSTRAINT despesas_lancamentos_referencia_ck CHECK (
    (referencia_numero_pasta IS NULL OR referencia_numero_pasta ~ '^[0-9]+$')
    AND (referencia_numero_venda IS NULL OR referencia_numero_venda ~ '^[0-9]+$')
    AND (
      pessoa_id IS NOT NULL
      OR imovel_id IS NOT NULL
      OR veiculo_id IS NOT NULL
      OR referencia_numero_pasta IS NOT NULL
      OR referencia_numero_venda IS NOT NULL
    )
  );

ALTER TABLE public.despesas_recorrencias
  DROP CONSTRAINT IF EXISTS despesas_recorrencias_referencia_ck;
ALTER TABLE public.despesas_recorrencias
  ADD CONSTRAINT despesas_recorrencias_referencia_ck CHECK (
    (referencia_numero_pasta IS NULL OR referencia_numero_pasta ~ '^[0-9]+$')
    AND (referencia_numero_venda IS NULL OR referencia_numero_venda ~ '^[0-9]+$')
    AND (
      pessoa_id IS NOT NULL
      OR imovel_id IS NOT NULL
      OR veiculo_id IS NOT NULL
      OR referencia_numero_pasta IS NOT NULL
      OR referencia_numero_venda IS NOT NULL
    )
  );

-- Gerador defensivo: ignora documentos sem valor e evita divisão por zero
-- quando `parcelas` estiver nulo ou zerado.
CREATE OR REPLACE FUNCTION public.despesas_gerar_encargos_veiculo(_veiculo_id uuid, _ano int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  i int;
  v_parcelas int;
  v_venc date;
  v_valor numeric(14,2);
  v_desc text;
  v_centro uuid;
  v_nome text;
  v_ins int := 0;
BEGIN
  SELECT centro_custo_id,
         modelo || COALESCE(' (' || placa || ')', '')
    INTO v_centro, v_nome
    FROM public.despesas_veiculos
   WHERE id = _veiculo_id;

  IF v_centro IS NULL THEN
    RAISE EXCEPTION 'Veículo sem centro de custo definido';
  END IF;

  FOR r IN
    SELECT * FROM public.despesas_veiculo_documentos
    WHERE veiculo_id = _veiculo_id AND ativo = true
  LOOP
    v_parcelas := GREATEST(COALESCE(r.parcelas, 1), 1);
    IF COALESCE(r.valor, 0) <= 0 THEN
      CONTINUE;
    END IF;

    v_venc := make_date(
      _ano,
      EXTRACT(MONTH FROM r.vencimento_primeira_parcela)::int,
      EXTRACT(DAY FROM r.vencimento_primeira_parcela)::int
    );
    v_valor := round(r.valor / v_parcelas, 2);

    FOR i IN 1..v_parcelas LOOP
      v_desc := format('%s %s — %s, parcela %s/%s',
        upper(r.tipo), _ano::text, v_nome, i, v_parcelas);

      IF NOT EXISTS (
        SELECT 1 FROM public.despesas_lancamentos
        WHERE tipo = 'a_pagar'
          AND descricao = v_desc
          AND (veiculo_id = _veiculo_id OR (veiculo_id IS NULL AND centro_custo_id = v_centro))
      ) THEN
        INSERT INTO public.despesas_lancamentos(
          tipo, descricao, centro_custo_id, categoria_id, veiculo_id,
          data_competencia, data_vencimento, valor_total, status, observacao
        ) VALUES (
          'a_pagar', v_desc, v_centro, r.categoria_id, _veiculo_id,
          make_date(_ano, 1, 1),
          (v_venc + ((i - 1) || ' months')::interval)::date,
          v_valor, 'a_vencer',
          format('Gerado automaticamente do documento de veículo (%s)', r.tipo)
        );
        v_ins := v_ins + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_ins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_gerar_encargos_veiculo(uuid, int) TO authenticated;
