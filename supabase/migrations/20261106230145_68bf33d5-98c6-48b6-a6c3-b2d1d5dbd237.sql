ALTER TABLE public.ferias_ferias ADD COLUMN IF NOT EXISTS periodo_unico boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ferias_validar_periodo_unico()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.periodo_unico THEN
    IF NEW.quinzena1_fim IS DISTINCT FROM (NEW.quinzena1_inicio + 29) THEN
      RAISE EXCEPTION 'Férias de 30 dias direto devem ter fim exatamente 29 dias após o início.';
    END IF;
    IF NEW.quinzena2_inicio IS NOT NULL OR NEW.quinzena2_fim IS NOT NULL OR NEW.q2_cancelado THEN
      RAISE EXCEPTION 'Férias de 30 dias direto não possuem 2º período.';
    END IF;
    IF COALESCE(NEW.vender_dias, false) OR COALESCE(NEW.dias_vendidos, 0) > 0 THEN
      RAISE EXCEPTION 'Férias de 30 dias direto não permitem venda de dias.';
    END IF;
    IF NEW.is_excecao IS DISTINCT FROM true OR COALESCE(btrim(NEW.excecao_justificativa), '') = '' THEN
      RAISE EXCEPTION 'Férias de 30 dias direto exigem registro como exceção com justificativa.';
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

DROP TRIGGER IF EXISTS trg_ferias_validar_periodo_unico ON public.ferias_ferias;
CREATE TRIGGER trg_ferias_validar_periodo_unico BEFORE INSERT OR UPDATE ON public.ferias_ferias
FOR EACH ROW EXECUTE FUNCTION public.ferias_validar_periodo_unico();