INSERT INTO public.dev_tracker_log (occurred_on, system_name, title, description, change_type, source)
SELECT now(), system_name, 'Formulário anual com 3 meses priorizando o preferido',
'Gerador testa todos os meses informados, prioriza o preferido e só aceita conflito quando nenhum par está livre; prévia indica se o mês preferido foi atendido; dicas do formulário listam os meses.',
change_type, source
FROM public.dev_tracker_log WHERE system_name ILIKE 'f%rias%' ORDER BY created_at DESC LIMIT 1;