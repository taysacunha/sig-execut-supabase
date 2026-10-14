-- Testes isolados: nenhum registro ou log de teste permanece após ROLLBACK.
BEGIN;
DO $$
DECLARE
 v_id uuid;
 v_total integer;
 v_dias integer;
BEGIN
 INSERT INTO public.ferias_ferias(quinzena1_inicio,quinzena1_fim,quinzena2_inicio,quinzena2_fim,vender_dias,dias_vendidos,quinzena_venda,dias_vendidos_q1,dias_vendidos_q2)
 VALUES('2027-02-01','2027-02-15','2027-03-01','2027-03-15',true,10,3,5,5) RETURNING id INTO v_id;
 SELECT dias_vendidos_q1 + dias_vendidos_q2 INTO v_total FROM public.ferias_ferias WHERE id=v_id;
 IF v_total IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'Persistência 5/5 falhou'; END IF;
 FOREACH v_dias IN ARRAY ARRAY[5,9,11,15] LOOP
  BEGIN
   UPDATE public.ferias_ferias SET dias_vendidos=v_dias WHERE id=v_id;
   RAISE EXCEPTION 'TEST_FAILED: aceitou total inválido';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'TEST_FAILED:%' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE 'A venda dividida exige exatamente%' THEN RAISE; END IF;
  END;
 END LOOP;
 BEGIN
  UPDATE public.ferias_ferias SET q2_cancelado=true WHERE id=v_id;
  RAISE EXCEPTION 'TEST_FAILED: aceitou cancelamento';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'A venda dividida exige segundo%' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.ferias_ferias SET dias_vendidos_q1=10,dias_vendidos_q2=0 WHERE id=v_id;
  RAISE EXCEPTION 'TEST_FAILED: aceitou distribuição inválida';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'A venda dividida exige exatamente%' THEN RAISE; END IF;
 END;
 UPDATE public.ferias_ferias SET enviado_contador_q1=true WHERE id=v_id;
 BEGIN
  UPDATE public.ferias_ferias SET quinzena_venda=1,dias_vendidos_q1=10,dias_vendidos_q2=0 WHERE id=v_id;
  RAISE EXCEPTION 'TEST_FAILED: alterou venda enviada';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'A alocação já foi enviada%' THEN RAISE; END IF;
 END;
 UPDATE public.ferias_ferias SET enviado_contador_q1=false WHERE id=v_id;
 UPDATE public.ferias_ferias SET quinzena_venda=1,dias_vendidos_q1=10,dias_vendidos_q2=0 WHERE id=v_id;
 UPDATE public.ferias_ferias SET quinzena_venda=2,dias_vendidos_q1=0,dias_vendidos_q2=10 WHERE id=v_id;
 UPDATE public.ferias_ferias SET quinzena_venda=3,dias_vendidos_q1=5,dias_vendidos_q2=5 WHERE id=v_id;
 PERFORM set_config('test.ferias_venda_resultado','9 verificações concluídas: gravação, totais, cancelamento, distribuição, envio e trocas',true);
END $$;
SELECT current_setting('test.ferias_venda_resultado') AS resultado;
ROLLBACK;