-- Adicionar campos de gerente e data de entrada na tabela sales_brokers
ALTER TABLE sales_brokers 
ADD COLUMN is_manager BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sales_brokers 
ADD COLUMN hire_date DATE;

COMMENT ON COLUMN sales_brokers.is_manager IS 'Indica se o corretor é gerente (não aparece em avaliações)';
COMMENT ON COLUMN sales_brokers.hire_date IS 'Data de entrada na imobiliária';