INSERT INTO public.dev_tracker_log (occurred_on, system_name, title, description, change_type, source)
SELECT now(), system_name, 'Venda de dias em férias de 30 dias direto',
'Formulário anual e gerador passam a aceitar venda de até 10 dias no formato 30 dias direto; o término passa a ser 30 dias menos os vendidos; regra do banco ajustada.',
change_type, source
FROM public.dev_tracker_log WHERE system_name ILIKE 'f%rias%' ORDER BY created_at DESC LIMIT 1;