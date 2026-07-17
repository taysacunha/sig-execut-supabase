## Objetivo

Confirmar que o `despesas-scheduler` está funcionando de ponta a ponta (cron → HTTP → edge function → banco), já que o teste manual anterior usou `<ANON_KEY>` literal e não chegou a invocar a função (os logs mostram apenas `shutdown`, sem execução recente).

## O que já está OK

- `cron.schedule('despesas-scheduler-diario', '0 9 * * *', ...)` foi criado com sucesso (job id = 2). Roda todo dia às 09:00 UTC = 06:00 BRT.

## O que falta validar

### Passo 1 — Disparo manual REAL (com a anon key correta)

Rode no SQL Editor exatamente este bloco (a chave já está preenchida, sem placeholder):

```sql
select net.http_post(
  url := 'https://msbhhsrtfqfqcsofnsuy.supabase.co/functions/v1/despesas-scheduler',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYmhoc3J0ZnFmcWNzb2Zuc3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDgxMTcsImV4cCI6MjA4NzEyNDExN30.ZWYn_dqPRD4GXL-I8qCdStZ2VawmeUN_uG10qwLT_Ic',
    'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYmhoc3J0ZnFmcWNzb2Zuc3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NDgxMTcsImV4cCI6MjA4NzEyNDExN30.ZWYn_dqPRD4GXL-I8qCdStZ2VawmeUN_uG10qwLT_Ic'
  ),
  body := jsonb_build_object('trigger','manual','time', now()::text)
);
```

Anote o `request_id` retornado.

### Passo 2 — Conferir a resposta HTTP real

```sql
select id, created, status_code, content::text, error_msg
from net._http_response
where id = <request_id_do_passo_1>;
```

Esperado: `status_code = 200` e um `content` JSON de sucesso do scheduler.

### Passo 3 — Conferir efeitos no banco

```sql
-- Ocorrências geradas por recorrências
select count(*) filter (where created_at > now() - interval '10 minutes') as novas_ocorrencias
from despesas_lancamentos;

-- Notificações geradas
select count(*) filter (where created_at > now() - interval '10 minutes') as novas_notificacoes
from despesas_notificacoes;
```

Observação: se ainda não houver `despesas_recorrencias` ativas nem lançamentos próximos do vencimento, os contadores podem legitimamente ficar em `0` — nesse caso o sucesso é o `status_code = 200` do passo 2.

### Passo 4 — Histórico do cron (quando quiser conferir amanhã)

```sql
select jobid, runid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = 2
order by start_time desc
limit 5;
```

## Diagnóstico

- Se o passo 2 vier com `status_code = 401` → chave errada; refazer com a anon key deste projeto.
- Se vier `status_code = 500` → me mande o `content` e eu ajusto a edge function.
- Se `net._http_response` estiver vazio → `pg_net` não processou; verificar se a extensão está ativa em Dashboard → Database → Extensions.

## Cole aqui

O resultado dos passos 2 e 3 (e o do passo 4 amanhã, se quiser confirmar a execução automática).  
  
Rodei o SQL do passo 1 e apareceu isso: | http_post |

| --------- |

| 4         |  


Passo 2: Failed to run sql query: ERROR:  42601: syntax error at or near "<"

```
LINE 3: where id = <request_id_do_passo_1> limit 100;
```

```
                   ^
```

Note: A limit of 100 was applied to your query. If this was the cause of a syntax error, try selecting "No limit" instead and re-run the query.  
  
Passo 3: | novas_notificacoes |

| ------------------ |

| 0                  |  
  
Passo 4: Success. No rows returned