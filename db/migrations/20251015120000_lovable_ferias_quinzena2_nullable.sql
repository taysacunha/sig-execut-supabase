-- Migration: Allow single-period vacation registrations
-- Makes quinzena2_inicio and quinzena2_fim nullable in ferias_ferias

ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_inicio DROP NOT NULL;
ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_fim DROP NOT NULL;
