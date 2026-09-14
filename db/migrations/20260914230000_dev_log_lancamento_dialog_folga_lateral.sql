-- Registro aditivo e idempotente da correção visual no módulo Despesas.
INSERT INTO public.dev_tracker_log (
  occurred_on,
  system_name,
  title,
  description,
  change_type,
  hours
)
SELECT
  DATE '2026-09-14',
  'despesas',
  'Folga lateral no diálogo de lançamento',
  'Correção da contenção e do espaçamento lateral dos campos Tipo e Nº do documento para evitar que ultrapassem a área visível ou fiquem sob a barra de rolagem.',
  'correcao',
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dev_tracker_log
  WHERE occurred_on = DATE '2026-09-14'
    AND system_name = 'despesas'
    AND title = 'Folga lateral no diálogo de lançamento'
);