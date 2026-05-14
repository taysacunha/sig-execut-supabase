-- Adicionar campo nome_exibicao para exibição personalizada de nomes
ALTER TABLE public.ferias_colaboradores 
ADD COLUMN IF NOT EXISTS nome_exibicao TEXT;