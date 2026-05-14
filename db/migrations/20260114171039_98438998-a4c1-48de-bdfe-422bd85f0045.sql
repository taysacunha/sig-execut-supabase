-- FASE 1A: Adicionar novos valores ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collaborator';