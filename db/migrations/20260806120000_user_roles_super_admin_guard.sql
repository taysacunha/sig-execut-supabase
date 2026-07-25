-- Restringe INSERT/UPDATE em public.user_roles para impedir que administradores
-- comuns concedam o perfil super_admin (a si mesmos ou a outros), fechando um
-- caminho de escalada de privilégios. Apenas super_admins podem gravar linhas
-- com role = 'super_admin' ou modificar linhas cujo perfil atual seja super_admin.

DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;

CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND (
      role <> 'super_admin'::app_role
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "Admins can update user_roles"
  ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    AND (
      role <> 'super_admin'::app_role
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND (
      role <> 'super_admin'::app_role
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    AND (
      role <> 'super_admin'::app_role
      OR public.is_super_admin(auth.uid())
    )
  );