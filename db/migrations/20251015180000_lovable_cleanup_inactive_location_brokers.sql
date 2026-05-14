-- Cleanup: Remove location_brokers records for inactive brokers
-- These records were created before the automatic cleanup logic was added
DELETE FROM location_brokers 
WHERE broker_id IN (
  SELECT id FROM brokers WHERE is_active = false
);
