-- Regressão de edição autenticada; reverte tudo, inclusive auditoria.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76","role":"authenticated"}',true);
DO $$ DECLARE n integer; BEGIN
 UPDATE public.despesas_lancamentos SET data_vencimento=public.despesas_hoje()-1 WHERE id='3fa4099b-8759-42f7-9ee3-fdcbc0406d80';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Fixture não acessível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.despesas_lancamentos WHERE id='3fa4099b-8759-42f7-9ee3-fdcbc0406d80' AND status='vencido') THEN RAISE EXCEPTION 'Não marcou atraso'; END IF;
 UPDATE public.despesas_lancamentos SET data_vencimento=public.despesas_hoje()+4 WHERE id='3fa4099b-8759-42f7-9ee3-fdcbc0406d80';
 IF NOT EXISTS(SELECT 1 FROM public.despesas_lancamentos WHERE id='3fa4099b-8759-42f7-9ee3-fdcbc0406d80' AND status='a_vencer' AND conta_bancaria_id='5633640c-65f6-4323-981b-beae87a343bd') THEN RAISE EXCEPTION 'Data futura ou vínculo histórico incorreto'; END IF;
END $$;
ROLLBACK;