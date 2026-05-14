-- Atualizar locais que têm datas específicas configuradas para usar o modo correto
UPDATE locations 
SET shift_config_mode = 'specific_date' 
WHERE id IN (
  SELECT DISTINCT l.id 
  FROM locations l
  JOIN location_periods lp ON lp.location_id = l.id
  JOIN period_specific_day_configs psdc ON psdc.period_id = lp.id
  WHERE l.shift_config_mode = 'weekday' OR l.shift_config_mode IS NULL
);