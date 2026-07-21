-- Permite ao perfil 'admin' alterar roles OPERACIONAIS (manager, supervisor, collaborator)
-- para usuários dentro do seu escopo de sistemas, mantendo super_admin com poder total.
CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _new_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target_role app_role;
  v_shared_scope boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Super admin: pode tudo
  IF public.is_super_admin(v_caller) THEN
    DELETE FROM public.user_roles WHERE user_id = _target_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
    RETURN true;
  END IF;

  -- Admin: escopo restrito
  IF public.has_role(v_caller, 'admin'::app_role) THEN
    IF _target_user_id = v_caller THEN
      RAISE EXCEPTION 'Você não pode alterar seu próprio perfil';
    END IF;

    IF _new_role NOT IN ('manager'::app_role, 'supervisor'::app_role, 'collaborator'::app_role) THEN
      RAISE EXCEPTION 'Administradores só podem atribuir os perfis Gerente, Supervisor ou Colaborador';
    END IF;

    SELECT role INTO v_target_role
    FROM public.user_roles
    WHERE user_id = _target_user_id
    LIMIT 1;

    IF v_target_role IN ('super_admin'::app_role, 'admin'::app_role) THEN
      RAISE EXCEPTION 'Somente Super Administradores podem alterar perfis administrativos';
    END IF;

    -- Precisa compartilhar ao menos um sistema em que o admin tem view_edit
    SELECT EXISTS (
      SELECT 1
      FROM public.system_access sa_target
      WHERE sa_target.user_id = _target_user_id
        AND public.admin_edits_system(v_caller, sa_target.system_name)
    ) INTO v_shared_scope;

    IF NOT v_shared_scope THEN
      RAISE EXCEPTION 'Você não tem escopo de sistema em comum com este usuário';
    END IF;

    DELETE FROM public.user_roles WHERE user_id = _target_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
    RETURN true;
  END IF;

  RAISE EXCEPTION 'Sem permissão para alterar perfis de usuários';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role) TO authenticated;