-- Migration: Add enviado_contador columns to ferias_ferias
-- Allows tracking when vacation periods have been sent to the accountant

ALTER TABLE public.ferias_ferias ADD COLUMN IF NOT EXISTS enviado_contador boolean DEFAULT false;
ALTER TABLE public.ferias_ferias ADD COLUMN IF NOT EXISTS enviado_contador_em timestamptz;
