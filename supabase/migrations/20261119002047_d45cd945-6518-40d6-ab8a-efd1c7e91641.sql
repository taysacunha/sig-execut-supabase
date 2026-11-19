CREATE OR REPLACE FUNCTION public.ferias_validar_periodo_unico()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_vend int;
BEGIN
  IF NEW.periodo_unico THEN
    v_vend := CASE WHEN COALESCE(NEW.vender_dias,false) THEN COALESCE(NEW.dias_vendidos,0) ELSE 0 END;
    IF v_vend < 0 OR v_vend > 10 THEN
      RAISE EXCEPTION 'Férias de período único permitem vender no máximo 10 dias.';
    END IF;
    IF COALESCE(NEW.vender_dias,false) AND v_vend = 0 THEN
      RAISE EXCEPTION 'Informe a quantidade de dias vendidos.';
    END IF;
    IF NEW.quinzena1_fim IS DISTINCT FROM (NEW.quinzena1_inicio + (29 - v_vend)) THEN
      RAISE EXCEPTION 'Férias de período único devem terminar % dias após o início (30 dias menos os dias vendidos).', 29 - v_vend;
    END IF;
    IF NEW.quinzena2_inicio IS NOT NULL OR NEW.quinzena2_fim IS NOT NULL OR NEW.q2_cancelado THEN
      RAISE EXCEPTION 'Férias de 30 dias direto não possuem 2º período.';
    END IF;
    IF NEW.is_excecao IS DISTINCT FROM true OR COALESCE(btrim(NEW.excecao_justificativa), '') = '' THEN
      RAISE EXCEPTION 'Férias de 30 dias direto exigem registro como exceção com justificativa.';
    END IF;
    IF v_vend = 0 THEN
      NEW.vender_dias := false; NEW.dias_vendidos := NULL; NEW.quinzena_venda := NULL;
      NEW.dias_vendidos_q1 := NULL; NEW.dias_vendidos_q2 := NULL;
    ELSE
      NEW.quinzena_venda := 1; NEW.dias_vendidos_q1 := v_vend; NEW.dias_vendidos_q2 := 0;
    END IF;
    NEW.excecao_motivo := 'periodo_unico_30';
    NEW.gozo_diferente := false;
    NEW.gozo_flexivel := false;
    NEW.gozo_quinzena2_inicio := NULL;
    NEW.gozo_quinzena2_fim := NULL;
    NEW.enviado_contador_q2 := false;
  END IF;
  RETURN NEW;
END $$;