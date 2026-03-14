-- Deterministic status reconciliation for ferias_ferias
-- Uses interval-based EXISTS for flexible vacations (not MIN/MAX ranges)
-- Run this in the Supabase SQL Editor

-- Step 1: Sanitize NULL referencia_periodo
UPDATE ferias_gozo_periodos
SET referencia_periodo = 1
WHERE referencia_periodo IS NULL;

-- Step 2: Rewrite function with interval-based logic
CREATE OR REPLACE FUNCTION public.atualizar_status_ferias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ========== FLEXIBLE VACATIONS (gozo_flexivel = true) ==========
  -- Uses EXISTS on actual sub-period intervals, NOT MIN/MAX ranges
  UPDATE ferias_ferias f
  SET status = (
    CASE
      -- Currently inside a Q2 sub-period
      WHEN EXISTS (
        SELECT 1 FROM ferias_gozo_periodos gp
        WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2
          AND CURRENT_DATE BETWEEN gp.data_inicio AND gp.data_fim
      ) THEN 'em_gozo_q2'

      -- Currently inside a Q1 sub-period
      WHEN EXISTS (
        SELECT 1 FROM ferias_gozo_periodos gp
        WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 1
          AND CURRENT_DATE BETWEEN gp.data_inicio AND gp.data_fim
      ) THEN 'em_gozo_q1'

      -- All Q2 sub-periods finished
      WHEN EXISTS (
        SELECT 1 FROM ferias_gozo_periodos gp
        WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2
      ) AND CURRENT_DATE > (
        SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp
        WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2
      ) THEN 'concluida'

      -- All Q1 sub-periods finished, Q2 exists but hasn't started yet
      WHEN CURRENT_DATE > (
        SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp
        WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 1
      ) AND (
        EXISTS (
          SELECT 1 FROM ferias_gozo_periodos gp
          WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 2
        ) OR f.quinzena2_inicio IS NOT NULL
      ) THEN 'q1_concluida'

      -- All Q1 sub-periods finished, no Q2 at all
      WHEN CURRENT_DATE > (
        SELECT MAX(gp.data_fim) FROM ferias_gozo_periodos gp
        WHERE gp.ferias_id = f.id AND gp.referencia_periodo = 1
      ) THEN 'concluida'

      -- Default: before first sub-period or in a gap between sub-periods
      ELSE 'aprovada'
    END
  ),
  updated_at = now()
  WHERE f.gozo_flexivel = true
    AND f.status IN ('aprovada', 'em_gozo', 'em_gozo_q1', 'q1_concluida', 'em_gozo_q2', 'concluida')
    AND EXISTS (
      SELECT 1 FROM ferias_gozo_periodos gp WHERE gp.ferias_id = f.id
    );

  -- ========== GOZO DIFERENTE (continuous range, not flexible) ==========
  UPDATE ferias_ferias f
  SET status = (
    SELECT CASE
      WHEN CURRENT_DATE < q1_start THEN 'aprovada'
      WHEN CURRENT_DATE >= q1_start AND CURRENT_DATE <= q1_end THEN 'em_gozo_q1'
      WHEN CURRENT_DATE > q1_end AND q2_start IS NULL THEN 'concluida'
      WHEN CURRENT_DATE > q1_end AND q2_start IS NOT NULL AND CURRENT_DATE < q2_start THEN 'q1_concluida'
      WHEN q2_start IS NOT NULL AND q2_end IS NOT NULL AND CURRENT_DATE >= q2_start AND CURRENT_DATE <= q2_end THEN 'em_gozo_q2'
      WHEN q2_end IS NOT NULL AND CURRENT_DATE > q2_end THEN 'concluida'
      ELSE f.status
    END
    FROM (
      SELECT
        COALESCE(f.gozo_quinzena1_inicio, f.quinzena1_inicio) AS q1_start,
        COALESCE(f.gozo_quinzena1_fim, f.quinzena1_fim) AS q1_end,
        COALESCE(f.gozo_quinzena2_inicio, f.quinzena2_inicio) AS q2_start,
        COALESCE(f.gozo_quinzena2_fim, f.quinzena2_fim) AS q2_end
    ) dates
  ),
  updated_at = now()
  WHERE f.gozo_diferente = true
    AND (f.gozo_flexivel IS NOT true)
    AND f.status IN ('aprovada', 'em_gozo', 'em_gozo_q1', 'q1_concluida', 'em_gozo_q2', 'concluida');

  -- ========== STANDARD VACATIONS (official quinzena dates) ==========
  UPDATE ferias_ferias f
  SET status = (
    SELECT CASE
      WHEN CURRENT_DATE < f.quinzena1_inicio THEN 'aprovada'
      WHEN CURRENT_DATE >= f.quinzena1_inicio AND CURRENT_DATE <= f.quinzena1_fim THEN 'em_gozo_q1'
      WHEN CURRENT_DATE > f.quinzena1_fim AND f.quinzena2_inicio IS NULL THEN 'concluida'
      WHEN CURRENT_DATE > f.quinzena1_fim AND f.quinzena2_inicio IS NOT NULL AND CURRENT_DATE < f.quinzena2_inicio THEN 'q1_concluida'
      WHEN f.quinzena2_inicio IS NOT NULL AND f.quinzena2_fim IS NOT NULL AND CURRENT_DATE >= f.quinzena2_inicio AND CURRENT_DATE <= f.quinzena2_fim THEN 'em_gozo_q2'
      WHEN f.quinzena2_fim IS NOT NULL AND CURRENT_DATE > f.quinzena2_fim THEN 'concluida'
      ELSE f.status
    END
  ),
  updated_at = now()
  WHERE (f.gozo_flexivel IS NOT true)
    AND (f.gozo_diferente IS NOT true)
    AND f.status IN ('aprovada', 'em_gozo', 'em_gozo_q1', 'q1_concluida', 'em_gozo_q2', 'concluida');

  -- ========== LEGACY CLEANUP ==========
  UPDATE ferias_ferias f
  SET status = 'em_gozo_q1', updated_at = now()
  WHERE f.status = 'em_gozo';
END;
$$;

-- Step 3: Run immediately to reconcile all existing records
SELECT atualizar_status_ferias();
