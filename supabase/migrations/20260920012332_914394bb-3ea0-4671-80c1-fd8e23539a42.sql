CREATE OR REPLACE FUNCTION public.despesas_centros_permitidos(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.despesas_centros_custo c
  WHERE c.is_active = true
    AND (
      public.has_role(_user_id, 'super_admin'::app_role)
      OR public.has_role(_user_id, 'admin'::app_role)
      OR NOT EXISTS (
        SELECT 1
        FROM public.despesas_centros_custo_permissoes p0
        WHERE p0.user_id = _user_id
      )
    )
  UNION
  SELECT p.centro_custo_id
  FROM public.despesas_centros_custo_permissoes p
  JOIN public.despesas_centros_custo c ON c.id = p.centro_custo_id
  WHERE p.user_id = _user_id
    AND c.is_active = true;
$$;

COMMENT ON FUNCTION public.despesas_centros_permitidos(uuid) IS
  'Retorna todos os centros ativos para admin/super_admin ou quando o usuário não possui restrições explícitas; havendo vínculos, retorna somente os centros selecionados. O acesso às abas continua validado pelas políticas de cada recurso.';

REVOKE EXECUTE ON FUNCTION public.despesas_centros_permitidos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.despesas_centros_permitidos(uuid) TO authenticated, service_role;