ALTER TABLE public.ferias_formulario_anual
  ADD COLUMN IF NOT EXISTS periodo1_data date,
  ADD COLUMN IF NOT EXISTS periodo2_data date,
  ADD COLUMN IF NOT EXISTS periodo3_data date;

UPDATE public.ferias_formulario_anual f SET
  periodo1_data = COALESCE(f.periodo1_data, CASE
    WHEN f.data_inicio_preferencia IS NOT NULL AND extract(month from f.data_inicio_preferencia::date) = f.periodo1_mes THEN f.data_inicio_preferencia::date
    WHEN f.data_inicio_q2_preferencia IS NOT NULL AND extract(month from f.data_inicio_q2_preferencia::date) = f.periodo1_mes THEN f.data_inicio_q2_preferencia::date END),
  periodo2_data = COALESCE(f.periodo2_data, CASE
    WHEN f.data_inicio_preferencia IS NOT NULL AND extract(month from f.data_inicio_preferencia::date) = f.periodo2_mes THEN f.data_inicio_preferencia::date
    WHEN f.data_inicio_q2_preferencia IS NOT NULL AND extract(month from f.data_inicio_q2_preferencia::date) = f.periodo2_mes THEN f.data_inicio_q2_preferencia::date END),
  periodo3_data = COALESCE(f.periodo3_data, CASE
    WHEN f.data_inicio_preferencia IS NOT NULL AND extract(month from f.data_inicio_preferencia::date) = f.periodo3_mes THEN f.data_inicio_preferencia::date
    WHEN f.data_inicio_q2_preferencia IS NOT NULL AND extract(month from f.data_inicio_q2_preferencia::date) = f.periodo3_mes THEN f.data_inicio_q2_preferencia::date END);