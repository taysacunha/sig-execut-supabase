-- ============================================================
-- Fix: ferias_afastamentos - Replace permissive RLS policies
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- Remove permissive policies
DROP POLICY IF EXISTS "Authenticated users can read afastamentos" ON public.ferias_afastamentos;
DROP POLICY IF EXISTS "Authenticated users can insert afastamentos" ON public.ferias_afastamentos;
DROP POLICY IF EXISTS "Authenticated users can update afastamentos" ON public.ferias_afastamentos;
DROP POLICY IF EXISTS "Authenticated users can delete afastamentos" ON public.ferias_afastamentos;

-- New restrictive policies using ferias system access
CREATE POLICY "Ferias users can view afastamentos"
  ON public.ferias_afastamentos
  FOR SELECT TO authenticated
  USING (public.can_view_system(auth.uid(), 'ferias'));

CREATE POLICY "Ferias editors can insert afastamentos"
  ON public.ferias_afastamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

CREATE POLICY "Ferias editors can update afastamentos"
  ON public.ferias_afastamentos
  FOR UPDATE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'ferias'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

CREATE POLICY "Ferias editors can delete afastamentos"
  ON public.ferias_afastamentos
  FOR DELETE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'ferias'));
