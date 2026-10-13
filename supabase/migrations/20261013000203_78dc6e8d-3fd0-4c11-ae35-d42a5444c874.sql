ALTER TABLE public.ferias_ferias DROP CONSTRAINT ferias_ferias_quinzena_venda_check;
ALTER TABLE public.ferias_ferias ADD CONSTRAINT ferias_ferias_quinzena_venda_check CHECK (quinzena_venda IN (1,2,3));
COMMENT ON COLUMN public.ferias_ferias.quinzena_venda IS 'Alocação contábil da venda: 1 primeiro, 2 segundo, 3 ambos (5+5 exclusivamente em venda total de 10). Não representa terceiro período.';
CREATE OR REPLACE FUNCTION public.ferias_validar_venda_dividida() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.quinzena_venda = 3 THEN
  IF NEW.vender_dias IS DISTINCT FROM true OR NEW.dias_vendidos IS DISTINCT FROM 10 OR NEW.dias_vendidos_q1 IS DISTINCT FROM 5 OR NEW.dias_vendidos_q2 IS DISTINCT FROM 5 THEN
   RAISE EXCEPTION 'A venda dividida exige exatamente 10 dias vendidos: 5 no primeiro e 5 no segundo período.';
  END IF;
  IF NEW.q2_cancelado OR NEW.quinzena2_inicio IS NULL OR NEW.quinzena2_fim IS NULL THEN
   RAISE EXCEPTION 'A venda dividida exige segundo período cadastrado e não cancelado.';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ferias_validar_venda_dividida() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validar_venda_dividida BEFORE INSERT OR UPDATE ON public.ferias_ferias FOR EACH ROW EXECUTE FUNCTION public.ferias_validar_venda_dividida();