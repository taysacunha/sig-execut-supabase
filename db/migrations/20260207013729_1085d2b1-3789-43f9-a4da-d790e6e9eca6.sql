-- Adicionar campo nome_exibicao na tabela sales_brokers
ALTER TABLE public.sales_brokers 
ADD COLUMN IF NOT EXISTS nome_exibicao TEXT;