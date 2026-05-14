-- Adicionar coluna builder_company na tabela locations
ALTER TABLE public.locations 
ADD COLUMN builder_company TEXT;

-- Criar índice para otimizar buscas por construtora
CREATE INDEX idx_locations_builder_company ON public.locations(builder_company);