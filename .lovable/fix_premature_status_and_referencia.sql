-- Fix 1: Update NULL referencia_periodo in existing gozo_periodos records
-- Records without referencia_periodo should default to 1 (first period)
UPDATE ferias_gozo_periodos
SET referencia_periodo = 1
WHERE referencia_periodo IS NULL;

-- Fix 2: Rewrite atualizar_status_ferias with reverse transition safety
-- If em_gozo_q1 but gozo hasn't actually started, revert to aprovada
CREATE OR REPLACE FUNCTION public.atualizar_status_ferias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ===== SAFETY: Revert premature em_gozo_q1 → aprovada =====
  -- If status is em_gozo_q1 but the actual gozo start date hasn't been reached yet
  UPDATE ferias_ferias f
  SET status = 'aprovada', updated_at = now()
  WHERE f.status = 'em_gozo_q1'
    AND CURRENT_DATE < (
      CASE
        WHEN f.gozo_flexivel = true THEN
          COALESCE(
            (SELECT MIN(gp.data_inicio) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 1),
            (SELECT MIN(gp.data_inicio) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id),
            f.quinzena1_inicio
          )
        WHEN f.gozo_diferente = true THEN
          COALESCE(f.gozo_quinzena1_inicio, f.quinzena1_inicio)
        ELSE
          f.quinzena1_inicio
      END
    );

  -- ===== Transition 1: aprovada → em_gozo_q1 =====
  UPDATE ferias_ferias f
  SET status = 'em_gozo_q1', updated_at = now()
  WHERE f.status = 'aprovada'
    AND CURRENT_DATE >= (
      CASE
        WHEN f.gozo_flexivel = true THEN
          COALESCE(
            (SELECT MIN(gp.data_inicio) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 1),
            (SELECT MIN(gp.data_inicio) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id),
            f.quinzena1_inicio
          )
        WHEN f.gozo_diferente = true THEN
          COALESCE(f.gozo_quinzena1_inicio, f.quinzena1_inicio)
        ELSE
          f.quinzena1_inicio
      END
    );

  -- ===== Transition 2: em_gozo_q1 → q1_concluida (or concluida if no Q2) =====
  UPDATE ferias_ferias f
  SET status = CASE
      WHEN COALESCE(f.quinzena2_inicio, f.gozo_quinzena2_inicio,
        (SELECT MIN(gp.data_inicio) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2)
      ) IS NOT NULL THEN 'q1_concluida'
      ELSE 'concluida'
    END,
    updated_at = now()
  WHERE f.status = 'em_gozo_q1'
    AND CURRENT_DATE > (
      CASE
        WHEN f.gozo_flexivel = true THEN
          COALESCE(
            (SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 1),
            (SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id),
            f.quinzena1_fim
          )
        WHEN f.gozo_diferente = true THEN
          COALESCE(f.gozo_quinzena1_fim, f.quinzena1_fim)
        ELSE
          f.quinzena1_fim
      END
    );

  -- ===== Transition 3: q1_concluida → em_gozo_q2 =====
  UPDATE ferias_ferias f
  SET status = 'em_gozo_q2', updated_at = now()
  WHERE f.status = 'q1_concluida'
    AND CURRENT_DATE >= (
      CASE
        WHEN f.gozo_flexivel = true THEN
          COALESCE(
            (SELECT MIN(gp.data_inicio) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2),
            f.quinzena2_inicio
          )
        WHEN f.gozo_diferente = true THEN
          COALESCE(f.gozo_quinzena2_inicio, f.quinzena2_inicio)
        ELSE
          f.quinzena2_inicio
      END
    );

  -- ===== Transition 4: em_gozo_q2 → concluida =====
  UPDATE ferias_ferias f
  SET status = 'concluida', updated_at = now()
  WHERE f.status = 'em_gozo_q2'
    AND CURRENT_DATE > (
      CASE
        WHEN f.gozo_flexivel = true THEN
          COALESCE(
            (SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2),
            COALESCE(f.quinzena2_fim, f.quinzena1_fim)
          )
        WHEN f.gozo_diferente = true THEN
          COALESCE(f.gozo_quinzena2_fim, f.quinzena2_fim)
        ELSE
          f.quinzena2_fim
      END
    );

  -- ===== Legacy cleanup: any remaining em_gozo → route through new flow =====
  UPDATE ferias_ferias f
  SET status = 'em_gozo_q1', updated_at = now()
  WHERE f.status = 'em_gozo';
END;
$$;
