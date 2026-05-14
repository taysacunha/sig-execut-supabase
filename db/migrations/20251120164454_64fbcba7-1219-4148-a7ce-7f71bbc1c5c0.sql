-- Corrigir max_brokers_count de locais internos para sempre ser 1
UPDATE period_day_configs pdc
SET max_brokers_count = 1
FROM location_periods lp
JOIN locations l ON lp.location_id = l.id
WHERE pdc.period_id = lp.id
  AND l.location_type = 'internal';