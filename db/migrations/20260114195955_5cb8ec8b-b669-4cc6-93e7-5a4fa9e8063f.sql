-- Corrigir configuração de Tambaú sábado para mínimo 2 corretores
UPDATE period_day_configs
SET max_brokers_count = 2
WHERE period_id = '88334c6a-5238-48ee-be1a-52f8c2003c72'
  AND weekday = 'saturday';