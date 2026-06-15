-- Add explicit NULL guards to system access functions for consistency with has_role/is_admin_or_super
CREATE OR REPLACE FUNCTION public.has_system_access(_user_id uuid, _system text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.system_access
      WHERE user_id = _user_id AND system_name = _system
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_system(_user_id uuid, _system text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.system_access
      WHERE user_id = _user_id AND system_name = _system
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_system(_user_id uuid, _system text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.system_access
      WHERE user_id = _user_id
        AND system_name = _system
        AND permission_type = 'view_edit'
    )
  END;
$$;

-- Explicit DELETE policy on ferias_configuracoes (admin-only), aligning with INSERT/UPDATE intent
DROP POLICY IF EXISTS "Admins can delete ferias_configuracoes" ON public.ferias_configuracoes;
CREATE POLICY "Admins can delete ferias_configuracoes"
  ON public.ferias_configuracoes
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));
