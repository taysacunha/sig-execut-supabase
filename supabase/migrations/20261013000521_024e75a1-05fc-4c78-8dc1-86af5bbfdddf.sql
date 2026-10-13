CREATE OR REPLACE FUNCTION public.ferias_validar_venda_dividida() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (OLD.quinzena_venda = 3 OR NEW.quinzena_venda = 3) AND (COALESCE(OLD.enviado_contador_q1,false) OR COALESCE(OLD.enviado_contador_q2,false)) AND ROW(OLD.quinzena_venda,OLD.vender_dias,OLD.dias_vendidos,OLD.dias_vendidos_q1,OLD.dias_vendidos_q2) IS DISTINCT FROM ROW(NEW.quinzena_venda,NEW.vender_dias,NEW.dias_vendidos,NEW.dias_vendidos_q1,NEW.dias_vendidos_q2) THEN
  RAISE EXCEPTION 'A alocação já foi enviada ao contador. Regularize o envio do período antes de alterar a venda.';
 END IF;
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