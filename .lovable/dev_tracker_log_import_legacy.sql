-- Importação do acervo legado (dev_tracker) para o histórico oficial (dev_tracker_log).
-- Regras:
--   * NENHUM DELETE, UPDATE ou redução de horas em registros existentes.
--   * Idempotente: pode ser executado quantas vezes for necessário.
--   * O total final do histórico deve fechar EXATAMENTE no total do acervo legado.
-- Execute como bloco único no SQL Editor do Supabase.

BEGIN;

-- 1. Fotografia de auditoria (somente leitura)
DO $$
DECLARE
  tracker_total numeric;
  log_total numeric;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO tracker_total FROM public.dev_tracker;
  SELECT COALESCE(SUM(hours), 0) INTO log_total FROM public.dev_tracker_log;
  RAISE NOTICE 'Antes da importacao: dev_tracker = % h | dev_tracker_log = % h', tracker_total, log_total;
END $$;

-- 2. Colunas de origem e chave de correspondência
ALTER TABLE public.dev_tracker_log
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

ALTER TABLE public.dev_tracker_log
  ADD COLUMN IF NOT EXISTS legacy_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS dev_tracker_log_legacy_key_uidx
  ON public.dev_tracker_log (legacy_key)
  WHERE legacy_key IS NOT NULL;

-- 3. Importa item a item, respeitando o teto de horas de cada sistema
WITH tracker_totals AS (
  SELECT system_name, COALESCE(SUM(hours), 0)::numeric AS total_hours
  FROM public.dev_tracker
  GROUP BY system_name
),
log_totals AS (
  SELECT system_name, COALESCE(SUM(hours), 0)::numeric AS detalhado
  FROM public.dev_tracker_log
  GROUP BY system_name
),
capacidade AS (
  SELECT
    t.system_name,
    GREATEST(t.total_hours - COALESCE(l.detalhado, 0), 0)::numeric AS restante
  FROM tracker_totals t
  LEFT JOIN log_totals l USING (system_name)
),
candidatos AS (
  SELECT
    d.system_name,
    d.feature_name,
    d.hours::numeric AS hours,
    d.description AS notes,
    d.system_name || '::' || d.feature_name AS legacy_key,
    SUM(d.hours::numeric) OVER (
      PARTITION BY d.system_name
      ORDER BY d.hours DESC, d.feature_name
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS acumulado_anterior
  FROM public.dev_tracker d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.dev_tracker_log lg
    WHERE lg.legacy_key = d.system_name || '::' || d.feature_name
  )
),
selecionados AS (
  SELECT
    c.system_name,
    c.feature_name,
    c.notes,
    c.legacy_key,
    LEAST(
      c.hours,
      GREATEST(cap.restante - COALESCE(c.acumulado_anterior, 0), 0)
    ) AS horas_importadas
  FROM candidatos c
  JOIN capacidade cap USING (system_name)
)
INSERT INTO public.dev_tracker_log (
  occurred_on,
  system_name,
  title,
  description,
  change_type,
  hours,
  source,
  legacy_key
)
SELECT
  DATE '2025-10-15',
  s.system_name,
  s.feature_name,
  COALESCE(s.notes, 'Item do acervo consolidado anterior migrado para o histórico cronológico.')
    || CASE WHEN s.horas_importadas < (
         SELECT d.hours FROM public.dev_tracker d
         WHERE d.system_name || '::' || d.feature_name = s.legacy_key
       )
       THEN ' (saldo parcial do acervo legado)'
       ELSE '' END,
  'atualizacao',
  s.horas_importadas,
  'legacy_item',
  s.legacy_key
FROM selecionados s
WHERE s.horas_importadas > 0;

-- 4. Validação final
DO $$
DECLARE
  expected numeric;
  actual numeric;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO expected FROM public.dev_tracker;
  SELECT COALESCE(SUM(hours), 0) INTO actual FROM public.dev_tracker_log;

  IF expected <> actual THEN
    RAISE EXCEPTION 'Importacao abortada: historico ficou com % h e o acervo legado tem % h. Nada foi persistido.', actual, expected;
  END IF;

  RAISE NOTICE 'Importacao concluida: historico oficial com % h, igual ao acervo legado.', actual;
END $$;

COMMIT;
