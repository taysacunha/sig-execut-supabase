-- =============================================
-- RLS: Restringir INSERT/UPDATE/DELETE em estoque_saldos
-- e estoque_movimentacoes a Super Admin / Admin
-- Execute no SQL Editor do Supabase
-- =============================================

-- estoque_saldos
DROP POLICY IF EXISTS "Users with edit access can insert estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Users with edit access can update estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Users with edit access can delete estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Admin/Super can insert estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Admin/Super can update estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Admin/Super can delete estoque_saldos" ON public.estoque_saldos;

CREATE POLICY "Admin/Super can insert estoque_saldos"
  ON public.estoque_saldos FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );

CREATE POLICY "Admin/Super can update estoque_saldos"
  ON public.estoque_saldos FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  )
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );

CREATE POLICY "Admin/Super can delete estoque_saldos"
  ON public.estoque_saldos FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );

-- estoque_movimentacoes
DROP POLICY IF EXISTS "Users with edit access can insert estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Users with edit access can update estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Users with edit access can delete estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Admin/Super can insert estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Admin/Super can update estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Admin/Super can delete estoque_movimentacoes" ON public.estoque_movimentacoes;

CREATE POLICY "Admin/Super can insert estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );

CREATE POLICY "Admin/Super can update estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  )
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );

CREATE POLICY "Admin/Super can delete estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    AND public.has_system_access(auth.uid(), 'estoque')
  );