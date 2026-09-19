-- Registro aditivo e idempotente da correção da venda de dias no módulo Férias.
INSERT INTO public.dev_tracker_log (
  occurred_on,
  system_name,
  title,
  description,
  change_type,
  hours
)
SELECT
  DATE '2026-09-19',
  'ferias',
  'Venda de dias reconhecida no primeiro salvamento',
  'Correção da sincronização entre quantidade vendida, período informado ao contador e períodos reais de gozo. A confirmação passa a reconhecer a venda já na primeira tentativa, os períodos preenchidos não são apagados por efeitos automáticos e a listagem atualiza os períodos após salvar.',
  'correcao',
  2
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dev_tracker_log
  WHERE occurred_on = DATE '2026-09-19'
    AND system_name = 'ferias'
    AND title = 'Venda de dias reconhecida no primeiro salvamento'
);