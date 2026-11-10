ALTER TABLE public.ferias_formulario_anual
  ADD COLUMN IF NOT EXISTS modo_periodo text NOT NULL DEFAULT '15_15',
  ADD COLUMN IF NOT EXISTS data_inicio_q2_preferencia date;
DO $$ BEGIN
  ALTER TABLE public.ferias_formulario_anual
    ADD CONSTRAINT ferias_formulario_anual_modo_periodo_check CHECK (modo_periodo IN ('15_15','30'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.ferias_validar_sobreposicao_periodos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.quinzena2_inicio IS NULL OR NEW.quinzena2_fim IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.quinzena1_inicio IS NOT DISTINCT FROM OLD.quinzena1_inicio
     AND NEW.quinzena1_fim IS NOT DISTINCT FROM OLD.quinzena1_fim
     AND NEW.quinzena2_inicio IS NOT DISTINCT FROM OLD.quinzena2_inicio
     AND NEW.quinzena2_fim IS NOT DISTINCT FROM OLD.quinzena2_fim THEN RETURN NEW; END IF;
  IF NEW.quinzena1_inicio <= NEW.quinzena2_fim AND NEW.quinzena1_fim >= NEW.quinzena2_inicio THEN
    RAISE EXCEPTION 'O 1º e o 2º período de férias não podem se sobrepor (% a % e % a %).',
      to_char(NEW.quinzena1_inicio,'DD/MM/YYYY'), to_char(NEW.quinzena1_fim,'DD/MM/YYYY'),
      to_char(NEW.quinzena2_inicio,'DD/MM/YYYY'), to_char(NEW.quinzena2_fim,'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ferias_validar_sobreposicao ON public.ferias_ferias;
CREATE TRIGGER trg_ferias_validar_sobreposicao
  BEFORE INSERT OR UPDATE ON public.ferias_ferias
  FOR EACH ROW EXECUTE FUNCTION public.ferias_validar_sobreposicao_periodos();