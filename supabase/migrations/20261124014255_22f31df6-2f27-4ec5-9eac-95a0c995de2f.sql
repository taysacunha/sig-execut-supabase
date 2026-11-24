UPDATE public.dev_tracker_log SET hours = 2 WHERE id = '25331d82-0291-4a60-b979-878160c69fd2' AND (hours IS NULL OR hours <= 0);
UPDATE public.dev_tracker_log SET hours = 2.5 WHERE id = '6a5261b7-c7d8-4338-907f-987fa0125620' AND (hours IS NULL OR hours <= 0);
UPDATE public.dev_tracker_log SET hours = 3 WHERE id = 'ecbbd0a8-ef55-4b99-92a6-8b99908ec4cd' AND (hours IS NULL OR hours <= 0);

INSERT INTO public.dev_tracker_log (occurred_on, system_name, title, description, change_type, hours, source)
VALUES (DATE '2026-11-23', 'ferias', 'Gerador de férias: prévia sem rolagem lateral e sugestões para resolver conflitos',
'Dialog Gerar Férias Automaticamente ampliado e tabela reorganizada (setor e informações junto ao colaborador) para não exigir rolagem lateral. Aba Com conflitos passa a sugerir datas livres nos dois sentidos (manter um colaborador e mover o outro), respeitando setor, substitutos, período concessivo, ordem cronológica, meses bloqueados e o outro período; um clique aplica a data e recalcula os conflitos.',
'melhoria', 3, 'lovable');

ALTER TABLE public.dev_tracker_log DROP CONSTRAINT IF EXISTS dev_tracker_log_hours_positive;
ALTER TABLE public.dev_tracker_log ADD CONSTRAINT dev_tracker_log_hours_positive CHECK (hours > 0);