BEGIN;
INSERT INTO public.despesas_contas_bancarias(id,nome) VALUES('00000000-0000-4000-8000-000000000103','Teste conta negada');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN
 UPDATE public.despesas_lancamentos SET conta_bancaria_id='00000000-0000-4000-8000-000000000103' WHERE id='3fa4099b-8759-42f7-9ee3-fdcbc0406d80';
 RAISE EXCEPTION 'Aceitou conta não marcada';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;