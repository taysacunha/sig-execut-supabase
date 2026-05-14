-- Corrigir os vínculos de João Marcos nos locais para usar a disponibilidade correta do corretor
UPDATE location_brokers lb
SET weekday_shift_availability = b.weekday_shift_availability
FROM brokers b
WHERE lb.broker_id = b.id
AND b.name ILIKE '%joão marcos%';