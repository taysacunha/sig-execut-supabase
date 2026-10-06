ALTER TABLE public.despesas_lancamentos
  ADD COLUMN IF NOT EXISTS veiculo_documento_id uuid REFERENCES public.despesas_veiculo_documentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ciclo integer,
  ADD COLUMN IF NOT EXISTS parcela_num integer,
  ADD COLUMN IF NOT EXISTS parcela_total integer;

CREATE UNIQUE INDEX IF NOT EXISTS despesas_lanc_veic_doc_ciclo_parcela_uk
  ON public.despesas_lancamentos(veiculo_documento_id, ciclo, parcela_num)
  WHERE veiculo_documento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.despesas_gerar_encargos_veiculo_ciclo(_veiculo_id uuid, _simular boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  i integer;
  v_parc integer;
  v_centro uuid;
  v_nome text;
  v_venda date;
  v_ano_base integer;
  v_ciclo integer;
  v_base date;
  v_venc date;
  v_desc text;
  v_itens jsonb := '[]'::jsonb;
  v_avisos jsonb := '[]'::jsonb;
  v_criados integer := 0;
BEGIN
  IF NOT public.despesas_pode_ver_aba(auth.uid(), 'veiculos') THEN
    RAISE EXCEPTION 'Sem permissão para acessar veículos';
  END IF;
  IF NOT _simular AND NOT public.despesas_pode_editar_aba(auth.uid(), 'veiculos') THEN
    RAISE EXCEPTION 'Sem permissão para gerar encargos de veículos';
  END IF;

  SELECT centro_custo_id, modelo || COALESCE(' (' || placa || ')', ''), data_venda
    INTO v_centro, v_nome, v_venda
    FROM public.despesas_veiculos
   WHERE id = _veiculo_id AND is_active = true
     AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veículo não encontrado ou fora dos centros permitidos';
  END IF;

  FOR r IN SELECT * FROM public.despesas_veiculo_documentos
           WHERE veiculo_id = _veiculo_id AND ativo = true ORDER BY vencimento_primeira_parcela
  LOOP
    v_parc := GREATEST(COALESCE(r.parcelas, 1), 1);
    v_ano_base := EXTRACT(YEAR FROM r.vencimento_primeira_parcela)::int;

    -- último ciclo já lançado (novo vínculo ou descrições antigas "TIPO AAAA —")
    SELECT GREATEST(
      (SELECT max(ciclo) FROM public.despesas_lancamentos WHERE veiculo_documento_id = r.id),
      (SELECT max(substring(descricao from '^' || upper(r.tipo::text) || ' (\d{4}) —')::int)
         FROM public.despesas_lancamentos
        WHERE veiculo_id = _veiculo_id AND veiculo_documento_id IS NULL
          AND descricao ~ ('^' || upper(r.tipo::text) || ' \d{4} —'))
    ) INTO v_ciclo;

    v_ciclo := CASE WHEN v_ciclo IS NULL THEN v_ano_base ELSE GREATEST(v_ciclo + 1, v_ano_base) END;
    v_base := (r.vencimento_primeira_parcela + ((v_ciclo - v_ano_base) || ' years')::interval)::date;

    IF v_venda IS NOT NULL AND v_base > v_venda THEN
      v_avisos := v_avisos || jsonb_build_object('tipo', r.tipo, 'motivo', 'Vencimento após a data de venda do veículo');
      CONTINUE;
    END IF;

    FOR i IN 1..v_parc LOOP
      v_venc := (v_base + ((i - 1) || ' months')::interval)::date;
      IF v_venda IS NOT NULL AND v_venc > v_venda THEN EXIT; END IF;
      v_desc := format('%s %s — %s, parcela %s/%s', upper(r.tipo::text), v_ciclo, v_nome, i, v_parc);
      v_itens := v_itens || jsonb_build_object('tipo', r.tipo, 'ciclo', v_ciclo, 'parcela', i,
                                               'total', v_parc, 'vencimento', v_venc);
      IF NOT _simular THEN
        IF v_centro IS NULL THEN RAISE EXCEPTION 'Veículo sem centro de custo definido'; END IF;
        INSERT INTO public.despesas_lancamentos(
          tipo, descricao, centro_custo_id, categoria_id, veiculo_id, veiculo_documento_id,
          ciclo, parcela_num, parcela_total, data_competencia, data_vencimento, valor_total, status, observacao)
        VALUES ('a_pagar', v_desc, v_centro, r.categoria_id, _veiculo_id, r.id,
          v_ciclo, i, v_parc, make_date(v_ciclo, 1, 1), v_venc, NULL,
          CASE WHEN v_venc < current_date THEN 'vencido' ELSE 'a_vencer' END,
          format('Gerado automaticamente do documento do veículo (%s)', r.tipo))
        ON CONFLICT DO NOTHING;
        v_criados := v_criados + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('criados', v_criados, 'itens', v_itens, 'avisos', v_avisos);
END;
$$;

CREATE OR REPLACE FUNCTION public.despesas_baixar_encargo_veiculo(_id uuid, _data date, _obs text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.despesas_pode_editar_aba(auth.uid(), 'veiculos') THEN
    RAISE EXCEPTION 'Sem permissão para dar baixa em encargos de veículos';
  END IF;
  UPDATE public.despesas_lancamentos
     SET status = 'pago',
         observacao = concat_ws(E'\n', observacao,
           format('Baixa em %s%s', to_char(COALESCE(_data, current_date), 'DD/MM/YYYY'),
                  CASE WHEN nullif(trim(_obs), '') IS NOT NULL THEN ' — ' || trim(_obs) ELSE '' END)),
         updated_at = now()
   WHERE id = _id AND veiculo_id IS NOT NULL AND status NOT IN ('pago','quitado','cancelado');
  IF NOT FOUND THEN RAISE EXCEPTION 'Encargo não encontrado ou já baixado'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.despesas_excluir_encargo_veiculo(_id uuid, _modo text, _justificativa text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  l record;
  v_ids uuid[];
  v_pagos integer;
  v_email text;
BEGIN
  IF length(trim(coalesce(_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Informe uma justificativa com pelo menos 10 caracteres';
  END IF;
  IF NOT public.despesas_pode_excluir_aba(auth.uid(), 'veiculos') THEN
    RAISE EXCEPTION 'Sem permissão para excluir encargos de veículos';
  END IF;

  SELECT * INTO l FROM public.despesas_lancamentos
   WHERE id = _id AND veiculo_id IS NOT NULL
     AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()));
  IF NOT FOUND THEN RAISE EXCEPTION 'Encargo não encontrado ou fora dos centros permitidos'; END IF;

  IF _modo = 'seguintes' THEN
    SELECT array_agg(id) INTO v_ids FROM public.despesas_lancamentos
     WHERE veiculo_id = l.veiculo_id AND data_vencimento >= l.data_vencimento
       AND (CASE WHEN l.veiculo_documento_id IS NOT NULL
                 THEN veiculo_documento_id = l.veiculo_documento_id
                 ELSE split_part(descricao, ' ', 1) = split_part(l.descricao, ' ', 1) END);
  ELSE
    v_ids := ARRAY[_id];
  END IF;

  SELECT count(*) INTO v_pagos FROM public.despesas_lancamentos
   WHERE id = ANY(v_ids) AND (status IN ('pago','quitado','pago_parcial') OR valor_pago > 0);
  IF v_pagos > 0 THEN
    RAISE EXCEPTION 'Há % parcela(s) já baixada(s). Desfaça a baixa antes de excluir.', v_pagos;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.module_audit_logs(module_name, table_name, record_id, action, old_data, new_data, changed_by, changed_by_email)
  SELECT 'despesas', 'despesas_lancamentos', d.id, 'DELETE', to_jsonb(d),
         jsonb_build_object('justificativa', trim(_justificativa), 'modo', _modo), auth.uid(), v_email
    FROM public.despesas_lancamentos d WHERE d.id = ANY(v_ids);

  DELETE FROM public.despesas_lancamentos WHERE id = ANY(v_ids);
  RETURN coalesce(array_length(v_ids, 1), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.despesas_excluir_encargo_veiculo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.despesas_excluir_encargo_veiculo(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.despesas_gerar_encargos_veiculo_ciclo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.despesas_baixar_encargo_veiculo(uuid, date, text) TO authenticated;