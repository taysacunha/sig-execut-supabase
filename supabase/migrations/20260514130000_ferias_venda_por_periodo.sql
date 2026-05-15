-- Adiciona controle de venda por período (Q1/Q2 independentes)
-- Permite "P1 vendido + P2 gozado" e vice-versa, sem perder compatibilidade
-- com vender_dias / dias_vendidos / quinzena_venda.

ALTER TABLE public.ferias_ferias
  ADD COLUMN IF NOT EXISTS vender_q1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vender_q2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_vendidos_q1 integer,
  ADD COLUMN IF NOT EXISTS dias_vendidos_q2 integer;

-- Backfill a partir das colunas legadas
UPDATE public.ferias_ferias
SET
  vender_q1 = CASE
    WHEN vender_dias = true AND quinzena_venda = 1 THEN true
    WHEN vender_dias = true AND quinzena_venda IS NULL AND COALESCE(dias_vendidos,0) >= 16 THEN true
    ELSE false
  END,
  vender_q2 = CASE
    WHEN vender_dias = true AND quinzena_venda = 2 THEN true
    WHEN vender_dias = true AND quinzena_venda IS NULL AND COALESCE(dias_vendidos,0) >= 16 THEN true
    WHEN vender_dias = true AND quinzena_venda IS NULL AND COALESCE(dias_vendidos,0) > 0 THEN true
    ELSE false
  END,
  dias_vendidos_q1 = CASE
    WHEN vender_dias = true AND quinzena_venda = 1 THEN LEAST(COALESCE(dias_vendidos,0), 15)
    WHEN vender_dias = true AND quinzena_venda IS NULL AND COALESCE(dias_vendidos,0) >= 16 THEN 15
    ELSE NULL
  END,
  dias_vendidos_q2 = CASE
    WHEN vender_dias = true AND quinzena_venda = 2 THEN LEAST(COALESCE(dias_vendidos,0), 15)
    WHEN vender_dias = true AND quinzena_venda IS NULL AND COALESCE(dias_vendidos,0) >= 16 THEN COALESCE(dias_vendidos,0) - 15
    WHEN vender_dias = true AND quinzena_venda IS NULL AND COALESCE(dias_vendidos,0) > 0 THEN COALESCE(dias_vendidos,0)
    ELSE NULL
  END
WHERE vender_dias = true;
