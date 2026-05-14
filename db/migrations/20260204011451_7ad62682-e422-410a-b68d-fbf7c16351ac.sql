-- Adicionar campo de data de nascimento aos corretores de vendas
ALTER TABLE public.sales_brokers 
ADD COLUMN IF NOT EXISTS birth_date DATE;