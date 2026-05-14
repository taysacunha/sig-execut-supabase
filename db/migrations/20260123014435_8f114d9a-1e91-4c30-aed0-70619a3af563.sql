-- Adicionar campo de tipo de corretor (venda ou locação)
ALTER TABLE sales_brokers 
ADD COLUMN broker_type TEXT NOT NULL DEFAULT 'venda';

-- Adicionar constraint para valores válidos
ALTER TABLE sales_brokers 
ADD CONSTRAINT check_broker_type CHECK (broker_type IN ('venda', 'locacao'));

-- Comentário explicativo
COMMENT ON COLUMN sales_brokers.broker_type IS 'Tipo de corretor: venda ou locacao. Corretores de locação não aparecem em avaliações C2S.';