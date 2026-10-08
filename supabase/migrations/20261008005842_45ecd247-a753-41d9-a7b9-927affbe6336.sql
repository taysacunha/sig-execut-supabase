DROP FUNCTION public.despesas_gerar_encargos_veiculo_ciclo(uuid,boolean);
CREATE FUNCTION public.despesas_gerar_encargos_veiculo_ciclo(_veiculo_id uuid,_simular boolean DEFAULT false,_previa jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r record; i int; v_centro uuid; v_nome text; v_venda date; v_ciclo int; v_base date; v_venc date; v_parc int; v_criados int:=0; v_itens jsonb:='[]'; v_avisos jsonb:='[]';
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_view_system(auth.uid(),'despesas') OR NOT public.despesas_pode_ver_aba(auth.uid(),'veiculos') THEN RAISE EXCEPTION 'Sem permissão para acessar veículos'; END IF;
 IF NOT _simular AND NOT public.despesas_pode_editar_aba(auth.uid(),'veiculos') THEN RAISE EXCEPTION 'Sem permissão para gerar encargos'; END IF;
 SELECT centro_custo_id,modelo||coalesce(' ('||placa||')',''),data_venda INTO v_centro,v_nome,v_venda FROM public.despesas_veiculos WHERE id=_veiculo_id AND is_active AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()));
 IF NOT FOUND THEN RAISE EXCEPTION 'Veículo não encontrado ou fora dos centros permitidos'; END IF;
 IF NOT _simular THEN PERFORM id FROM public.despesas_veiculo_documentos WHERE veiculo_id=_veiculo_id ORDER BY id FOR UPDATE; END IF;
 FOR r IN SELECT * FROM public.despesas_veiculo_documentos WHERE veiculo_id=_veiculo_id AND ativo ORDER BY id LOOP
   v_parc:=r.parcelas;
   IF v_parc IS NULL OR v_parc<1 OR v_parc>24 THEN RAISE EXCEPTION 'Documento com quantidade inválida de parcelas (1 a 24)'; END IF;
   SELECT greatest(r.ultimo_ciclo_gerado,max(ciclo)) INTO v_ciclo FROM public.despesas_lancamentos WHERE veiculo_documento_id=r.id;
   v_ciclo:=greatest(coalesce(v_ciclo+1,extract(year FROM r.vencimento_primeira_parcela)::int),extract(year FROM r.vencimento_primeira_parcela)::int);
   v_base:=(r.vencimento_primeira_parcela+make_interval(years=>v_ciclo-extract(year FROM r.vencimento_primeira_parcela)::int))::date;
   IF v_venda IS NOT NULL AND v_base>v_venda THEN v_avisos:=v_avisos||jsonb_build_object('tipo',r.tipo,'motivo','Vencimento após a data de venda'); CONTINUE; END IF;
   FOR i IN 1..v_parc LOOP
     v_venc:=(v_base+make_interval(months=>i-1))::date;
     IF v_venda IS NOT NULL AND v_venc>v_venda THEN EXIT; END IF;
     v_itens:=v_itens||jsonb_build_object('documento_id',r.id,'tipo',r.tipo,'ciclo',v_ciclo,'parcela',i,'total',v_parc,'vencimento',v_venc);
     IF NOT _simular THEN
       INSERT INTO public.despesas_lancamentos(tipo,descricao,centro_custo_id,categoria_id,veiculo_id,veiculo_documento_id,ciclo,parcela_num,parcela_total,data_competencia,data_vencimento,valor_total,status,observacao,created_by)
       VALUES('a_pagar',format('%s %s — %s, parcela %s/%s',upper(r.tipo),v_ciclo,v_nome,i,v_parc),v_centro,r.categoria_id,_veiculo_id,r.id,v_ciclo,i,v_parc,date_trunc('month',v_venc)::date,v_venc,NULL,CASE WHEN v_venc<current_date THEN 'vencido' ELSE 'a_vencer' END,'Gerado automaticamente do documento do veículo',auth.uid());
       v_criados:=v_criados+1;
     END IF;
   END LOOP;
   IF NOT _simular THEN UPDATE public.despesas_veiculo_documentos SET ultimo_ciclo_gerado=v_ciclo WHERE id=r.id; END IF;
 END LOOP;
 IF NOT _simular AND (_previa IS NULL OR _previa IS DISTINCT FROM v_itens) THEN RAISE EXCEPTION 'As datas ou os ciclos foram alterados ou já gerados. Feche a confirmação e abra novamente para conferir a nova prévia.'; END IF;
 RETURN jsonb_build_object('criados',v_criados,'itens',v_itens,'avisos',v_avisos);
END; $$;
REVOKE ALL ON FUNCTION public.despesas_gerar_encargos_veiculo_ciclo(uuid,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.despesas_gerar_encargos_veiculo_ciclo(uuid,boolean,jsonb) TO authenticated,service_role;
DO $patch$ DECLARE s text; BEGIN
 SELECT pg_get_functiondef('public.despesas_recalcular_lancamento(uuid)'::regprocedure) INTO s;
 s:=replace(s,'  -- Estados terminais manuais:', '  IF EXISTS (SELECT 1 FROM public.despesas_lancamentos WHERE id=_lancamento_id AND veiculo_id IS NOT NULL AND data_baixa_veiculo IS NOT NULL) THEN RETURN; END IF;'||E'\n'||'  -- Estados terminais manuais:');
 EXECUTE s;
END; $patch$;