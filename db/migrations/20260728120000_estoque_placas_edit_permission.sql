-- Restrict write access on estoque_placas and estoque_placas_historico
-- to users with edit permission on the 'estoque' module, not just view.

DROP POLICY IF EXISTS placas_update_any_editor ON public.estoque_placas;
CREATE POLICY placas_update_any_editor
ON public.estoque_placas
FOR UPDATE
TO authenticated
USING (public.can_edit_system(auth.uid(), 'estoque'))
WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

DROP POLICY IF EXISTS placas_hist_insert ON public.estoque_placas_historico;
CREATE POLICY placas_hist_insert
ON public.estoque_placas_historico
FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));