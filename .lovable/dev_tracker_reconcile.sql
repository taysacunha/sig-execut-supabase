-- Reconciliação idempotente entre o consolidado legado e o histórico cronológico.
-- Objetivo: preservar integralmente as horas já registradas em dev_tracker,
-- adicionando ao histórico apenas a diferença positiva de cada sistema.
-- Execute no SQL Editor do Supabase e confira o resultado final.

BEGIN;

-- Remove somente os lançamentos técnicos gerados por este próprio script.
-- Assim, a reexecução recalcula uma única diferença sem duplicar horas.
DELETE FROM public.dev_tracker_log
WHERE title = 'Reconciliação do acervo anterior';

WITH consolidado AS (
  SELECT system_name, COALESCE(SUM(hours), 0)::numeric AS horas
  FROM public.dev_tracker
  GROUP BY system_name
),
historico_sem_reconciliacao AS (
  SELECT system_name, COALESCE(SUM(hours), 0)::numeric AS horas
  FROM public.dev_tracker_log
  WHERE title <> 'Reconciliação do acervo anterior'
  GROUP BY system_name
),
diferencas AS (
  SELECT
    c.system_name,
    GREATEST(c.horas - COALESCE(h.horas, 0), 0)::numeric AS horas_faltantes
  FROM consolidado c
  LEFT JOIN historico_sem_reconciliacao h USING (system_name)
)
INSERT INTO public.dev_tracker_log (
  occurred_on, system_name, title, description, change_type, hours
)
SELECT
  DATE '2025-10-15',
  d.system_name,
  'Reconciliação do acervo anterior',
  'Horas do acervo consolidado anterior ao histórico cronológico, preservadas na migração para a fonte única. O detalhamento funcional permanece nos lançamentos e documentos legados.',
  'atualizacao',
  d.horas_faltantes
FROM diferencas d
WHERE d.horas_faltantes > 0;

COMMIT;

-- Resultado da auditoria: os totais devem ser iguais ou o histórico pode ser maior
-- caso contenha trabalho novo que nunca existiu no consolidado legado.
WITH totais AS (
  SELECT 'Consolidado legado' AS fonte, COALESCE(SUM(hours), 0)::numeric AS horas
  FROM public.dev_tracker
  UNION ALL
  SELECT 'Histórico oficial', COALESCE(SUM(hours), 0)::numeric
  FROM public.dev_tracker_log
)
SELECT * FROM totais ORDER BY fonte;

WITH sistemas AS (
  SELECT system_name FROM public.dev_tracker
  UNION
  SELECT system_name FROM public.dev_tracker_log
)
SELECT
  s.system_name,
  COALESCE((SELECT SUM(hours) FROM public.dev_tracker d WHERE d.system_name = s.system_name), 0) AS consolidado_legado,
  COALESCE((SELECT SUM(hours) FROM public.dev_tracker_log l WHERE l.system_name = s.system_name), 0) AS historico_oficial
FROM sistemas s
ORDER BY s.system_name;
