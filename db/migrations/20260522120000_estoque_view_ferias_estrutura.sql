-- Permite que usuários com acesso ao módulo Estoque consultem as estruturas
-- de Unidades e Setores (que são compartilhadas com o módulo Férias),
-- para que selects de "Local de Armazenamento", "Unidade" e "Setor" nas
-- páginas de Estoque listem opções mesmo quando o usuário não tem acesso a Férias.

CREATE POLICY "estoque_users_can_view_unidades"
ON public.ferias_unidades
FOR SELECT
TO authenticated
USING (public.can_view_system(auth.uid(), 'estoque'));

CREATE POLICY "estoque_users_can_view_setores"
ON public.ferias_setores
FOR SELECT
TO authenticated
USING (public.can_view_system(auth.uid(), 'estoque'));
