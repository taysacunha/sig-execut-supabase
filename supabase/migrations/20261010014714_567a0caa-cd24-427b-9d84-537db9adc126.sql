DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.audit_module_changes()'::regprocedure) INTO definition;
 IF strpos(definition,'COALESCE(NEW.id, OLD.id)')=0 THEN RAISE EXCEPTION 'Definição de auditoria inesperada'; END IF;
 definition:=replace(definition,'COALESCE(NEW.id, OLD.id)', '(COALESCE(v_new_data->>''id'', v_old_data->>''id'', v_new_data->>''user_id'', v_old_data->>''user_id''))::uuid');
 EXECUTE definition;
END $$;
DROP TRIGGER IF EXISTS trg_despesas_centros_custo_audit ON public.despesas_centros_custo;
DROP POLICY IF EXISTS despesas_cc_edit ON public.despesas_centros_custo;
CREATE POLICY despesas_cc_insert ON public.despesas_centros_custo FOR INSERT TO authenticated WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));
CREATE POLICY despesas_cc_update ON public.despesas_centros_custo FOR UPDATE TO authenticated USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros')) WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));
CREATE POLICY despesas_cc_delete_admin ON public.despesas_centros_custo FOR DELETE TO authenticated USING (public.can_view_system(auth.uid(),'despesas') AND public.despesas_pode_editar_aba(auth.uid(),'cadastros') AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE FUNCTION public.despesas_centro_custo_proteger_exclusao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.despesas_lancamentos WHERE centro_custo_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.despesas_imoveis WHERE centro_custo_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.despesas_bens WHERE centro_custo_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.despesas_recorrencias WHERE centro_custo_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.despesas_repasses WHERE centro_custo_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.despesas_repasse_contas WHERE centro_custo_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.despesas_veiculos WHERE centro_custo_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.despesas_contas_bancarias WHERE centro_custo_id=OLD.id) THEN
 RAISE EXCEPTION 'Este centro de custo está em uso. Desative-o em vez de excluir para preservar os registros vinculados.' USING ERRCODE='23503';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.despesas_centro_custo_proteger_exclusao() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.despesas_centro_custo_proteger_exclusao() TO service_role;
CREATE TRIGGER despesas_cc_proteger_exclusao BEFORE DELETE ON public.despesas_centros_custo FOR EACH ROW EXECUTE FUNCTION public.despesas_centro_custo_proteger_exclusao();