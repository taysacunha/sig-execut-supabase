-- Adicionar constraint UNIQUE no campo property_name (Processo)
ALTER TABLE sales 
ADD CONSTRAINT sales_property_name_unique UNIQUE (property_name);