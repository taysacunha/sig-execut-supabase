-- Corrige a constraint de motivo em ferias_folgas_perdas para aceitar
-- as chaves usadas pelo PerdaFolgaDialog (e normaliza dados antigos
-- que possam ter sido salvos com rótulos em português).

ALTER TABLE public.ferias_folgas_perdas
  DROP CONSTRAINT IF EXISTS ferias_folgas_perdas_motivo_check;

UPDATE public.ferias_folgas_perdas SET motivo = 'falta_injustificada'
  WHERE motivo ILIKE 'falta injustificada';
UPDATE public.ferias_folgas_perdas SET motivo = 'atestado_medico'
  WHERE motivo ILIKE 'atestado m%dico' OR motivo ILIKE 'atestado medico';
UPDATE public.ferias_folgas_perdas SET motivo = 'aviso_previo'
  WHERE motivo ILIKE 'aviso pr%vio' OR motivo ILIKE 'aviso previo';
UPDATE public.ferias_folgas_perdas SET motivo = 'suspensao'
  WHERE motivo ILIKE 'suspens%o disciplinar' OR motivo ILIKE 'suspensao%';
UPDATE public.ferias_folgas_perdas SET motivo = 'outro'
  WHERE motivo ILIKE 'outro%';

ALTER TABLE public.ferias_folgas_perdas
  ADD CONSTRAINT ferias_folgas_perdas_motivo_check
  CHECK (motivo IN (
    'falta_injustificada',
    'atestado_medico',
    'atestado_sabado',
    'aviso_previo',
    'suspensao',
    'outro'
  ));