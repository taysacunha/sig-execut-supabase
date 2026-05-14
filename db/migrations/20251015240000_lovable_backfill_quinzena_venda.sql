-- Backfill quinzena_venda para registros antigos sem o período da venda definido.
-- Execute no SQL Editor do Supabase Dashboard.
--
-- Aplica somente onde dias_vendidos > 0 e quinzena_venda IS NULL.
-- Regras (em ordem de precedência):
--   1. distribuicao_tipo = '1' -> 1
--   2. distribuicao_tipo = '2' -> 2
--   3. quinzena 1 com 5 dias e quinzena 2 cheia -> 1 (venda foi do 1º período)
--   4. quinzena 2 com 5 dias e quinzena 1 cheia -> 2
--   5. Caso default -> 2 (segundo período)
UPDATE public.ferias_ferias
SET quinzena_venda = CASE
  WHEN distribuicao_tipo = '1' THEN 1
  WHEN distribuicao_tipo = '2' THEN 2
  WHEN quinzena1_inicio IS NOT NULL AND quinzena1_fim IS NOT NULL
       AND (quinzena1_fim - quinzena1_inicio + 1) = 5
       AND quinzena2_inicio IS NOT NULL AND quinzena2_fim IS NOT NULL
       AND (quinzena2_fim - quinzena2_inicio + 1) >= 15 THEN 1
  WHEN quinzena2_inicio IS NOT NULL AND quinzena2_fim IS NOT NULL
       AND (quinzena2_fim - quinzena2_inicio + 1) = 5
       AND quinzena1_inicio IS NOT NULL AND quinzena1_fim IS NOT NULL
       AND (quinzena1_fim - quinzena1_inicio + 1) >= 15 THEN 2
  ELSE 2
END
WHERE dias_vendidos > 0 AND quinzena_venda IS NULL;