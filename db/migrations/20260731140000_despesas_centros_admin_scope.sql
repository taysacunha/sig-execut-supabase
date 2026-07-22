-- Trata role 'admin' como super no escopo de leitura/escrita de despesas.
-- Corrige situação em que admins sem entradas explícitas em
-- despesas_centros_custo_permissoes viam a lista vazia por causa do
-- deny-default. Colaboradores/gerentes/supervisores permanecem restritos.

CREATE OR REPLACE FUNCTION public.despesas_centros_permitidos(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admin ou admin: acesso irrestrito a todos os centros ativos.
  SELECT c.id
  FROM public.despesas_centros_custo c
  WHERE c.is_active = true
    AND (
      public.has_role(_user_id, 'super_admin'::app_role)
      OR public.has_role(_user_id, 'admin'::app_role)
    )
  UNION
  -- Demais usuários: somente centros explicitamente permitidos.
  SELECT p.centro_custo_id
  FROM public.despesas_centros_custo_permissoes p
  JOIN public.despesas_centros_custo c ON c.id = p.centro_custo_id
  WHERE p.user_id = _user_id
    AND c.is_active = true;
$$;

COMMENT ON FUNCTION public.despesas_centros_permitidos(uuid) IS
  'Retorna centros de custo permitidos ao usuário. Super_admin e admin: todos os centros ativos. Demais perfis: apenas centros com grant explícito.';