-- Valor total passa a ser opcional em lançamentos e recorrências.
-- Motivo: o módulo é agenda/registro de contas; controle de valores
-- vive em sistema externo. Cada ocorrência pode ter valor real distinto.

ALTER TABLE public.despesas_lancamentos
  ALTER COLUMN valor_total DROP NOT NULL;

ALTER TABLE public.despesas_recorrencias
  ALTER COLUMN valor_total DROP NOT NULL;