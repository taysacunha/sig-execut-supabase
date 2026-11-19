INSERT INTO public.dev_tracker_log (occurred_on, system_name, title, description, change_type, source)
SELECT now(), system_name, 'Formulário anual: data de início por mês e formato no topo',
'Cada um dos 3 meses escolhidos recebe sua própria data de início; formato (15/15 ou 30 dias) fica no início do formulário; mês único vira preferido automaticamente; a prévia escolhe a melhor combinação de meses mantendo as datas informadas de cada mês.',
change_type, source
FROM public.dev_tracker_log WHERE system_name ILIKE 'f%rias%' ORDER BY created_at DESC LIMIT 1;