-- Restauração aditiva e idempotente das horas do acervo legado para o histórico oficial.
-- Execute no SQL Editor do Supabase como um bloco único.
-- Não apaga registros manuais nem do backfill: remove apenas os lançamentos técnicos
-- criados por este próprio script, para evitar duplicação em uma reexecução.

BEGIN;

-- 1. Fotografia de auditoria (apenas leitura, não altera dados)
DO $$
DECLARE
  tracker_total numeric;
  log_total numeric;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO tracker_total FROM public.dev_tracker;
  SELECT COALESCE(SUM(hours), 0) INTO log_total FROM public.dev_tracker_log;
  RAISE NOTICE 'Auditoria antes da recuperacao: dev_tracker = % horas, dev_tracker_log = % horas', tracker_total, log_total;
END $$;

-- 2. Garante a coluna de origem sem quebrar registros existentes
ALTER TABLE public.dev_tracker_log
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- 3. Remove apenas os lançamentos técnicos gerados por este script
DELETE FROM public.dev_tracker_log
WHERE source = 'legacy_reconciliation';

-- 4. Insere, por sistema, somente as horas que faltam para igualar o acervo legado
WITH tracker_totals AS (
  SELECT system_name, COALESCE(SUM(hours), 0)::numeric AS hours
  FROM public.dev_tracker
  GROUP BY system_name
),
log_totals AS (
  SELECT system_name, COALESCE(SUM(hours), 0)::numeric AS hours
  FROM public.dev_tracker_log
  WHERE source IS DISTINCT FROM 'legacy_reconciliation'
  GROUP BY system_name
),
diffs AS (
  SELECT
    t.system_name,
    GREATEST(t.hours - COALESCE(l.hours, 0), 0)::numeric AS missing
  FROM tracker_totals t
  LEFT JOIN log_totals l USING (system_name)
)
INSERT INTO public.dev_tracker_log (
  occurred_on,
  system_name,
  title,
  description,
  change_type,
  hours,
  source
)
SELECT
  DATE '2025-10-15',
  d.system_name,
  'Recuperação do acervo legado — ' || d.system_name,
  'Horas do acervo consolidado anterior migradas para o histórico cronológico como parte da unificação das fontes. Este lançamento representa o saldo de horas do sistema que ainda não constava no histórico oficial.',
  'atualizacao',
  d.missing,
  'legacy_reconciliation'
FROM diffs d
WHERE d.missing > 0;

-- 5. Validação final: o histórico deve fechar exatamente no mesmo total do acervo legado
DO $$
DECLARE
  expected numeric;
  actual numeric;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO expected FROM public.dev_tracker;
  SELECT COALESCE(SUM(hours), 0) INTO actual FROM public.dev_tracker_log;

  IF expected <> actual THEN
    RAISE EXCEPTION 'Recuperação abortada: o total do histórico (%) não fechou no total do acervo legado (%). Nenhuma alteração foi persistida.', actual, expected;
  END IF;

  RAISE NOTICE 'Recuperacao concluida: historico oficial agora tem % horas, igual ao acervo legado.', actual;
END $$;

COMMIT;

-- 6. Consulta de conferência (rode separadamente se desejar ver o resultado)
-- SELECT
--   system_name,
--   COALESCE(SUM(hours), 0) AS hours
-- FROM public.dev_tracker_log
-- GROUP BY system_name
-- ORDER BY system_name;