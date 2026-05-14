-- =====================================================
-- ADICIONAR PROTEÇÃO EXTRA CONTRA ACESSO ANÔNIMO
-- =====================================================

-- 1. BROKERS - Atualizar políticas com verificação explícita de auth.uid()
DROP POLICY IF EXISTS "Admin/Manager can view all brokers" ON brokers;
CREATE POLICY "Admin/Manager can view all brokers" ON brokers
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

DROP POLICY IF EXISTS "Admin/Manager can insert brokers" ON brokers;
CREATE POLICY "Admin/Manager can insert brokers" ON brokers
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

DROP POLICY IF EXISTS "Admin/Manager can update brokers" ON brokers;
CREATE POLICY "Admin/Manager can update brokers" ON brokers
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

DROP POLICY IF EXISTS "Admin can delete brokers" ON brokers;
CREATE POLICY "Admin can delete brokers" ON brokers
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL AND 
  has_role(auth.uid(), 'admin')
);

-- 2. USER_ROLES - Atualizar políticas com verificação explícita
DROP POLICY IF EXISTS "Admins can manage user_roles" ON user_roles;
CREATE POLICY "Admins can manage user_roles" ON user_roles
FOR ALL TO authenticated
USING (
  auth.uid() IS NOT NULL AND 
  has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role" ON user_roles
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND 
  user_id = auth.uid()
);