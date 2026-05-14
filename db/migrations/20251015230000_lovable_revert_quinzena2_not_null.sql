-- Migration: Revert quinzena2 columns back to NOT NULL
-- Always 2 official periods for the accountant

-- First fill any null records
UPDATE ferias_ferias 
SET quinzena2_inicio = quinzena1_inicio, quinzena2_fim = quinzena1_fim 
WHERE quinzena2_inicio IS NULL;

UPDATE ferias_ferias 
SET quinzena2_fim = quinzena1_fim 
WHERE quinzena2_fim IS NULL;

-- Now set NOT NULL constraints
ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_inicio SET NOT NULL;
ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_fim SET NOT NULL;
