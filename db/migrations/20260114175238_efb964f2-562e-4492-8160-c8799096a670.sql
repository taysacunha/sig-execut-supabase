-- Corrigir políticas de INSERT para audit logs (serem mais restritivas)
-- A inserção via trigger (SECURITY DEFINER) já bypassa RLS, então podemos ser mais restritivos

-- Dropar políticas permissivas
DROP POLICY IF EXISTS "Service role can insert audit logs" ON admin_audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert module audit logs" ON module_audit_logs;

-- Criar políticas mais restritivas (apenas admins podem inserir manualmente)
-- Os triggers com SECURITY DEFINER já bypassam RLS automaticamente
CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert module audit logs"
  ON module_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );