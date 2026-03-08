-- ============================================================
-- RLS Security Fixes
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Habilitar RLS no dev_tracker
ALTER TABLE public.dev_tracker ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admin/super_admin podem ler e modificar
CREATE POLICY "Admins can manage dev_tracker"
  ON public.dev_tracker
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 2. Corrigir ferias_folgas_creditos - remover policy permissiva
DROP POLICY IF EXISTS "Authenticated users can manage credits" ON public.ferias_folgas_creditos;

-- SELECT: qualquer autenticado com acesso ao sistema ferias pode visualizar
CREATE POLICY "Users with ferias access can view credits"
  ON public.ferias_folgas_creditos
  FOR SELECT
  TO authenticated
  USING (public.has_system_access(auth.uid(), 'ferias'));

-- INSERT: apenas quem pode editar o sistema ferias
CREATE POLICY "Users with ferias edit can insert credits"
  ON public.ferias_folgas_creditos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- UPDATE: apenas quem pode editar o sistema ferias
CREATE POLICY "Users with ferias edit can update credits"
  ON public.ferias_folgas_creditos
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_system(auth.uid(), 'ferias'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- DELETE: apenas quem pode editar o sistema ferias
CREATE POLICY "Users with ferias edit can delete credits"
  ON public.ferias_folgas_creditos
  FOR DELETE
  TO authenticated
  USING (public.can_edit_system(auth.uid(), 'ferias'));
