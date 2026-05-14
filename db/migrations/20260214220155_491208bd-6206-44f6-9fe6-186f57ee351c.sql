-- Drop old constraint and add new one with correct status values
ALTER TABLE ferias_ferias DROP CONSTRAINT IF EXISTS ferias_ferias_status_check;
ALTER TABLE ferias_ferias ADD CONSTRAINT ferias_ferias_status_check 
  CHECK (status = ANY (ARRAY['aprovada', 'em_gozo', 'concluida', 'cancelada']));

-- Update the atualizar_status_ferias function to use correct values
CREATE OR REPLACE FUNCTION public.atualizar_status_ferias()
RETURNS void AS $$
BEGIN
  -- Aprovada -> Em Gozo (vacation period started)
  UPDATE ferias_ferias
  SET status = 'em_gozo', updated_at = now()
  WHERE status = 'aprovada'
    AND COALESCE(gozo_quinzena1_inicio, quinzena1_inicio) <= CURRENT_DATE
    AND COALESCE(gozo_quinzena2_fim, quinzena2_fim) >= CURRENT_DATE;

  -- Em Gozo -> Concluida (vacation period ended)
  UPDATE ferias_ferias
  SET status = 'concluida', updated_at = now()
  WHERE status = 'em_gozo'
    AND COALESCE(gozo_quinzena2_fim, quinzena2_fim) < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;