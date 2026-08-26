-- Alinha as políticas de escrita de placas com a permissão de edição do módulo Estoque.
-- Antes, a inserção exigia admin/super_admin, bloqueando supervisores com edição liberada
-- ao criar um novo código na saída de placa para imóvel.

DROP POLICY IF EXISTS placas_insert_admin ON public.estoque_placas;
DROP POLICY IF EXISTS placas_insert_editor ON public.estoque_placas;

CREATE POLICY placas_insert_editor
ON public.estoque_placas
FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

-- Histórico de placas: gravação apenas para quem pode editar o módulo.
DROP POLICY IF EXISTS placas_hist_insert ON public.estoque_placas_historico;
CREATE POLICY placas_hist_insert
ON public.estoque_placas_historico
FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

-- Exclusão de placas continua restrita a administradores (placas_delete_admin inalterada).
