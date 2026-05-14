DO $$
BEGIN
  -- Recriar função has_role com verificação explícita de NULL
  CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $func$
    SELECT CASE 
      WHEN _user_id IS NULL THEN FALSE
      ELSE EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
      )
    END
  $func$;

  RAISE NOTICE 'Função has_role atualizada com verificação explícita de NULL!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao atualizar função has_role: %. Rollback automático executado.', SQLERRM;
END;
$$;