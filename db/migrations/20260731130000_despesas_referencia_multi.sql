-- Referência passa a suportar 4 campos independentes (ao menos 1 obrigatório):
--   Nº de Pasta, Cód. Venda, Imóvel, Pessoa.
-- referencia_tipo/referencia_numero antigos são mantidos apenas para histórico.

ALTER TABLE public.despesas_lancamentos
  ADD COLUMN IF NOT EXISTS referencia_numero_pasta text,
  ADD COLUMN IF NOT EXISTS referencia_numero_venda text;

ALTER TABLE public.despesas_recorrencias
  ADD COLUMN IF NOT EXISTS referencia_numero_pasta text,
  ADD COLUMN IF NOT EXISTS referencia_numero_venda text;

-- Backfill a partir de referencia_tipo + referencia_numero.
UPDATE public.despesas_lancamentos
   SET referencia_numero_pasta = referencia_numero
 WHERE referencia_tipo = 'pasta'
   AND referencia_numero_pasta IS NULL
   AND referencia_numero IS NOT NULL;

UPDATE public.despesas_lancamentos
   SET referencia_numero_venda = referencia_numero
 WHERE referencia_tipo = 'venda'
   AND referencia_numero_venda IS NULL
   AND referencia_numero IS NOT NULL;

UPDATE public.despesas_recorrencias
   SET referencia_numero_pasta = referencia_numero
 WHERE referencia_tipo = 'pasta'
   AND referencia_numero_pasta IS NULL
   AND referencia_numero IS NOT NULL;

UPDATE public.despesas_recorrencias
   SET referencia_numero_venda = referencia_numero
 WHERE referencia_tipo = 'venda'
   AND referencia_numero_venda IS NULL
   AND referencia_numero IS NOT NULL;

-- Remove os CHECKs antigos e cria novos alinhados à nova regra.
ALTER TABLE public.despesas_lancamentos
  DROP CONSTRAINT IF EXISTS despesas_lancamentos_referencia_ck;
ALTER TABLE public.despesas_recorrencias
  DROP CONSTRAINT IF EXISTS despesas_recorrencias_referencia_ck;

ALTER TABLE public.despesas_lancamentos
  ADD CONSTRAINT despesas_lancamentos_referencia_ck CHECK (
    (referencia_numero_pasta IS NULL OR referencia_numero_pasta ~ '^[0-9]+$')
    AND (referencia_numero_venda IS NULL OR referencia_numero_venda ~ '^[0-9]+$')
    AND (
      pessoa_id IS NOT NULL
      OR imovel_id IS NOT NULL
      OR referencia_numero_pasta IS NOT NULL
      OR referencia_numero_venda IS NOT NULL
    )
  );

ALTER TABLE public.despesas_recorrencias
  ADD CONSTRAINT despesas_recorrencias_referencia_ck CHECK (
    (referencia_numero_pasta IS NULL OR referencia_numero_pasta ~ '^[0-9]+$')
    AND (referencia_numero_venda IS NULL OR referencia_numero_venda ~ '^[0-9]+$')
    AND (
      pessoa_id IS NOT NULL
      OR imovel_id IS NOT NULL
      OR referencia_numero_pasta IS NOT NULL
      OR referencia_numero_venda IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_desp_lanc_ref_pasta
  ON public.despesas_lancamentos (referencia_numero_pasta);
CREATE INDEX IF NOT EXISTS idx_desp_lanc_ref_venda
  ON public.despesas_lancamentos (referencia_numero_venda);

-- Atualiza a função geradora para propagar os novos campos.
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

  cursor_dt := COALESCE(
    r.ultima_geracao_ate,
    make_date(EXTRACT(YEAR FROM r.data_inicio)::int,
              EXTRACT(MONTH FROM r.data_inicio)::int, 1) - INTERVAL '1 day'
  )::date;

  LOOP
    cursor_dt := (date_trunc('month', cursor_dt + INTERVAL '1 month'))::date;
    IF cursor_dt > limite_dt THEN EXIT; END IF;
    mes := EXTRACT(MONTH FROM cursor_dt)::smallint;

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
        observacao, serie_recorrencia_id, is_manual, created_by,
        referencia_tipo, referencia_numero, imovel_id,
        referencia_numero_pasta, referencia_numero_venda
      ) VALUES (
        r.lanc_tipo, r.descricao, r.pessoa_id, r.centro_custo_id, r.categoria_id,
        r.plano_conta_id, r.subcategoria_id, r.conta_bancaria_id,
        venc, venc, r.valor_total, 'a_vencer',
        r.observacao, r.id, false, r.created_by,
        r.referencia_tipo, r.referencia_numero, r.imovel_id,
        r.referencia_numero_pasta, r.referencia_numero_venda
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