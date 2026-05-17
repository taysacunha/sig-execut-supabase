-- Add receipt confirmation and PDF issue date to ferias_premiacoes
ALTER TABLE public.ferias_premiacoes
  ADD COLUMN IF NOT EXISTS ultima_exportacao_pdf date NULL,
  ADD COLUMN IF NOT EXISTS recebimento_confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recebimento_confirmado_em date NULL,
  ADD COLUMN IF NOT EXISTS recebimento_confirmado_por uuid NULL;

-- Trigger: validar que data atestada não pode ser anterior à data de emissão
CREATE OR REPLACE FUNCTION public.ferias_premiacoes_check_atesto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.recebimento_confirmado IS TRUE THEN
    IF NEW.recebimento_confirmado_em IS NULL THEN
      RAISE EXCEPTION 'Informe a data do atesto de recebimento';
    END IF;
    IF NEW.ultima_exportacao_pdf IS NOT NULL
       AND NEW.recebimento_confirmado_em < NEW.ultima_exportacao_pdf THEN
      RAISE EXCEPTION 'A data do atesto (%) não pode ser anterior à data de emissão do PDF (%)',
        NEW.recebimento_confirmado_em, NEW.ultima_exportacao_pdf;
    END IF;
  ELSE
    NEW.recebimento_confirmado_em := NULL;
    NEW.recebimento_confirmado_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ferias_premiacoes_check_atesto ON public.ferias_premiacoes;
CREATE TRIGGER trg_ferias_premiacoes_check_atesto
  BEFORE INSERT OR UPDATE ON public.ferias_premiacoes
  FOR EACH ROW EXECUTE FUNCTION public.ferias_premiacoes_check_atesto();
