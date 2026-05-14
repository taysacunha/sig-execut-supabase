-- Atualizar a view broker_sales_proportional para incluir owner_broker_id
DROP VIEW IF EXISTS broker_sales_proportional;

CREATE OR REPLACE VIEW broker_sales_proportional AS
-- Titular (owner)
SELECT 
  s.id AS sale_id,
  s.broker_id,
  s.broker_id AS owner_broker_id,
  s.team_id,
  s.sale_date,
  s.year_month,
  s.property_name,
  s.sale_value AS total_value,
  s.has_partners,
  (1 + COALESCE((SELECT count(*) FROM sale_partners sp WHERE sp.sale_id = s.id), 0))::integer AS participant_count,
  s.sale_value / (1 + COALESCE((SELECT count(*) FROM sale_partners sp WHERE sp.sale_id = s.id), 0))::numeric AS proportional_value,
  'owner'::text AS role
FROM sales s

UNION ALL

-- Parceiros (partners)
SELECT 
  s.id AS sale_id,
  sp.broker_id,
  s.broker_id AS owner_broker_id,
  (SELECT sales_brokers.team_id FROM sales_brokers WHERE sales_brokers.id = sp.broker_id) AS team_id,
  s.sale_date,
  s.year_month,
  s.property_name,
  s.sale_value AS total_value,
  s.has_partners,
  (1 + (SELECT count(*) FROM sale_partners sp2 WHERE sp2.sale_id = s.id))::integer AS participant_count,
  s.sale_value / (1 + (SELECT count(*) FROM sale_partners sp2 WHERE sp2.sale_id = s.id))::numeric AS proportional_value,
  'partner'::text AS role
FROM sales s
JOIN sale_partners sp ON sp.sale_id = s.id;