-- ============================================================
-- RLS Security Fixes
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Habilitar RLS no dev_tracker (JÁ EXECUTADO)
ALTER TABLE public.dev_tracker ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admin/super_admin podem ler e modificar
DROP POLICY IF EXISTS "Admins can manage dev_tracker" ON public.dev_tracker;
CREATE POLICY "Admins can manage dev_tracker"
  ON public.dev_tracker
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 2. Corrigir ferias_folgas_creditos - remover policy permissiva (JÁ EXECUTADO)
DROP POLICY IF EXISTS "Authenticated users can manage credits" ON public.ferias_folgas_creditos;

DROP POLICY IF EXISTS "Users with ferias access can view credits" ON public.ferias_folgas_creditos;
CREATE POLICY "Users with ferias access can view credits"
  ON public.ferias_folgas_creditos
  FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "Users with ferias edit can insert credits" ON public.ferias_folgas_creditos;
CREATE POLICY "Users with ferias edit can insert credits"
  ON public.ferias_folgas_creditos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "Users with ferias edit can update credits" ON public.ferias_folgas_creditos;
CREATE POLICY "Users with ferias edit can update credits"
  ON public.ferias_folgas_creditos
  FOR UPDATE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'ferias'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "Users with ferias edit can delete credits" ON public.ferias_folgas_creditos;
CREATE POLICY "Users with ferias edit can delete credits"
  ON public.ferias_folgas_creditos
  FOR DELETE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'ferias'));

-- ============================================================
-- 3. Corrigir schedule_observations - remover policies permissivas
-- Execute este bloco no SQL Editor do Supabase Dashboard
-- ============================================================

-- Remover policies permissivas existentes
DROP POLICY IF EXISTS "Authenticated users can delete observations" ON public.schedule_observations;
DROP POLICY IF EXISTS "Authenticated users can insert observations" ON public.schedule_observations;
DROP POLICY IF EXISTS "Authenticated users can update observations" ON public.schedule_observations;
DROP POLICY IF EXISTS "Authenticated users can view observations" ON public.schedule_observations;

-- Novas policies restritivas baseadas no sistema escalas
DROP POLICY IF EXISTS "Escalas users can view observations" ON public.schedule_observations;
CREATE POLICY "Escalas users can view observations"
  ON public.schedule_observations
  FOR SELECT TO authenticated
  USING (public.can_view_system(auth.uid(), 'escalas'));

DROP POLICY IF EXISTS "Escalas editors can insert observations" ON public.schedule_observations;
CREATE POLICY "Escalas editors can insert observations"
  ON public.schedule_observations
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_system(auth.uid(), 'escalas'));

DROP POLICY IF EXISTS "Escalas editors can update observations" ON public.schedule_observations;
CREATE POLICY "Escalas editors can update observations"
  ON public.schedule_observations
  FOR UPDATE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'escalas'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'escalas'));

DROP POLICY IF EXISTS "Escalas editors can delete observations" ON public.schedule_observations;
CREATE POLICY "Escalas editors can delete observations"
  ON public.schedule_observations
  FOR DELETE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'escalas'));
