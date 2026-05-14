-- Limpar duplicatas existentes na tabela generated_schedules
-- Mantém apenas a escala mais recente para cada week_start_date

-- 1. Primeiro, deletar as alocações das escalas duplicadas
DELETE FROM schedule_assignments
WHERE generated_schedule_id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY week_start_date 
        ORDER BY created_at DESC
      ) as rn
    FROM generated_schedules
  ) duplicates
  WHERE rn > 1
);

-- 2. Deletar validações das escalas duplicadas
DELETE FROM schedule_validation_results
WHERE schedule_id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY week_start_date 
        ORDER BY created_at DESC
      ) as rn
    FROM generated_schedules
  ) duplicates
  WHERE rn > 1
);

-- 3. Deletar as escalas duplicadas (mantendo a mais recente)
DELETE FROM generated_schedules
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY week_start_date 
        ORDER BY created_at DESC
      ) as rn
    FROM generated_schedules
  ) duplicates
  WHERE rn > 1
);

-- 4. Adicionar constraint de unicidade para prevenir futuras duplicatas
ALTER TABLE generated_schedules 
ADD CONSTRAINT unique_week_start_date UNIQUE (week_start_date);