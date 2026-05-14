-- Restringe INSERT em module_audit_logs:
-- usuário só pode inserir registros marcando-se como changed_by = auth.uid()
-- e precisa ter acesso a algum sistema (evita anon/usuários sem permissão)
DROP POLICY IF EXISTS "System can insert module_audit_logs" ON public.module_audit_logs;

CREATE POLICY "Users can insert their own module_audit_logs"
  ON public.module_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.system_access sa WHERE sa.user_id = auth.uid()
    )
  );
