-- Adicionar weekday_shift_availability na tabela brokers
ALTER TABLE brokers 
ADD COLUMN weekday_shift_availability JSONB;

-- Adicionar weekday_shift_availability na tabela location_brokers
ALTER TABLE location_brokers 
ADD COLUMN weekday_shift_availability JSONB;

-- Migrar dados existentes em brokers: assumir todos os turnos nos dias disponíveis
UPDATE brokers 
SET weekday_shift_availability = jsonb_build_object(
  'monday', CASE WHEN 'monday' = ANY(available_weekdays) THEN '["morning","afternoon"]'::jsonb ELSE '[]'::jsonb END,
  'tuesday', CASE WHEN 'tuesday' = ANY(available_weekdays) THEN '["morning","afternoon"]'::jsonb ELSE '[]'::jsonb END,
  'wednesday', CASE WHEN 'wednesday' = ANY(available_weekdays) THEN '["morning","afternoon"]'::jsonb ELSE '[]'::jsonb END,
  'thursday', CASE WHEN 'thursday' = ANY(available_weekdays) THEN '["morning","afternoon"]'::jsonb ELSE '[]'::jsonb END,
  'friday', CASE WHEN 'friday' = ANY(available_weekdays) THEN '["morning","afternoon"]'::jsonb ELSE '[]'::jsonb END,
  'saturday', CASE WHEN 'saturday' = ANY(available_weekdays) THEN '["morning","afternoon"]'::jsonb ELSE '[]'::jsonb END,
  'sunday', CASE WHEN 'sunday' = ANY(available_weekdays) THEN '["morning","afternoon"]'::jsonb ELSE '[]'::jsonb END
)
WHERE weekday_shift_availability IS NULL;

-- Migrar dados existentes em location_brokers baseado nos campos atuais
UPDATE location_brokers lb
SET weekday_shift_availability = (
  SELECT jsonb_build_object(
    'monday', CASE WHEN 'monday' = ANY(b.available_weekdays) THEN 
      CASE 
        WHEN lb.available_morning AND lb.available_afternoon THEN '["morning","afternoon"]'::jsonb
        WHEN lb.available_morning THEN '["morning"]'::jsonb
        WHEN lb.available_afternoon THEN '["afternoon"]'::jsonb
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb END,
    'tuesday', CASE WHEN 'tuesday' = ANY(b.available_weekdays) THEN 
      CASE 
        WHEN lb.available_morning AND lb.available_afternoon THEN '["morning","afternoon"]'::jsonb
        WHEN lb.available_morning THEN '["morning"]'::jsonb
        WHEN lb.available_afternoon THEN '["afternoon"]'::jsonb
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb END,
    'wednesday', CASE WHEN 'wednesday' = ANY(b.available_weekdays) THEN 
      CASE 
        WHEN lb.available_morning AND lb.available_afternoon THEN '["morning","afternoon"]'::jsonb
        WHEN lb.available_morning THEN '["morning"]'::jsonb
        WHEN lb.available_afternoon THEN '["afternoon"]'::jsonb
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb END,
    'thursday', CASE WHEN 'thursday' = ANY(b.available_weekdays) THEN 
      CASE 
        WHEN lb.available_morning AND lb.available_afternoon THEN '["morning","afternoon"]'::jsonb
        WHEN lb.available_morning THEN '["morning"]'::jsonb
        WHEN lb.available_afternoon THEN '["afternoon"]'::jsonb
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb END,
    'friday', CASE WHEN 'friday' = ANY(b.available_weekdays) THEN 
      CASE 
        WHEN lb.available_morning AND lb.available_afternoon THEN '["morning","afternoon"]'::jsonb
        WHEN lb.available_morning THEN '["morning"]'::jsonb
        WHEN lb.available_afternoon THEN '["afternoon"]'::jsonb
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb END,
    'saturday', CASE WHEN 'saturday' = ANY(b.available_weekdays) THEN 
      CASE 
        WHEN lb.available_morning AND lb.available_afternoon THEN '["morning","afternoon"]'::jsonb
        WHEN lb.available_morning THEN '["morning"]'::jsonb
        WHEN lb.available_afternoon THEN '["afternoon"]'::jsonb
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb END,
    'sunday', CASE WHEN 'sunday' = ANY(b.available_weekdays) THEN 
      CASE 
        WHEN lb.available_morning AND lb.available_afternoon THEN '["morning","afternoon"]'::jsonb
        WHEN lb.available_morning THEN '["morning"]'::jsonb
        WHEN lb.available_afternoon THEN '["afternoon"]'::jsonb
        ELSE '[]'::jsonb
      END
    ELSE '[]'::jsonb END
  )
  FROM brokers b WHERE b.id = lb.broker_id
)
WHERE lb.weekday_shift_availability IS NULL;