-- Restaura o critério anterior de movimentação de estoque:
-- basta ter permissão de EDIÇÃO no sistema 'estoque' (system_access = view_edit).
--
-- Contexto: a migration 20260815120000 restringiu INSERT/UPDATE/DELETE de
-- estoque_saldos e estoque_movimentacoes a admin/super_admin/supervisor,
-- o que bloqueou usuários operacionais (apoio) que faziam entrada, ajuste e saída.
-- Supervisores e admins continuam cobertos, pois também possuem edição no módulo.

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

CREATE POLICY "Users with edit access can insert estoque_saldos"
  ON public.estoque_saldos FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

CREATE POLICY "Users with edit access can update estoque_saldos"
  ON public.estoque_saldos FOR UPDATE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'estoque'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

CREATE POLICY "Users with edit access can delete estoque_saldos"
  ON public.estoque_saldos FOR DELETE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'estoque'));

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

CREATE POLICY "Users with edit access can insert estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

CREATE POLICY "Users with edit access can update estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR UPDATE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'estoque'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

CREATE POLICY "Users with edit access can delete estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR DELETE TO authenticated
  USING (public.can_edit_system(auth.uid(), 'estoque'));
