-- Função SECURITY DEFINER para verificar se existe admin no sistema
-- Isso bypassa RLS e permite verificar mesmo para usuários sem role
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  )
$$;