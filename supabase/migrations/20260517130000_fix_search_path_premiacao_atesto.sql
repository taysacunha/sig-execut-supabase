CREATE OR REPLACE FUNCTION public.ferias_premiacoes_check_atesto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recebimento_confirmado = true
     AND NEW.recebimento_confirmado_em IS NOT NULL
     AND NEW.ultima_exportacao_pdf IS NOT NULL
     AND NEW.recebimento_confirmado_em < NEW.ultima_exportacao_pdf THEN
    RAISE EXCEPTION 'Data do atesto não pode ser anterior à data de emissão do PDF';
  END IF;
  RETURN NEW;
END;
$$;
