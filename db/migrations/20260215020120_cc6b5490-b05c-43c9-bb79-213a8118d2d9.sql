-- Add observacao column to ferias_formulario_anual
ALTER TABLE public.ferias_formulario_anual ADD COLUMN IF NOT EXISTS observacao text;