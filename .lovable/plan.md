
# Plano — Atualização da página `/dev/deploy-guide`

Confirmado: a página a reescrever é `src/pages/DeployGuide.tsx` (rota `/dev/deploy-guide`). Nenhum outro arquivo será alterado.

## Diagnóstico do estado atual

**Divergências entre o guia e o repositório**
1. **Edge Functions desatualizadas.** Guia lista 5 (`invite-user`, `list-users`, `manage-user`, `deactivate-expired-notice`, `log-dev-work`). Repositório tem 4: `invite-user`, `list-users`, `manage-user`, `despesas-scheduler`. As duas primeiras citadas não existem mais; a `despesas-scheduler` está ausente do guia.
2. **Migrations só via `pg_dump` do Cloud.** O projeto tem `db/migrations/` (147 arquivos) com README próprio explicando que essa pasta é a fonte única para self-hosted. Esse caminho não aparece no guia.
3. **Falta `pg_cron` + `pg_net`.** O `despesas-scheduler` só roda se essas extensões estiverem habilitadas e agendadas via `cron.schedule` + `net.http_post`. Sem isso, recorrências, notificações e marcação de vencidos param.
4. **Falta habilitação de extensões** (`pgcrypto`, `uuid-ossp`, `pg_cron`, `pg_net`) e do publication `supabase_realtime` para as tabelas assinadas.
5. **Deploy de Edge Functions via `supabase link --project-ref`.** Isso é Cloud. Em self-hosted o caminho é montar em `~/supabase/docker/volumes/functions/<name>/` e reiniciar o container `functions`.
6. **Backup incompleto.** Falta `auth.identities`, `auth.refresh_tokens` e opcionalmente `storage.objects/buckets` + pasta `storage/`.
7. **Import sem `session_replication_role = replica`.** Quebra ordem de FKs entre `auth.users` e `public.user_profiles/user_roles/system_access`.
8. **Sem pós-import** para conferir `GRANT`s, resetar sequences e rodar `ANALYZE`.
9. **`.env` do frontend** ainda tem `SUPABASE_URL` sem `VITE_` (não usado); manter só as `VITE_*`.
10. **Rota Nginx** `/functions/` errada; o correto no self-hosted (Kong) é `/functions/v1/`.
11. **Reset de senha** confuso. Precisa deixar claro que as **senhas continuam válidas** (hash bcrypt); só as sessões caem — cada usuário loga uma vez após a migração.

## Reformulação de `src/pages/DeployGuide.tsx`

Mantenho `CodeBlock`, `Step`, `WarningBox`, `InfoBox`, `SpecRow`, o cabeçalho e o card de troubleshooting. Reescrevo a lista de Steps para:

```text
1.  Especificações da VM (Ubuntu 24.04, RAM 16 GB recomendada, portas 22/80/443, IP fixo)
2.  Instalação base (Docker Engine + Compose plugin, Git, Node LTS via nvm, Supabase CLI, psql client)
3.  Supabase Self-Hosted via Docker Compose (clone, .env, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, DASHBOARD_*, SMTP)
4.  Habilitar extensões no Postgres (pgcrypto, uuid-ossp, pg_cron, pg_net) — rodar como superuser antes das migrations
5.  Criar o schema
    Caminho A (recomendado — banco novo): rodar db/migrations/*.sql em ordem alfabética/cronológica
    Caminho B (migração com dados do Cloud): pg_dump auth + pg_dump public + import com session_replication_role = replica
6.  Migrar usuários (auth.users, auth.identities, auth.refresh_tokens) + nota explícita sobre senhas bcrypt continuarem válidas
7.  Habilitar Realtime nas tabelas assinadas (ALTER PUBLICATION supabase_realtime ADD TABLE …)
8.  Deploy das Edge Functions atualizadas (invite-user, list-users, manage-user, despesas-scheduler) via volume mount
    ~/supabase/docker/volumes/functions/<nome>/ + docker compose restart functions
9.  Agendar despesas-scheduler com pg_cron + pg_net (cron.schedule diário chamando /functions/v1/despesas-scheduler)
10. Build do frontend (.env com apenas VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY, npm run build)
11. Nginx reverse proxy — rotas /rest/, /auth/, /realtime/v1/ (WebSocket), /storage/, /functions/v1/
12. HTTPS com Let's Encrypt (Certbot webroot, renovação via cron)
13. Acesso interno (intranet, sem domínio)
14. Backup automatizado (public + auth.users/identities/refresh_tokens + pasta storage/, retenção 30 dias, cópia externa via SMB/rsync)
15. Atualizações e manutenção (git pull → npm run build → copiar dist → docker compose restart; docker compose pull do Supabase)
16. Checklist final atualizado
17. Troubleshooting revisado (adiciona: cron.job_run_details vazio, edge function 404, realtime silencioso, GRANT ausente após import)
```

## Snippets-chave que entram no novo guia

**Extensões (Step 4)**
```sql
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

**Aplicar migrations do repo (Step 5A)**
```bash
for f in db/migrations/*.sql; do
  psql "postgresql://postgres:SENHA@localhost:5432/postgres" \
    -v ON_ERROR_STOP=1 -f "$f" || break
done
```

**Import Cloud → Self-hosted (Step 5B / Step 6)**
```bash
psql "$LOCAL" \
  -c "SET session_replication_role = replica;" \
  -f backup_auth.sql \
  -f backup_public.sql \
  -c "SET session_replication_role = origin;"
```

**Edge Functions no self-hosted (Step 8)**
```bash
cd ~/sig-execut
for fn in invite-user list-users manage-user despesas-scheduler; do
  cp -r supabase/functions/$fn ~/supabase/docker/volumes/functions/
done
cd ~/supabase/docker && docker compose restart functions
```

**pg_cron para despesas-scheduler (Step 9)**
```sql
select cron.schedule(
  'despesas-scheduler-diario',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://seudominio.com.br/functions/v1/despesas-scheduler',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
-- Conferir: select * from cron.job_run_details order by start_time desc limit 5;
```

**Rota correta no Nginx (Step 11)**
```nginx
location /functions/v1/ {
  proxy_pass http://localhost:8000/functions/v1/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
location /realtime/v1/ {
  proxy_pass http://localhost:8000/realtime/v1/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;
}
```

## Arquivo alterado

- `src/pages/DeployGuide.tsx` — reescrita completa mantendo os componentes visuais existentes.

## Fora do escopo

- Não altero Edge Functions, `supabase/config.toml`, migrations nem qualquer outro arquivo do backend/UI.
