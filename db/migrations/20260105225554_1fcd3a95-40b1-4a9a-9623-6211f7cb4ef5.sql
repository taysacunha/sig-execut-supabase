-- Adicionar coluna team_id na tabela sales para guardar a equipe do momento da venda
ALTER TABLE public.sales ADD COLUMN team_id uuid REFERENCES public.sales_teams(id);

-- Preencher dados existentes com a equipe atual do corretor
-- (Como não temos histórico, usamos a equipe atual como melhor aproximação)
UPDATE public.sales s
SET team_id = sb.team_id
FROM public.sales_brokers sb
WHERE s.broker_id = sb.id AND s.team_id IS NULL;

-- Criar índice para melhor performance nas queries por equipe
CREATE INDEX idx_sales_team_id ON public.sales(team_id);