-- =====================================================================
-- Security fix: despesas_centros_permitidos deve negar por padrão.
--
-- Antes: quando o usuário não tinha nenhuma linha em
-- despesas_centros_custo_permissoes, a função retornava TODOS os centros
-- de custo ativos, expondo lançamentos, imóveis, veículos e repasses de
-- toda a empresa para qualquer usuário com acesso ao módulo Despesas.
--
-- Agora: retorna apenas os centros de custo explicitamente concedidos ao
-- usuário. Super admins (role 'super_admin') continuam vendo tudo, para
-- não travar administração. Demais perfis precisam de grants explícitos.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.despesas_centros_permitidos(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admin: acesso irrestrito a todos os centros ativos.
  SELECT c.id
  FROM public.despesas_centros_custo c
  WHERE c.ativo = true
    AND public.has_role(_user_id, 'super_admin'::app_role)
  UNION
  -- Demais usuários: somente centros explicitamente permitidos.
  SELECT p.centro_custo_id
  FROM public.despesas_centros_custo_permissoes p
  JOIN public.despesas_centros_custo c ON c.id = p.centro_custo_id
  WHERE p.user_id = _user_id
    AND c.ativo = true;
$$;

COMMENT ON FUNCTION public.despesas_centros_permitidos(uuid) IS
  'Retorna centros de custo permitidos ao usuário. Deny-by-default: sem grants explícitos em despesas_centros_custo_permissoes, retorna vazio (exceto super_admin).';