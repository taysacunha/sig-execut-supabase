-- ============================================================
-- Fix: ferias_afastamentos - Atualizar CHECK constraint do motivo
-- Sincroniza valores aceitos no banco com os usados no frontend
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

ALTER TABLE public.ferias_afastamentos
  DROP CONSTRAINT IF EXISTS ferias_afastamentos_motivo_check;

-- Normalizar valores legados para os motivos atualmente suportados pela UI.
-- Mapeamentos conservadores; o que não for reconhecido vira 'outros'.
UPDATE public.ferias_afastamentos
   SET motivo = CASE motivo
     WHEN 'doenca'          THEN 'atestado_medico'
     WHEN 'acidente'        THEN 'atestado_medico'
     WHEN 'licenca_medica'  THEN 'atestado_medico'
     WHEN 'atestado'        THEN 'atestado_medico'
     WHEN 'maternidade'     THEN 'licenca_maternidade'
     WHEN 'paternidade'     THEN 'licenca_paternidade'
     WHEN 'familiar'        THEN 'acompanhamento_familiar'
     WHEN 'sangue'          THEN 'doacao_sangue'
     ELSE 'outros'
   END
 WHERE motivo NOT IN (
   'atestado_medico',
   'acompanhamento_familiar',
   'doacao_sangue',
   'licenca_maternidade',
   'licenca_paternidade',
   'outros'
 );

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