-- Add broker_eligibility_map column to schedule_validation_results
ALTER TABLE public.schedule_validation_results
ADD COLUMN IF NOT EXISTS broker_eligibility_map jsonb DEFAULT NULL;

COMMENT ON COLUMN public.schedule_validation_results.broker_eligibility_map IS 'Mapa de elegibilidade por corretor para locais externos, persistido para a aba Vínculos';
