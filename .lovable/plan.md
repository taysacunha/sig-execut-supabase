## Objetivo

Ativar a execução automática diária do `despesas-scheduler` (gerar ocorrências, marcar atrasos e disparar notificações) usando `pg_cron` + `pg_net` no Supabase.

## Passo 1 — Habilitar extensões

No Supabase Dashboard → Database → Extensions, habilitar (se ainda não estiverem):
- `pg_cron`
- `pg_net`

Ambas ficam no schema `extensions` (padrão do Supabase). Não é necessário migration para isso.

## Passo 2 — Agendar o job (rodar no SQL Editor)

Como o SQL contém a URL do projeto e a anon key, ele **não** vai em migration — roda direto no SQL Editor do Supabase.

```sql
select cron.schedule(
  'despesas-scheduler-diario',
  '0 9 * * *',  -- todos os dias às 06:00 BRT (= 09:00 UTC)
  $$
  select net.http_post(
    url := 'https://msbhhsrtfqfqcsofnsuy.supabase.co/functions/v1/despesas-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYmhoc3J0ZnFmcWNzb2Zuc3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDgxMTcsImV4cCI6MjA4NzEyNDExN30.ZWYn_dqPRD4GXL-I8qCdStZ2VawmeUN_uG10qwLT_Ic',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYmhoc3J0ZnFmcWNzb2Zuc3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDgxMTcsImV4cCI6MjA4NzEyNDExN30.ZWYn_dqPRD4GXL-I8qCdStZ2VawmeUN_uG10qwLT_Ic'
    ),
    body := jsonb_build_object('trigger', 'cron', 'time', now()::text)
  ) as request_id;
  $$
);
```

Por que o `Authorization` também? A edge function `despesas-scheduler` está deployada com `verify_jwt = true` (padrão) e valida via `getClaims()`. A anon key é um JWT válido e permite a chamada — o service role interno da própria função é usado dentro dela para as operações privilegiadas.

## Passo 3 — Comandos de operação (opcionais, quando precisar)

Verificar se o job existe:
```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'despesas-scheduler-diario';
```

Ver últimas execuções e status HTTP:
```sql
select j.jobname, r.status, r.return_message, r.start_time, r.end_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'despesas-scheduler-diario'
order by r.start_time desc
limit 20;
```

Rodar manualmente uma vez agora (sem esperar o horário):
```sql
select net.http_post(
  url := 'https://msbhhsrtfqfqcsofnsuy.supabase.co/functions/v1/despesas-scheduler',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey','<ANON_KEY>',
    'Authorization','Bearer <ANON_KEY>'
  ),
  body := jsonb_build_object('trigger','manual')
);
```

Alterar horário / remover:
```sql
select cron.unschedule('despesas-scheduler-diario');
-- e reexecutar o cron.schedule com o novo horário
```

## Passo 4 — Validar

1. Após rodar o `cron.schedule`, consultar `cron.job` para confirmar `active = true`.
2. Disparar manualmente (`net.http_post` acima) e checar em Edge Function logs (link abaixo) se a função respondeu 200 e processou.
3. Confirmar que `despesas_lancamentos` recebeu novas ocorrências e `despesas_notificacoes` novas linhas.

## Notas técnicas

- Por que `pg_net`? `pg_cron` só executa SQL. Edge Functions rodam fora do Postgres, então a ponte é uma requisição HTTP interna ao próprio Supabase (não sai da infra). Nada externo é envolvido.
- Fuso: `pg_cron` usa **UTC**. Para 06:00 BRT (UTC-3) → `0 9 * * *`.
- Idempotência: a função já é segura para múltiplas execuções (não duplica ocorrências nem notificações).
- Se preferir rodar mais de uma vez por dia (ex.: 06:00 e 18:00 BRT), use `'0 9,21 * * *'` no mesmo `cron.schedule`.
