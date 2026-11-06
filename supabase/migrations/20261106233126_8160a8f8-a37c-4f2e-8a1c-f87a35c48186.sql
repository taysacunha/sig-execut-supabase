INSERT INTO public.dev_tracker_log (occurred_on, system_name, title, description, change_type, hours)
SELECT DATE '2026-11-06', 'ferias', '30 dias direto no gerador automático',
 'Opção de marcar 30 dias direto por colaborador na prévia do gerador automático (recalcula conflitos e salva como período único com exceção) e remoção do texto "(exceção das exceções)" do cadastro.',
 'melhoria', 2
WHERE NOT EXISTS (SELECT 1 FROM public.dev_tracker_log WHERE occurred_on = DATE '2026-11-06' AND title = '30 dias direto no gerador automático');