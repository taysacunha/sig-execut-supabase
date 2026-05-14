-- Define quinzena_venda = 2 para registros que vendem dias mas
-- estao sem o periodo da venda definido. Nao altera registros que
-- ja possuem quinzena_venda = 1 ou quinzena_venda = 2.
UPDATE public.ferias_ferias
SET quinzena_venda = 2
WHERE vender_dias = true
  AND COALESCE(dias_vendidos, 0) > 0
  AND quinzena_venda IS NULL;
