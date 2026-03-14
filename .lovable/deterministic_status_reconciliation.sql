-- Deterministic status reconciliation for ferias_ferias
-- Calculates status purely from dates, independent of current status
-- Run this in the Supabase SQL Editor

-- Step 1: Sanitize NULL referencia_periodo
UPDATE ferias_gozo_periodos
SET referencia_periodo = 1
WHERE referencia_periodo IS NULL;

-- Step 2: Rewrite function with deterministic logic
CREATE OR REPLACE FUNCTION public.atualizar_status_ferias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deterministic reconciliation: compute status from dates alone
  -- This does NOT depend on the current status value
  UPDATE ferias_ferias f
  SET status = (
    SELECT CASE
      -- Before Q1 starts
      WHEN CURRENT_DATE < q1_start THEN 'aprovada'
      -- During Q1
      WHEN CURRENT_DATE >= q1_start AND CURRENT_DATE <= q1_end THEN 'em_gozo_q1'
      -- After Q1 ended, no Q2 exists
      WHEN CURRENT_DATE > q1_end AND q2_start IS NULL THEN 'concluida'
      -- Between Q1 end and Q2 start
      WHEN CURRENT_DATE > q1_end AND q2_start IS NOT NULL AND CURRENT_DATE < q2_start THEN 'q1_concluida'
      -- During Q2
      WHEN q2_start IS NOT NULL AND q2_end IS NOT NULL AND CURRENT_DATE >= q2_start AND CURRENT_DATE <= q2_end THEN 'em_gozo_q2'
      -- After Q2 ended
      WHEN q2_end IS NOT NULL AND CURRENT_DATE > q2_end THEN 'concluida'
      -- Fallback: keep current
      ELSE f.status
    END
    FROM (
      SELECT
        -- Q1 real start
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
        END AS q1_start,
        -- Q1 real end
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
        END AS q1_end,
        -- Q2 real start (NULL if no Q2)
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
        END AS q2_start,
        -- Q2 real end (NULL if no Q2)
        CASE
          WHEN f.gozo_flexivel = true THEN
            COALESCE(
              (SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2),
              f.quinzena2_fim
            )
          WHEN f.gozo_diferente = true THEN
            COALESCE(f.gozo_quinzena2_fim, f.quinzena2_fim)
          ELSE
            f.quinzena2_fim
        END AS q2_end
    ) dates
  ),
  updated_at = now()
  WHERE f.status IN ('aprovada', 'em_gozo', 'em_gozo_q1', 'q1_concluida', 'em_gozo_q2', 'concluida');
END;
$$;

-- Step 3: Run immediately to fix all existing records
SELECT atualizar_status_ferias();
