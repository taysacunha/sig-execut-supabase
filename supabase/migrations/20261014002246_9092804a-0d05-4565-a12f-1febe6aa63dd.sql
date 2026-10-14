CREATE OR REPLACE FUNCTION public.ferias_validar_venda_dividida() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.quinzena_venda = 3 THEN
  IF NEW.vender_dias IS DISTINCT FROM true OR COALESCE(NEW.dias_vendidos,0) < 10 THEN
   RAISE EXCEPTION 'A divisão 5 + 5 no contador exige pelo menos 10 dias vendidos.';
  END IF;
  IF NEW.q2_cancelado OR NEW.quinzena2_inicio IS NULL OR NEW.quinzena2_fim IS NULL THEN
   RAISE EXCEPTION 'A venda dividida exige segundo período cadastrado e não cancelado.';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
COMMENT ON COLUMN public.ferias_ferias.quinzena_venda IS 'Alocação contábil da venda (só contador): 1 primeiro, 2 segundo, 3 = 5 no 1º + 5 no 2º (venda total >= 10). Não altera a distribuição interna.';