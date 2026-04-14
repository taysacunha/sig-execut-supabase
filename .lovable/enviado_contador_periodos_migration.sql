-- Migration: Add granular per-period tracking for enviado_contador
-- Execute no SQL Editor do Supabase Dashboard

ALTER TABLE public.ferias_ferias ADD COLUMN IF NOT EXISTS enviado_contador_q1 boolean DEFAULT false;
ALTER TABLE public.ferias_ferias ADD COLUMN IF NOT EXISTS enviado_contador_q2 boolean DEFAULT false;

-- Backfill: if enviado_contador is already true, mark both q1 and q2 as sent
UPDATE public.ferias_ferias
SET enviado_contador_q1 = true,
    enviado_contador_q2 = CASE WHEN quinzena2_inicio IS NOT NULL THEN true ELSE false END
WHERE enviado_contador = true;
