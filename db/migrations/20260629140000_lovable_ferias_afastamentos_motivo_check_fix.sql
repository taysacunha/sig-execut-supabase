-- ============================================================
-- Fix: ferias_afastamentos - Atualizar CHECK constraint do motivo
-- Sincroniza valores aceitos no banco com os usados no frontend
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

ALTER TABLE public.ferias_afastamentos
  DROP CONSTRAINT IF EXISTS ferias_afastamentos_motivo_check;

ALTER TABLE public.ferias_afastamentos
  ADD CONSTRAINT ferias_afastamentos_motivo_check
  CHECK (motivo IN (
    'atestado_medico',
    'acompanhamento_familiar',
    'doacao_sangue',
    'licenca_maternidade',
    'licenca_paternidade',
    'outros'
  ));