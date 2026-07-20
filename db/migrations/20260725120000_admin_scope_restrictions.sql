-- Restringir poderes do perfil 'admin' no gerenciamento de usuários.
-- 1) Helper: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'super_admin'
    )
  END;
$$;

-- 2) Helper: admin possui view_edit no sistema informado
CREATE OR REPLACE FUNCTION public.admin_edits_system(_admin uuid, _system text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _admin IS NULL OR _system IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.system_access
      WHERE user_id = _admin
        AND system_name = _system
        AND permission_type = 'view_edit'
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edits_system(uuid, text) TO authenticated;

-- 3) set_user_role passa a exigir super_admin
CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _new_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas Super Administradores podem alterar perfis de usuários';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
  RETURN true;
END;
$$;

-- 4) Policies system_access: super_admin livre; admin apenas no escopo dele
--    e nunca sobre um super_admin alvo.
DROP POLICY IF EXISTS "Admin can insert system_access" ON public.system_access;
DROP POLICY IF EXISTS "Admins can insert system_access" ON public.system_access;
CREATE POLICY "Scoped admins can insert system_access" ON public.system_access
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.admin_edits_system(auth.uid(), system_name)
      AND NOT public.is_super_admin(user_id)
    )
  );

DROP POLICY IF EXISTS "Admin can update system_access" ON public.system_access;
DROP POLICY IF EXISTS "Admins can update system_access" ON public.system_access;
CREATE POLICY "Scoped admins can update system_access" ON public.system_access
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.admin_edits_system(auth.uid(), system_name)
      AND NOT public.is_super_admin(user_id)
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.admin_edits_system(auth.uid(), system_name)
      AND NOT public.is_super_admin(user_id)
    )
  );

DROP POLICY IF EXISTS "Admin can delete system_access" ON public.system_access;
DROP POLICY IF EXISTS "Admins can delete system_access" ON public.system_access;
CREATE POLICY "Scoped admins can delete system_access" ON public.system_access
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.admin_edits_system(auth.uid(), system_name)
      AND NOT public.is_super_admin(user_id)
    )
  );