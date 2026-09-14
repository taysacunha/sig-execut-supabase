-- Registro aditivo e idempotente da melhoria no módulo Despesas.
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
  'Diálogo de lançamento com seletores completos',
  'Ampliação do diálogo de novo lançamento, exibição integral de imóveis, pessoas, categorias, centros de custo, planos e contas, identificação de imóveis por código, descrição e endereço e correção da rolagem por mouse e touchpad na lista de imóveis.',
  'ajuste',
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dev_tracker_log
  WHERE occurred_on = DATE '2026-09-14'
    AND system_name = 'despesas'
    AND title = 'Diálogo de lançamento com seletores completos'
);