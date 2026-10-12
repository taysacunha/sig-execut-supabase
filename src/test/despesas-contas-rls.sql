-- Teste transacional: não deixa dados nem permissões de teste no projeto.
BEGIN;
INSERT INTO public.despesas_contas_bancarias(id,nome) VALUES
('00000000-0000-4000-8000-000000000101','Teste RLS conta A'),
('00000000-0000-4000-8000-000000000102','Teste RLS conta B');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.despesas_contas_lookup() WHERE id IN ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102')) THEN RAISE EXCEPTION 'Sem seleção permitiu conta'; END IF;
 BEGIN
 INSERT INTO public.despesas_contas_bancarias_permissoes(user_id,conta_bancaria_id) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000101');
 RAISE EXCEPTION 'Supervisor concedeu acesso a si próprio';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"f0c8292b-a4e5-4c90-b6fc-60491d2a85d8","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.despesas_contas_lookup() WHERE id IN ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102')) THEN RAISE EXCEPTION 'Admin operacional sem marcação'; END IF;
END $$;
INSERT INTO public.despesas_contas_bancarias_permissoes(user_id,conta_bancaria_id) VALUES('eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76','00000000-0000-4000-8000-000000000101');
SELECT set_config('request.jwt.claims','{"sub":"eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.despesas_contas_lookup() WHERE id IN ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102'))<>1 THEN RAISE EXCEPTION 'Uma marcação não persistiu'; END IF;
 IF EXISTS(SELECT 1 FROM public.despesas_contas_bancarias WHERE id='00000000-0000-4000-8000-000000000102') THEN RAISE EXCEPTION 'Consulta direta expôs conta não marcada'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"f0c8292b-a4e5-4c90-b6fc-60491d2a85d8","role":"authenticated"}',true);
INSERT INTO public.despesas_contas_bancarias_permissoes(user_id,conta_bancaria_id) VALUES('eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76','00000000-0000-4000-8000-000000000102');
SELECT set_config('request.jwt.claims','{"sub":"eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.despesas_contas_lookup() WHERE id IN ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102'))<>2 THEN RAISE EXCEPTION 'Duas marcações não persistiram'; END IF;
END $$;
ROLLBACK;