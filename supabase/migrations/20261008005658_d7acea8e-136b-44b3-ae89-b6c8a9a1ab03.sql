ALTER TABLE public.despesas_veiculo_documentos ADD COLUMN IF NOT EXISTS ultimo_ciclo_gerado integer;
ALTER TABLE public.despesas_lancamentos ADD COLUMN IF NOT EXISTS data_baixa_veiculo date;
CREATE POLICY desp_lanc_veiculo_update ON public.despesas_lancamentos FOR UPDATE TO authenticated USING (public.can_view_system(auth.uid(),'despesas') AND veiculo_id IS NOT NULL AND public.despesas_pode_editar_aba(auth.uid(),'veiculos') AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))) WITH CHECK (public.can_view_system(auth.uid(),'despesas') AND veiculo_id IS NOT NULL AND public.despesas_pode_editar_aba(auth.uid(),'veiculos') AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid())));
CREATE POLICY desp_lanc_veiculo_delete ON public.despesas_lancamentos FOR DELETE TO authenticated USING (public.can_view_system(auth.uid(),'despesas') AND veiculo_id IS NOT NULL AND public.despesas_pode_excluir_aba(auth.uid(),'veiculos') AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid())));
CREATE OR REPLACE FUNCTION public.despesas_excluir_encargo_veiculo(_id uuid, _modo text, _justificativa text) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE l public.despesas_lancamentos%ROWTYPE; v_ids uuid[]; n integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_view_system(auth.uid(),'despesas') OR NOT public.despesas_pode_excluir_aba(auth.uid(),'veiculos') THEN RAISE EXCEPTION 'Sem permissão para excluir encargos de veículos'; END IF;
 IF length(trim(coalesce(_justificativa,'')))<10 THEN RAISE EXCEPTION 'Informe uma justificativa com pelo menos 10 caracteres'; END IF;
 IF _modo NOT IN ('esta','seguintes') THEN RAISE EXCEPTION 'Modo de exclusão inválido'; END IF;
 SELECT * INTO l FROM public.despesas_lancamentos WHERE id=_id AND veiculo_id IS NOT NULL AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid())) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encargo não encontrado ou fora dos centros permitidos'; END IF;
 IF _modo='seguintes' AND l.veiculo_documento_id IS NULL AND l.serie_recorrencia_id IS NULL THEN RAISE EXCEPTION 'Este lançamento antigo não possui vínculo seguro com um documento. Exclua somente esta parcela.'; END IF;
 SELECT array_agg(d.id) INTO v_ids FROM public.despesas_lancamentos d WHERE d.id=_id OR (_modo='seguintes' AND d.veiculo_id=l.veiculo_id AND d.data_vencimento>=l.data_vencimento AND d.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid())) AND ((l.veiculo_documento_id IS NOT NULL AND d.veiculo_documento_id=l.veiculo_documento_id) OR (l.veiculo_documento_id IS NULL AND d.serie_recorrencia_id=l.serie_recorrencia_id)));
 PERFORM id FROM public.despesas_lancamentos WHERE id=ANY(v_ids) FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.despesas_lancamentos WHERE id=ANY(v_ids) AND (status IN ('pago','quitado','pago_parcial','gimob') OR valor_pago>0 OR data_baixa_veiculo IS NOT NULL)) THEN RAISE EXCEPTION 'Há parcelas já baixadas. Desfaça a baixa antes de excluir.'; END IF;
 INSERT INTO public.module_audit_logs(module_name,table_name,record_id,action,old_data,new_data,changed_by,changed_by_email) SELECT 'despesas','despesas_lancamentos',d.id,'DELETE',to_jsonb(d),jsonb_build_object('justificativa',trim(_justificativa),'modo',_modo),auth.uid(),auth.jwt()->>'email' FROM public.despesas_lancamentos d WHERE d.id=ANY(v_ids);
 DELETE FROM public.despesas_lancamentos WHERE id=ANY(v_ids); GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END; $$;
CREATE OR REPLACE FUNCTION public.despesas_baixar_encargo_veiculo(_id uuid,_data date,_obs text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_view_system(auth.uid(),'despesas') OR NOT public.despesas_pode_editar_aba(auth.uid(),'veiculos') THEN RAISE EXCEPTION 'Sem permissão para dar baixa em encargos de veículos'; END IF;
 IF _data IS NULL THEN RAISE EXCEPTION 'Informe a data do pagamento'; END IF;
 UPDATE public.despesas_lancamentos SET status='pago',data_baixa_veiculo=_data,observacao=concat_ws(E'\n',observacao,format('Baixa em %s%s',to_char(_data,'DD/MM/YYYY'),CASE WHEN nullif(trim(_obs),'') IS NOT NULL THEN ' — '||trim(_obs) ELSE '' END)) WHERE id=_id AND veiculo_id IS NOT NULL AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid())) AND status IN ('a_vencer','vencido');
 IF NOT FOUND THEN RAISE EXCEPTION 'Encargo não encontrado ou já baixado'; END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.despesas_estornar_encargo_veiculo(_id uuid,_justificativa text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE l public.despesas_lancamentos%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_view_system(auth.uid(),'despesas') OR NOT public.despesas_pode_editar_aba(auth.uid(),'veiculos') THEN RAISE EXCEPTION 'Sem permissão para desfazer baixa de veículos'; END IF;
 IF length(trim(coalesce(_justificativa,'')))<10 THEN RAISE EXCEPTION 'Informe uma justificativa com pelo menos 10 caracteres'; END IF;
 SELECT * INTO l FROM public.despesas_lancamentos WHERE id=_id AND veiculo_id IS NOT NULL AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid())) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Encargo não encontrado'; END IF;
 IF l.valor_pago>0 THEN RAISE EXCEPTION 'Este encargo possui pagamentos financeiros anteriores. Estorne pelo calendário geral.'; END IF;
 IF l.status NOT IN ('pago','quitado') THEN RAISE EXCEPTION 'O encargo não está baixado'; END IF;
 UPDATE public.despesas_lancamentos SET status=CASE WHEN data_vencimento<current_date THEN 'vencido' ELSE 'a_vencer' END,data_baixa_veiculo=NULL,observacao=concat_ws(E'\n',observacao,'Estorno de baixa: '||trim(_justificativa)) WHERE id=_id;
END; $$;
DO $patch$
DECLARE s text;
BEGIN
 SELECT pg_get_functiondef('public.despesas_gerar_encargos_veiculo_ciclo(uuid,boolean)'::regprocedure) INTO s;
 s:=replace(s,'IF NOT public.despesas_pode_ver_aba', 'IF NOT public.can_view_system(auth.uid(), ''despesas'') OR NOT public.despesas_pode_ver_aba');
 s:=replace(s,'  FOR r IN SELECT *', '  IF NOT _simular THEN PERFORM id FROM public.despesas_veiculo_documentos WHERE veiculo_id=_veiculo_id ORDER BY id FOR UPDATE; END IF;'||E'\n'||'  FOR r IN SELECT *');
 s:=replace(s,'    v_ciclo := CASE WHEN v_ciclo IS NULL', '    v_ciclo := GREATEST(v_ciclo,r.ultimo_ciclo_gerado);'||E'\n'||'    v_ciclo := CASE WHEN v_ciclo IS NULL');
 s:=replace(s,'        v_criados := v_criados + 1;', '        IF FOUND THEN v_criados := v_criados + 1; END IF;'||E'\n'||'        UPDATE public.despesas_veiculo_documentos SET ultimo_ciclo_gerado=v_ciclo WHERE id=r.id;');
 EXECUTE s;
END; $patch$;
REVOKE ALL ON FUNCTION public.despesas_excluir_encargo_veiculo(uuid,text,text),public.despesas_gerar_encargos_veiculo_ciclo(uuid,boolean),public.despesas_baixar_encargo_veiculo(uuid,date,text),public.despesas_estornar_encargo_veiculo(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.despesas_excluir_encargo_veiculo(uuid,text,text),public.despesas_gerar_encargos_veiculo_ciclo(uuid,boolean),public.despesas_baixar_encargo_veiculo(uuid,date,text),public.despesas_estornar_encargo_veiculo(uuid,text) TO authenticated,service_role;