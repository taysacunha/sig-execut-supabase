-- =============================================
-- REPARO: fluxo correto de placas como Materiais + Saldos
-- Execute no SQL Editor do Supabase se o script anterior de migração foi rodado
-- ou se materiais de placa aparecerem como inativos.
--
-- Regra do fluxo:
-- 1) Placa é um material em estoque_materiais (is_placa = true, is_active = true)
-- 2) O saldo é cadastrado em estoque_saldos por material/local
-- 3) A página /estoque/placas lê esses saldos e controla instalações/baixas
-- =============================================

BEGIN;

-- 1) Reativa e marca como placa todos os materiais cujo nome começa com "Placa".
UPDATE public.estoque_materiais
SET is_active = true,
    is_placa = true
WHERE lower(nome) LIKE 'placa%';

-- 2) Se placas individuais foram criadas a partir de "Migrado de <material>",
-- reassocia cada placa ao material original, não a um material genérico/âncora.
WITH origem AS (
  SELECT
    p.id AS placa_id,
    trim(replace(p.observacoes, 'Migrado de ', '')) AS nome_material_original
  FROM public.estoque_placas p
  WHERE p.observacoes LIKE 'Migrado de %'
), material_original AS (
  SELECT o.placa_id, m.id AS material_id
  FROM origem o
  JOIN public.estoque_materiais m
    ON lower(trim(m.nome)) = lower(trim(o.nome_material_original))
)
UPDATE public.estoque_placas p
SET material_id = mo.material_id
FROM material_original mo
WHERE p.id = mo.placa_id
  AND p.material_id IS DISTINCT FROM mo.material_id;

-- 3) Recria saldos dos materiais-placa a partir das placas disponíveis migradas,
-- apenas quando houver placas individuais migradas no histórico.
-- Isso evita sobrescrever saldos normais caso a migração anterior não tenha sido executada.
WITH migrated_available AS (
  SELECT
    p.material_id,
    p.local_armazenamento_id,
    count(*)::integer AS quantidade
  FROM public.estoque_placas p
  JOIN public.estoque_materiais m ON m.id = p.material_id
  WHERE p.observacoes LIKE 'Migrado de %'
    AND p.status = 'disponivel'
    AND p.local_armazenamento_id IS NOT NULL
    AND m.is_placa = true
  GROUP BY p.material_id, p.local_armazenamento_id
)
INSERT INTO public.estoque_saldos (material_id, local_armazenamento_id, quantidade)
SELECT material_id, local_armazenamento_id, quantidade
FROM migrated_available
ON CONFLICT (material_id, local_armazenamento_id)
DO UPDATE SET quantidade = EXCLUDED.quantidade,
              updated_at = now();

-- 4) Remove saldos de material genérico "Placa" somente quando ele não representa
-- um dos nomes operacionais usados no estoque e ficou sem placas disponíveis vinculadas.
DELETE FROM public.estoque_saldos s
USING public.estoque_materiais m
WHERE s.material_id = m.id
  AND lower(trim(m.nome)) = 'placa'
  AND NOT EXISTS (
    SELECT 1
    FROM public.estoque_placas p
    WHERE p.material_id = m.id
      AND p.status = 'disponivel'
  );

COMMIT;

-- Verificações úteis:
-- SELECT nome, is_active, is_placa FROM public.estoque_materiais WHERE lower(nome) LIKE 'placa%' ORDER BY nome;
-- SELECT m.nome, l.nome AS local, s.quantidade
-- FROM public.estoque_saldos s
-- JOIN public.estoque_materiais m ON m.id = s.material_id
-- JOIN public.estoque_locais_armazenamento l ON l.id = s.local_armazenamento_id
-- WHERE m.is_placa = true
-- ORDER BY m.nome, l.nome;