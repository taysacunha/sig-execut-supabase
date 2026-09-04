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
  row_total record;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO tracker_total FROM public.dev_tracker;
  SELECT COALESCE(SUM(hours), 0) INTO log_total FROM public.dev_tracker_log;

  RAISE NOTICE 'Antes da importacao: dev_tracker = % h | dev_tracker_log = % h | saldo global = % h',
    tracker_total, log_total, tracker_total - log_total;

  IF tracker_total <> 1195 THEN
    RAISE EXCEPTION 'Importacao abortada antes de inserir: o acervo legado deveria ter 1195 h, mas tem % h.', tracker_total;
  END IF;

  IF log_total > tracker_total THEN
    RAISE EXCEPTION 'Importacao abortada antes de inserir: o historico ja tem % h, acima das % h do acervo legado.',
      log_total, tracker_total;
  END IF;

  FOR row_total IN
    SELECT origem, system_name, total_hours
    FROM (
      SELECT 'dev_tracker'::text AS origem, system_name, COALESCE(SUM(hours), 0)::numeric AS total_hours
      FROM public.dev_tracker
      GROUP BY system_name
      UNION ALL
      SELECT 'dev_tracker_log'::text AS origem, system_name, COALESCE(SUM(hours), 0)::numeric AS total_hours
      FROM public.dev_tracker_log
      GROUP BY system_name
    ) totals
    ORDER BY system_name, origem
  LOOP
    RAISE NOTICE 'Fotografia por sistema: % | % | % h',
      row_total.origem, row_total.system_name, row_total.total_hours;
  END LOOP;
END $$;

-- 2. Colunas de origem e chave de correspondência
ALTER TABLE public.dev_tracker_log
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

ALTER TABLE public.dev_tracker_log
  ADD COLUMN IF NOT EXISTS legacy_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS dev_tracker_log_legacy_key_uidx
  ON public.dev_tracker_log (legacy_key)
  WHERE legacy_key IS NOT NULL;

-- 3. Importa item a item usando um UNICO saldo global.
-- Não particionar por sistema: os sistemas do histórico detalhado não têm
-- necessariamente a mesma distribuição do acervo consolidado.
WITH totais AS (
  SELECT
    (SELECT COALESCE(SUM(hours), 0)::numeric FROM public.dev_tracker) AS tracker_total,
    (SELECT COALESCE(SUM(hours), 0)::numeric FROM public.dev_tracker_log) AS log_total
),
candidatos AS (
  SELECT
    d.id,
    d.system_name,
    d.feature_name,
    d.hours::numeric AS hours,
    d.description AS notes,
    'dev_tracker:' || d.id::text AS legacy_key,
    SUM(d.hours::numeric) OVER (
      ORDER BY d.system_name, COALESCE(d.display_order, 0), d.feature_name, d.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS acumulado_anterior
  FROM public.dev_tracker d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.dev_tracker_log lg
    WHERE lg.legacy_key = 'dev_tracker:' || d.id::text
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
      GREATEST((t.tracker_total - t.log_total) - COALESCE(c.acumulado_anterior, 0), 0)
    ) AS horas_importadas
  FROM candidatos c
  CROSS JOIN totais t
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
    || CASE
         WHEN s.horas_importadas = 0 THEN ' (item preservado sem horas adicionais na reconciliacao)'
         WHEN s.horas_importadas < s.hours THEN ' (saldo parcial do acervo legado)'
         ELSE ''
       END,
  'atualizacao',
  s.horas_importadas,
  'legacy_item',
  s.legacy_key
FROM selecionados s
ON CONFLICT (legacy_key) WHERE legacy_key IS NOT NULL DO NOTHING;

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
