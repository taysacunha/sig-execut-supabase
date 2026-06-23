-- =============================================
-- ESTOQUE — Ajustes na gestão de placas
-- Execute no SQL Editor do Supabase
--   1) Adiciona flag is_placa em estoque_materiais
--   2) Marca como is_placa = true o material já existente "Placa"
--   3) Remove versionamento (versao / substitui_placa_id)
--   4) Cria UNIQUE(codigo) global em estoque_placas
-- =============================================

-- 1) Flag is_placa
ALTER TABLE public.estoque_materiais
  ADD COLUMN IF NOT EXISTS is_placa boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_estoque_materiais_is_placa
  ON public.estoque_materiais(is_placa) WHERE is_placa = true;

-- 2) Auto-marca o material existente cujo nome começa por "Placa"
UPDATE public.estoque_materiais
   SET is_placa = true
 WHERE is_placa = false
   AND (lower(nome) = 'placa' OR lower(nome) LIKE 'placa%');

-- 3) Remove versionamento
-- 3a) Dropa o índice parcial e a UNIQUE composta antigos
DROP INDEX IF EXISTS public.estoque_placas_codigo_ativo_unico;

ALTER TABLE public.estoque_placas
  DROP CONSTRAINT IF EXISTS estoque_placas_codigo_versao_key;

-- 3b) Garante que não há duplicatas de código antes da UNIQUE global
--     (caso existam, mantém só a linha mais recente; raro porque feature é nova)
WITH ranked AS (
  SELECT id, codigo,
         ROW_NUMBER() OVER (PARTITION BY codigo ORDER BY created_at DESC, id DESC) AS rn
    FROM public.estoque_placas
)
DELETE FROM public.estoque_placas p
 USING ranked r
 WHERE p.id = r.id AND r.rn > 1;

-- 3c) Dropa colunas de versionamento
ALTER TABLE public.estoque_placas
  DROP COLUMN IF EXISTS substitui_placa_id,
  DROP COLUMN IF EXISTS versao;

-- 4) UNIQUE global do código
ALTER TABLE public.estoque_placas
  DROP CONSTRAINT IF EXISTS estoque_placas_codigo_key;
ALTER TABLE public.estoque_placas
  ADD CONSTRAINT estoque_placas_codigo_key UNIQUE (codigo);
