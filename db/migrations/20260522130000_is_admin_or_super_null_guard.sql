-- Adiciona guard explícito de NULL em is_admin_or_super, alinhando com has_role.
-- Sem mudança de comportamento (o EXISTS já retornaria false), apenas robustez e clareza.

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('super_admin', 'admin')
    )
  END;
$function$;