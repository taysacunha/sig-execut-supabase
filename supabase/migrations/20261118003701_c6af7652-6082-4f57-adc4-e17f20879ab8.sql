ALTER TABLE public.ferias_formulario_anual DROP CONSTRAINT IF EXISTS ferias_formulario_anual_status_check;
ALTER TABLE public.ferias_formulario_anual ADD CONSTRAINT ferias_formulario_anual_status_check
  CHECK (status = ANY (ARRAY['pendente','cadastrado','gerado','aprovado','rejeitado']));

UPDATE public.ferias_formulario_anual f
SET status = 'aprovado'
WHERE f.status = 'pendente'
  AND EXISTS (
    SELECT 1 FROM public.ferias_ferias ff
    WHERE ff.colaborador_id = f.colaborador_id
      AND ff.origem = 'formulario_anual'
      AND ff.status IN ('aprovada','em_gozo','concluida')
      AND EXTRACT(YEAR FROM ff.quinzena1_inicio) = f.ano_referencia
  );