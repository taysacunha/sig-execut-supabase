-- =============================================
-- ESTOQUE — Atributos persistidos de placa em estoque_materiais
-- Execute no SQL Editor do Supabase
--
-- Motivação: a agregação de saldos de placa infere tipo_uso/tamanho a partir
-- do nome do material. Quando o nome não contém "Aluga"/"Venda" ou "1x1"/"2x2"
-- (ex: "Placa 2x2 Lona"), a inferência erra o tipo_uso e o registro some ao
-- filtrar por tipo. Passamos a guardar os atributos na tabela.
-- =============================================

BEGIN;

ALTER TABLE public.estoque_materiais
  ADD COLUMN IF NOT EXISTS tipo_uso text
    CHECK (tipo_uso IS NULL OR tipo_uso IN ('venda','aluga'));

ALTER TABLE public.estoque_materiais
  ADD COLUMN IF NOT EXISTS tamanho text
    CHECK (tamanho IS NULL OR tamanho IN ('1x1','2x2','outro'));

ALTER TABLE public.estoque_materiais
  ADD COLUMN IF NOT EXISTS tamanho_outro text;

CREATE INDEX IF NOT EXISTS idx_estoque_materiais_placa_atributos
  ON public.estoque_materiais(tipo_uso, tamanho)
  WHERE is_placa = true;

-- Backfill: mesma heurística do helper inferPlacaAttributes (src/hooks/useEstoquePlacas.ts)
UPDATE public.estoque_materiais
SET tipo_uso = CASE
      WHEN lower(nome) LIKE '%aluga%' THEN 'aluga'
      ELSE 'venda'
    END
WHERE is_placa = true
  AND tipo_uso IS NULL;

UPDATE public.estoque_materiais
SET tamanho = CASE
      WHEN replace(lower(nome), ' ', '') LIKE '%1x1%' THEN '1x1'
      WHEN replace(lower(nome), ' ', '') LIKE '%2x2%' THEN '2x2'
      ELSE 'outro'
    END
WHERE is_placa = true
  AND tamanho IS NULL;

-- Extrai medida livre (ex: "3x1,5", "0.9 x 1.2") para tamanho='outro'
UPDATE public.estoque_materiais
SET tamanho_outro = trim(substring(
      nome from '([0-9]+(?:[,.][0-9]+)?\s*[xX]\s*[0-9]+(?:[,.][0-9]+)?)'
    ))
WHERE is_placa = true
  AND tamanho = 'outro'
  AND tamanho_outro IS NULL
  AND nome ~ '([0-9]+(?:[,.][0-9]+)?\s*[xX]\s*[0-9]+(?:[,.][0-9]+)?)';

COMMIT;

-- Verificação:
-- SELECT nome, is_placa, tipo_uso, tamanho, tamanho_outro
-- FROM public.estoque_materiais
-- WHERE is_placa = true
-- ORDER BY nome;