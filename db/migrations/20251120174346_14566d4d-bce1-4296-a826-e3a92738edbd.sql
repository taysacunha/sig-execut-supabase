-- Fix security issue: set search_path for handle_updated_at function
-- This prevents potential security vulnerabilities by ensuring the function
-- only searches in the public schema and temporary tables

ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;