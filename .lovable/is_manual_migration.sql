-- Add is_manual column to schedule_assignments
ALTER TABLE schedule_assignments ADD COLUMN is_manual boolean NOT NULL DEFAULT false;
