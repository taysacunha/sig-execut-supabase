-- Permite que o perfil SUPERVISOR dê entrada/ajuste/transferência de saldos
-- no módulo Estoque, sem precisar do perfil Administrador (que libera páginas
-- administrativas de outros módulos, como "Permissões por Aba" em Despesas).
--
-- Regra: super_admin, admin ou supervisor + acesso de edição ao sistema 'estoque'.

-- ── estoque_saldos ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users with edit access can insert estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Users with edit access can update estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Users with edit access can delete estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Admin/Super can insert estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Admin/Super can update estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Admin/Super can delete estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Gestao estoque can insert estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Gestao estoque can update estoque_saldos" ON public.estoque_saldos;
DROP POLICY IF EXISTS "Gestao estoque can delete estoque_saldos" ON public.estoque_saldos;

CREATE POLICY "Gestao estoque can insert estoque_saldos"
  ON public.estoque_saldos FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  );

CREATE POLICY "Gestao estoque can update estoque_saldos"
  ON public.estoque_saldos FOR UPDATE TO authenticated
  USING (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  )
  WITH CHECK (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  );

CREATE POLICY "Gestao estoque can delete estoque_saldos"
  ON public.estoque_saldos FOR DELETE TO authenticated
  USING (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  );

-- ── estoque_movimentacoes ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users with edit access can insert estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Users with edit access can update estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Users with edit access can delete estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Admin/Super can insert estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Admin/Super can update estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Admin/Super can delete estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Gestao estoque can insert estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Gestao estoque can update estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Gestao estoque can delete estoque_movimentacoes" ON public.estoque_movimentacoes;

CREATE POLICY "Gestao estoque can insert estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  );

CREATE POLICY "Gestao estoque can update estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR UPDATE TO authenticated
  USING (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  )
  WITH CHECK (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  );

CREATE POLICY "Gestao estoque can delete estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR DELETE TO authenticated
  USING (
    (
      public.is_admin_or_super(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
    AND public.can_edit_system(auth.uid(), 'estoque')
  );
