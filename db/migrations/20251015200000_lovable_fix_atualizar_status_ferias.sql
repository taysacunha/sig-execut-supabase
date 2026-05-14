-- Fix: atualizar_status_ferias to handle gozo_flexivel, gozo_diferente, and Q2 null
CREATE OR REPLACE FUNCTION public.atualizar_status_ferias()
RETURNS void AS $$
BEGIN
  -- Transition: aprovada → em_gozo
  UPDATE ferias_ferias f
  SET status = 'em_gozo', updated_at = now()
  WHERE f.status = 'aprovada'
    AND CURRENT_DATE >= (
      CASE
        WHEN f.gozo_flexivel = true THEN
          COALESCE(
            (SELECT MIN(gp.data_inicio) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id),
            f.quinzena1_inicio
          )
        WHEN f.gozo_diferente = true THEN
          COALESCE(f.gozo_quinzena1_inicio, f.quinzena1_inicio)
        ELSE
          f.quinzena1_inicio
      END
    );

  -- Transition: em_gozo → concluida
  UPDATE ferias_ferias f
  SET status = 'concluida', updated_at = now()
  WHERE f.status = 'em_gozo'
    AND CURRENT_DATE > (
      CASE
        WHEN f.gozo_flexivel = true THEN
          COALESCE(
            (SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id),
            COALESCE(f.quinzena2_fim, f.quinzena1_fim)
          )
        WHEN f.gozo_diferente = true THEN
          COALESCE(f.gozo_quinzena2_fim, f.gozo_quinzena1_fim, COALESCE(f.quinzena2_fim, f.quinzena1_fim))
        ELSE
          COALESCE(f.quinzena2_fim, f.quinzena1_fim)
      END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
