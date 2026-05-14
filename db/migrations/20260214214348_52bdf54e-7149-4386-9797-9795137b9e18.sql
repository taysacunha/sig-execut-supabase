
CREATE OR REPLACE FUNCTION public.atualizar_status_ferias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Aprovada -> Em Gozo (periodo de gozo comecou)
  UPDATE ferias_ferias
  SET status = 'em_gozo', updated_at = now()
  WHERE status = 'aprovada'
    AND COALESCE(gozo_quinzena1_inicio, quinzena1_inicio) <= CURRENT_DATE
    AND COALESCE(gozo_quinzena2_fim, quinzena2_fim) >= CURRENT_DATE;

  -- Em Gozo -> Concluida (periodo de gozo terminou)
  UPDATE ferias_ferias
  SET status = 'concluida', updated_at = now()
  WHERE status = 'em_gozo'
    AND COALESCE(gozo_quinzena2_fim, quinzena2_fim) < CURRENT_DATE;
END;
$$;
