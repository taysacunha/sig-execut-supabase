-- Vincula lançamentos e recorrências a veículos, para que a página de Veículos
-- consiga exibir o calendário de despesas geradas pela frota.

ALTER TABLE public.despesas_lancamentos
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.despesas_veiculos(id) ON DELETE SET NULL;

ALTER TABLE public.despesas_recorrencias
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.despesas_veiculos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_desp_lanc_veiculo ON public.despesas_lancamentos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_desp_rec_veiculo ON public.despesas_recorrencias(veiculo_id);

-- Backfill: encargos já gerados são identificados pela observação padrão do
-- gerador + a descrição, que contém "modelo (placa)".
UPDATE public.despesas_lancamentos l
   SET veiculo_id = v.id
  FROM public.despesas_veiculos v
 WHERE l.veiculo_id IS NULL
   AND l.observacao ILIKE 'Gerado automaticamente do documento de veículo%'
   AND l.descricao ILIKE '%' || v.modelo || COALESCE(' (' || v.placa || ')', '') || '%';

-- Gerador de encargos agora grava o vínculo e usa-o na checagem de duplicidade.
CREATE OR REPLACE FUNCTION public.despesas_gerar_encargos_veiculo(_veiculo_id uuid, _ano int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  i int;
  v_venc date;
  v_valor numeric(14,2);
  v_desc text;
  v_centro uuid;
  v_ins int := 0;
BEGIN
  SELECT centro_custo_id INTO v_centro FROM public.despesas_veiculos WHERE id = _veiculo_id;
  IF v_centro IS NULL THEN
    RAISE EXCEPTION 'Veículo sem centro de custo definido';
  END IF;

  FOR r IN
    SELECT * FROM public.despesas_veiculo_documentos
    WHERE veiculo_id = _veiculo_id AND ativo = true
  LOOP
    v_venc := make_date(_ano, EXTRACT(MONTH FROM r.vencimento_primeira_parcela)::int, EXTRACT(DAY FROM r.vencimento_primeira_parcela)::int);
    v_valor := round(r.valor / r.parcelas, 2);
    FOR i IN 1..r.parcelas LOOP
      v_desc := format('%s %s — %s, parcela %s/%s',
        upper(r.tipo), _ano::text,
        (SELECT modelo || COALESCE(' (' || placa || ')','') FROM public.despesas_veiculos WHERE id = _veiculo_id),
        i, r.parcelas);

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
