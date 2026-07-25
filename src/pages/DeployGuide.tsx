import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Terminal, AlertTriangle, Info } from "lucide-react";
import { Link } from "react-router-dom";

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="bg-muted/70 border rounded-md p-4 text-sm overflow-x-auto my-3 font-mono whitespace-pre-wrap">
    {children}
  </pre>
);

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="mb-10">
    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">{n}</span>
      {title}
    </h3>
    <div className="pl-9 space-y-2 text-sm text-foreground/90 leading-relaxed">{children}</div>
  </div>
);

const WarningBox = ({ children }: { children: React.ReactNode }) => (
  <Card className="my-4 border-destructive/30 bg-destructive/5">
    <CardContent className="py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
      <div className="text-sm">{children}</div>
    </CardContent>
  </Card>
);

const InfoBox = ({ children }: { children: React.ReactNode }) => (
  <Card className="my-4 border-primary/20 bg-primary/5">
    <CardContent className="py-3 flex items-start gap-3">
      <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="text-sm">{children}</div>
    </CardContent>
  </Card>
);

const SpecRow = ({ label, min, rec }: { label: string; min: string; rec: string }) => (
  <tr className="border-b border-border">
    <td className="py-2 px-3 font-medium">{label}</td>
    <td className="py-2 px-3">{min}</td>
    <td className="py-2 px-3 text-primary font-medium">{rec}</td>
  </tr>
);

const DeployGuide = () => {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/auth">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Guia de Deploy Self-Hosted</h1>
          <p className="text-muted-foreground text-sm">VM Linux (Ubuntu LTS) no Windows Server 2022 · Supabase Self-Hosted · Docker · Nginx</p>
        </div>
      </div>

      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-start gap-3">
          <Terminal className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Stack utilizada:</p>
            <p className="text-muted-foreground">Windows Server 2022 (Hyper-V) → VM Ubuntu 24.04 LTS · Docker Engine · Supabase Self-Hosted · Nginx · Let's Encrypt (Certbot)</p>
          </div>
        </CardContent>
      </Card>

      {/* ============ STEP 1 — Especificações da VM ============ */}
      <Step n={1} title="Especificações da VM Linux">
        <p>A VM será criada via <strong>Hyper-V</strong> no Windows Server 2022. Abaixo as especificações mínimas e recomendadas:</p>

        <Card className="my-4">
          <CardContent className="py-0 px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="py-2 px-3 text-left font-semibold">Recurso</th>
                  <th className="py-2 px-3 text-left font-semibold">Mínimo</th>
                  <th className="py-2 px-3 text-left font-semibold">Recomendado</th>
                </tr>
              </thead>
              <tbody>
                <SpecRow label="S.O. da VM" min="Ubuntu 22.04 LTS" rec="Ubuntu 24.04 LTS" />
                <SpecRow label="vCPU" min="4 vCPUs" rec="6 vCPUs" />
                <SpecRow label="RAM" min="8 GB" rec="16 GB" />
                <SpecRow label="Disco" min="80 GB SSD" rec="120 GB+ SSD" />
                <SpecRow label="Rede" min="Bridge (IP fixo na rede)" rec="Bridge com IP estático" />
              </tbody>
            </table>
          </CardContent>
        </Card>

        <InfoBox>
          <p><strong>Por que esses valores?</strong> O Supabase self-hosted roda ~15 containers Docker (PostgreSQL, GoTrue, PostgREST, Realtime, Storage, Studio, Edge Functions, etc.). Sozinho consome ~4-6 GB de RAM. Com Nginx + frontend, o total fica entre 6-10 GB em uso normal.</p>
        </InfoBox>

        <p><strong>Portas que devem estar abertas:</strong></p>
        <Card className="my-3">
          <CardContent className="py-0 px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="py-2 px-3 text-left font-semibold">Porta</th>
                  <th className="py-2 px-3 text-left font-semibold">Protocolo</th>
                  <th className="py-2 px-3 text-left font-semibold">Uso</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2 px-3 font-mono">22</td>
                  <td className="py-2 px-3">TCP</td>
                  <td className="py-2 px-3">SSH — acesso remoto para gerenciamento</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 px-3 font-mono">80</td>
                  <td className="py-2 px-3">TCP</td>
                  <td className="py-2 px-3">HTTP — redirecionamento para HTTPS + desafio ACME (Let's Encrypt)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 px-3 font-mono">443</td>
                  <td className="py-2 px-3">TCP</td>
                  <td className="py-2 px-3">HTTPS — frontend + API Supabase (proxy reverso via Nginx)</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <WarningBox>
          <p>Configure as portas <strong>no Hyper-V</strong> (switch virtual), no <strong>Firewall do Windows Server</strong> (regras de entrada) e no <strong>firewall da VM</strong> (ufw). As três camadas precisam permitir o tráfego.</p>
        </WarningBox>

        <p><strong>1.1 — Criar a VM no Hyper-V:</strong></p>
        <CodeBlock>{`# No Windows Server 2022, abra o Hyper-V Manager:
# 1. Ação → Novo → Máquina Virtual
# 2. Nome: SIG-Execut-VM
# 3. Geração: 2 (UEFI)
# 4. Memória: 16384 MB (ou 8192 mín.), desabilitar memória dinâmica
# 5. Rede: selecione o Virtual Switch externo (bridge para rede física)
# 6. Disco: Criar disco virtual VHDX de 120 GB
# 7. ISO: Selecionar ubuntu-24.04-live-server-amd64.iso
# 8. Concluir e iniciar

# Após instalar o Ubuntu, configure IP estático:
sudo nano /etc/netplan/00-installer-config.yaml`}</CodeBlock>
        <CodeBlock>{`# Exemplo de configuração de IP estático:
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]`}</CodeBlock>
        <CodeBlock>{`sudo netplan apply`}</CodeBlock>

        <p><strong>1.2 — Configurar firewall na VM:</strong></p>
        <CodeBlock>{`sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status`}</CodeBlock>
      </Step>

      {/* ============ STEP 2 — Instalação base ============ */}
      <Step n={2} title="Instalação base (Docker, Git, Node, Supabase CLI, psql)">
        <p><strong>2.1 — Docker Engine (direto no Ubuntu):</strong></p>
        <CodeBlock>{`# Atualizar pacotes:
sudo apt-get update && sudo apt-get upgrade -y

# Instalar dependências:
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Adicionar repositório oficial do Docker:
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \\
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) \\
  signed-by=/etc/apt/keyrings/docker.gpg] \\
  https://download.docker.com/linux/ubuntu \\
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \\
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \\
  docker-buildx-plugin docker-compose-plugin

# Habilitar Docker sem sudo:
sudo usermod -aG docker $USER
# Faça logout e login novamente

# Verificar instalação:
docker --version
docker compose version`}</CodeBlock>

        <InfoBox>
          <p>O Docker Engine no Ubuntu inicia automaticamente via systemd. Não é necessário configurar auto-start manualmente como seria no WSL2.</p>
        </InfoBox>

        <p><strong>2.2 — Git, Node.js e Supabase CLI:</strong></p>
        <CodeBlock>{`# Git:
sudo apt-get install -y git

# Node.js via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
node --version && npm --version

# Supabase CLI (opcional no self-hosted — usado só para gerar tipos
# ou rodar tarefas locais; o deploy de funções aqui é via volume mount):
npm install -g supabase
supabase --version

# PostgreSQL Client (para backups):
sudo apt-get install -y postgresql-client`}</CodeBlock>
      </Step>

      {/* ============ STEP 3 ============ */}
      <Step n={3} title="Supabase Self-Hosted via Docker Compose">
        <p><strong>3.1 — Clonar o repositório oficial:</strong></p>
        <CodeBlock>{`cd ~
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker`}</CodeBlock>

        <p><strong>3.2 — Configurar variáveis de ambiente:</strong></p>
        <CodeBlock>{`cp .env.example .env
nano .env`}</CodeBlock>
        <p>Altere as seguintes variáveis obrigatórias:</p>
        <CodeBlock>{`# === SEGURANÇA (OBRIGATÓRIO ALTERAR) ===
POSTGRES_PASSWORD=SuaSenhaForteAqui123!
JWT_SECRET=SuaChaveJWTSuperSecreta_minimo32caracteres
ANON_KEY=gere_em_https://supabase.com/docs/guides/self-hosting#api-keys
SERVICE_ROLE_KEY=gere_no_mesmo_link_acima
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=SuaSenhaDoDashboard

# === URLs ===
SITE_URL=https://seudominio.com.br
API_EXTERNAL_URL=https://seudominio.com.br
SUPABASE_PUBLIC_URL=https://seudominio.com.br

# === SMTP (para convites e recuperação de senha) ===
SMTP_ADMIN_EMAIL=noreply@seudominio.com.br
SMTP_HOST=smtp.seuprovedordeemail.com
SMTP_PORT=587
SMTP_USER=seu_usuario_smtp
SMTP_PASS=sua_senha_smtp
SMTP_SENDER_NAME=SIG Execut
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify`}</CodeBlock>

        <WarningBox>
          <p><strong>SMTP é obrigatório</strong> para o sistema funcionar! Sem ele, convites de usuários, confirmação de e-mail e recuperação de senha não funcionam. Provedores gratuitos: <strong>Brevo</strong> (300 e-mails/dia grátis), <strong>Resend</strong> (100 e-mails/dia grátis).</p>
        </WarningBox>

        <p><strong>3.3 — Gerar JWT Keys:</strong></p>
        <p>Acesse o gerador oficial: <code>https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys</code></p>
        <p>Informe o <code>JWT_SECRET</code> definido acima e copie as chaves <code>anon</code> e <code>service_role</code> geradas.</p>

        <p><strong>3.4 — Subir os containers:</strong></p>
        <CodeBlock>{`docker compose up -d

# Verifique se todos estão rodando (~15 containers):
docker compose ps

# Acesse o Studio em: http://IP-DA-VM:8000
# Login com DASHBOARD_USERNAME e DASHBOARD_PASSWORD`}</CodeBlock>
      </Step>

      {/* ============ STEP 4 — Extensões ============ */}
      <Step n={4} title="Habilitar extensões no PostgreSQL">
        <p>O sistema depende de quatro extensões. Rode como superuser (dentro do container do banco) <strong>antes</strong> de aplicar migrations ou importar dumps.</p>

        <CodeBlock>{`# Conectar via psql do container:
docker compose exec db psql -U postgres -d postgres

# Dentro do psql, executar:
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;
create extension if not exists pg_net;

# Conferir:
\\dx`}</CodeBlock>

        <InfoBox>
          <p><strong>Para que servem:</strong> <code>pgcrypto</code> e <code>uuid-ossp</code> geram UUIDs/hashes usados pelas migrations. <code>pg_cron</code> agenda tarefas dentro do próprio banco. <code>pg_net</code> permite chamadas HTTP a partir do banco — necessário para o <code>despesas-scheduler</code> (Step 9).</p>
        </InfoBox>

        <WarningBox>
          <p>Se <code>create extension pg_cron</code> falhar com "extension not available", pare os containers, edite <code>~/supabase/docker/volumes/db/postgresql.conf</code> (ou o override no compose) e garanta <code>shared_preload_libraries = 'pg_cron'</code> + <code>cron.database_name = 'postgres'</code>. Depois <code>docker compose up -d db</code> e tente de novo.</p>
        </WarningBox>
      </Step>

      {/* ============ STEP 5 — Criar o schema ============ */}
      <Step n={5} title="Criar o schema do sistema">
        <p>Existem dois caminhos. Escolha um.</p>

        <p className="mt-4"><strong>5.A — Banco novo (recomendado):</strong> aplicar as migrations do repositório.</p>
        <p>A pasta <code>db/migrations/</code> do projeto SIG Execut contém todas as migrations em ordem cronológica (~150 arquivos, idempotentes). É a fonte única de verdade para self-hosted, documentada em <code>db/migrations/README.md</code>.</p>

        <CodeBlock>{`# Clonar o projeto na VM:
cd ~
git clone https://github.com/seu-usuario/sig-execut.git
cd sig-execut

# Aplicar todas as migrations em ordem (falha na primeira que der erro):
for f in db/migrations/*.sql; do
  echo "→ $f"
  psql "postgresql://postgres:SuaSenhaForteAqui123!@localhost:5432/postgres" \\
    -v ON_ERROR_STOP=1 -f "$f" || break
done`}</CodeBlock>

        <InfoBox>
          <p>As migrations são <strong>idempotentes</strong> — usam <code>IF NOT EXISTS</code>, <code>CREATE OR REPLACE</code>, <code>DROP POLICY IF EXISTS</code> antes de <code>CREATE POLICY</code>, etc. Rodar duas vezes não quebra nada.</p>
        </InfoBox>

        <p className="mt-6"><strong>5.B — Migração com dados vindos do Supabase Cloud:</strong> exportar via <code>pg_dump</code> e importar.</p>
        <p>No dashboard do Supabase Cloud: <strong>Settings → Database → Connection String → URI</strong>.</p>

        <CodeBlock>{`# 1) Exportar schema public (estrutura + dados):
pg_dump "postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \\
  --clean --if-exists --no-owner --no-privileges \\
  --schema=public \\
  -f backup_public.sql

# 2) Exportar dados de autenticação (só data, o schema já existe no self-hosted):
pg_dump "postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \\
  --data-only --no-owner --no-privileges \\
  --table=auth.users \\
  --table=auth.identities \\
  --table=auth.refresh_tokens \\
  -f backup_auth.sql`}</CodeBlock>

        <p>Importar na ordem correta, com FKs desabilitadas na sessão para evitar problemas de dependência entre <code>auth.users</code> e as tabelas do <code>public</code> que referenciam usuários (<code>user_profiles</code>, <code>user_roles</code>, <code>system_access</code>):</p>

        <CodeBlock>{`LOCAL="postgresql://postgres:SuaSenhaForteAqui123!@localhost:5432/postgres"

psql "$LOCAL" \\
  -v ON_ERROR_STOP=1 \\
  -c "SET session_replication_role = replica;" \\
  -f backup_auth.sql \\
  -f backup_public.sql \\
  -c "SET session_replication_role = origin;"

# Pós-import — reindexar, atualizar estatísticas e sequences:
psql "$LOCAL" -c "REINDEX DATABASE postgres;"
psql "$LOCAL" -c "ANALYZE;"`}</CodeBlock>

        <WarningBox>
          <p>Confira depois se todas as tabelas do <code>public</code> têm <code>GRANT</code> para <code>anon</code>/<code>authenticated</code>/<code>service_role</code>. Se alguma view/tabela responder com <code>permission denied</code>, rode o <code>GRANT</code> exato que o HINT do Postgres sugerir. As migrations do caminho A já fazem isso; no caminho B pode faltar em tabelas antigas.</p>
        </WarningBox>

        <p><strong>5.C — Verificar:</strong> acesse o Studio em <code>http://IP-DA-VM:8000</code> e confira as tabelas em <em>Table Editor</em>.</p>
      </Step>

      {/* ============ STEP 6 — Auth ============ */}
      <Step n={6} title="Usuários e sessões após a migração">
        <p>Se você seguiu o <strong>caminho 5.B</strong>, os usuários já estão no banco. Não é preciso reimportar aqui.</p>

        <InfoBox>
          <p><strong>Senhas continuam válidas.</strong> O hash bcrypt em <code>auth.users.encrypted_password</code> não depende do <code>JWT_SECRET</code>. O que muda é que o novo servidor assina JWTs com um <code>JWT_SECRET</code> diferente do Cloud — por isso as <strong>sessões ativas</strong> caem e cada usuário faz login uma vez após a virada, usando a mesma senha de sempre.</p>
        </InfoBox>

        <p><strong>Fazer o primeiro super_admin apontar para o novo ambiente</strong> (se você não migrou os dados do Cloud):</p>

        <CodeBlock>{`# Crie o usuário pelo Studio (Authentication → Users → Add user)
# ou pelo próprio /auth do sistema, depois execute:

insert into public.user_roles (user_id, role)
select id, 'super_admin'::app_role
from auth.users
where email = 'seu-email@empresa.com'
on conflict (user_id, role) do nothing;

insert into public.system_access (user_id, system_name, permission_type)
select id, s, 'view_edit'
from auth.users cross join unnest(
  array['escalas','vendas','ferias','estoque','despesas']
) as s
where email = 'seu-email@empresa.com'
on conflict do nothing;`}</CodeBlock>
      </Step>

      {/* ============ STEP 7 — Realtime publication ============ */}
      <Step n={7} title="Habilitar Realtime nas tabelas assinadas">
        <p>Vários módulos (notificações de despesas, estoque, etc.) usam <code>supabase.channel(...).on('postgres_changes', ...)</code>. Cada uma dessas tabelas precisa estar no publication <code>supabase_realtime</code>.</p>

        <CodeBlock>{`-- Ajuste a lista conforme os módulos que sua instalação vai usar.
alter publication supabase_realtime add table public.despesas_notificacoes;
alter publication supabase_realtime add table public.estoque_notificacoes;
alter publication supabase_realtime add table public.despesas_lancamentos;
alter publication supabase_realtime add table public.estoque_solicitacoes;

-- Conferir:
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by 1,2;`}</CodeBlock>

        <InfoBox>
          <p>Se ver o erro <em>"relation is already member of publication"</em>, ignore — significa que já está adicionada.</p>
        </InfoBox>
      </Step>

      {/* ============ STEP 8 — Edge Functions ============ */}
      <Step n={8} title="Deploy das Edge Functions">
        <p>O sistema tem <strong>4 Edge Functions</strong>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>invite-user</code> — convite de novos usuários por e-mail</li>
          <li><code>list-users</code> — listagem de usuários (usado no Gerenciamento de Usuários)</li>
          <li><code>manage-user</code> — ativar/desativar/excluir usuários</li>
          <li><code>despesas-scheduler</code> — rotina diária do módulo Despesas (gera ocorrências de recorrências, marca vencidos, cria notificações)</li>
        </ul>

        <p><strong>8.1 — Copiar as funções para o volume do container:</strong></p>
        <CodeBlock>{`cd ~/sig-execut

for fn in invite-user list-users manage-user despesas-scheduler; do
  cp -r supabase/functions/$fn ~/supabase/docker/volumes/functions/
done

# Reiniciar o container que serve as funções:
cd ~/supabase/docker
docker compose restart functions

# Conferir os logs:
docker compose logs -f functions`}</CodeBlock>

        <InfoBox>
          <p>No Supabase Self-Hosted não se usa <code>supabase link --project-ref</code> (isso é do Cloud). O deploy é o <strong>volume mount</strong> acima: o container <code>functions</code> lê tudo que estiver em <code>volumes/functions/&lt;nome&gt;/index.ts</code>.</p>
        </InfoBox>

        <p><strong>8.2 — Testar uma função:</strong></p>
        <CodeBlock>{`curl -i https://seudominio.com.br/functions/v1/despesas-scheduler \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \\
  -d '{}'

# Resposta esperada:
# {"ok":true,"resumo":{"series":0,"criadas":0,"vencidos_marcados":0,"notificacoes":0,"erros":[]}}`}</CodeBlock>
      </Step>

      {/* ============ STEP 9 — pg_cron ============ */}
      <Step n={9} title="Agendar o despesas-scheduler (pg_cron + pg_net)">
        <p>O módulo Despesas depende de uma rodada diária do <code>despesas-scheduler</code> para materializar recorrências, marcar lançamentos vencidos e disparar notificações. O disparo é feito pelo próprio banco via <code>pg_cron</code>.</p>

        <CodeBlock>{`-- Rodar como superuser dentro do banco (Studio → SQL Editor ou psql):
select cron.schedule(
  'despesas-scheduler-diario',
  '0 6 * * *',   -- todo dia às 06:00 UTC
  $$
  select net.http_post(
    url := 'https://seudominio.com.br/functions/v1/despesas-scheduler',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer <SERVICE_ROLE_KEY_REAL>'
    ),
    body := '{}'::jsonb
  );
  $$
);`}</CodeBlock>

        <p><strong>Conferir se está executando:</strong></p>
        <CodeBlock>{`-- Últimas execuções (status_code, content, error_msg):
select job_run_details.*, net_http_response.status_code, net_http_response.content
from cron.job_run_details
left join net._http_response net_http_response
  on net_http_response.id::text = job_run_details.return_message
order by start_time desc
limit 10;

-- Listar jobs cadastrados:
select * from cron.job;

-- Remover, se precisar recriar:
-- select cron.unschedule('despesas-scheduler-diario');`}</CodeBlock>

        <WarningBox>
          <p>Substitua <code>&lt;SERVICE_ROLE_KEY_REAL&gt;</code> pelo valor real da <code>SERVICE_ROLE_KEY</code> gerada no Step 3. Sem essa chave, a chamada retorna 401 e o scheduler não roda.</p>
        </WarningBox>
      </Step>

      {/* ============ STEP 10 — Frontend ============ */}
      <Step n={10} title="Build do Frontend (SIG Execut)">
        <p><strong>10.1 — Configurar variáveis de ambiente:</strong></p>
        <CodeBlock>{`cd ~/sig-execut

cat > .env << 'EOF'
VITE_SUPABASE_URL=https://seudominio.com.br
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key_gerada_no_step3
EOF`}</CodeBlock>

        <WarningBox>
          <p>Apenas as duas variáveis <code>VITE_*</code> acima são lidas em tempo de build pelo cliente Supabase. A URL deve ser exatamente a URL pública onde o Nginx atende — o proxy encaminha <code>/rest/</code>, <code>/auth/</code>, <code>/realtime/v1/</code>, <code>/storage/</code> e <code>/functions/v1/</code> para o Kong do Supabase.</p>
        </WarningBox>

        <p><strong>10.2 — Build de produção:</strong></p>
        <CodeBlock>{`npm install
npm run build
# A pasta dist/ será gerada com os arquivos estáticos`}</CodeBlock>
      </Step>

      {/* ============ STEP 11 — Nginx ============ */}
      <Step n={11} title="Nginx como Reverse Proxy + HTTPS">
        <p><strong>8.1 — Estrutura de arquivos:</strong></p>
        <CodeBlock>{`~/sig-deploy/
├── dist/                  ← Build do frontend (copiar de sig-execut/dist/)
├── nginx/
│   └── default.conf       ← Configuração do Nginx
├── certbot/
│   ├── conf/              ← Certificados SSL
│   └── www/               ← Desafio ACME
└── docker-compose.yml     ← Nginx container`}</CodeBlock>

        <p><strong>11.2 — Configuração do Nginx (<code>nginx/default.conf</code>):</strong></p>
        <CodeBlock>{`# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name seudominio.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name seudominio.com.br;

    ssl_certificate /etc/letsencrypt/live/seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com.br/privkey.pem;

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 50M;

    # ====== Frontend (SPA React) ======
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;

        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # ====== Supabase REST API ======
    location /rest/ {
        proxy_pass http://localhost:8000/rest/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ====== Supabase Auth ======
    location /auth/ {
        proxy_pass http://localhost:8000/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ====== Supabase Realtime (WebSocket) ======
    location /realtime/v1/ {
        proxy_pass http://localhost:8000/realtime/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    # ====== Supabase Storage ======
    location /storage/ {
        proxy_pass http://localhost:8000/storage/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ====== Supabase Edge Functions ======
    location /functions/v1/ {
        proxy_pass http://localhost:8000/functions/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`}</CodeBlock>

        <InfoBox>
          <p>Na VM Linux, o Nginx acessa os containers Supabase via <code>localhost</code> (não <code>host.docker.internal</code>). Se o Nginx também rodar em Docker, use <code>--network host</code> ou crie uma rede Docker compartilhada.</p>
        </InfoBox>

        <p><strong>11.3 — Docker Compose para o Nginx:</strong></p>
        <CodeBlock>{`# ~/sig-deploy/docker-compose.yml
version: "3.8"
services:
  nginx:
    image: nginx:alpine
    network_mode: host
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    restart: always`}</CodeBlock>

        <InfoBox>
          <p>Usando <code>network_mode: host</code> o container Nginx compartilha a rede da VM, acessando os containers Supabase via <code>localhost:8000</code> diretamente. Não é necessário mapear portas 80/443 separadamente.</p>
        </InfoBox>
      </Step>

      {/* ============ STEP 12 ============ */}
      <Step n={12} title="HTTPS com Let's Encrypt (Certbot)">
        <p><strong>Pré-requisitos:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>DNS A record do domínio apontando para o IP público do servidor</li>
          <li>Portas 80 e 443 abertas (VM + Windows Server + roteador)</li>
        </ul>

        <p><strong>12.1 — Gerar certificado:</strong></p>
        <CodeBlock>{`# Suba o Nginx apenas com HTTP primeiro (comente o bloco 443):
cd ~/sig-deploy
docker compose up -d

# Gerar certificado:
docker run --rm --network host \\
  -v ~/sig-deploy/certbot/conf:/etc/letsencrypt \\
  -v ~/sig-deploy/certbot/www:/var/www/certbot \\
  certbot/certbot certonly --webroot \\
  -w /var/www/certbot \\
  -d seudominio.com.br \\
  --email seu@email.com \\
  --agree-tos --no-eff-email

# Descomente o bloco 443 e reinicie:
docker compose restart`}</CodeBlock>

        <p><strong>12.2 — Renovação automática (cron):</strong></p>
        <CodeBlock>{`# ~/sig-deploy/renew-cert.sh
#!/bin/bash
docker run --rm --network host \\
  -v ~/sig-deploy/certbot/conf:/etc/letsencrypt \\
  -v ~/sig-deploy/certbot/www:/var/www/certbot \\
  certbot/certbot renew --quiet

cd ~/sig-deploy && docker compose exec nginx nginx -s reload`}</CodeBlock>
        <CodeBlock>{`chmod +x ~/sig-deploy/renew-cert.sh

# Agendar no crontab para rodar a cada 60 dias:
crontab -e
# Adicione:
0 3 */60 * * /root/sig-deploy/renew-cert.sh >> /var/log/certbot-renew.log 2>&1`}</CodeBlock>
      </Step>

      {/* ============ STEP 13 ============ */}
      <Step n={13} title="Acesso Interno (Intranet) — Sem domínio">
        <p>Se o sistema será acessado apenas pela rede interna:</p>
        <CodeBlock>{`# No default.conf do Nginx, use:
server_name _;  # Aceita qualquer hostname

# Não precisa de HTTPS para intranet (use apenas o bloco :80)

# Acesse pelo IP da VM:
# http://192.168.1.100

# Para resolver por nome nos computadores da rede:
# Edite C:\\Windows\\System32\\drivers\\etc\\hosts em cada máquina:
192.168.1.100  sig-execut.local`}</CodeBlock>
      </Step>

      {/* ============ STEP 14 — Backup ============ */}
      <Step n={14} title="Backup Automatizado">
        <InfoBox>
          <p><strong>Estratégia de backup:</strong> dump diário do schema <code>public</code>, dump dos dados de autenticação (<code>auth.users</code>, <code>auth.identities</code>, <code>auth.refresh_tokens</code>) e cópia da pasta física de storage. Retenção de 30 dias e cópia externa para NAS/rsync.</p>
        </InfoBox>

        <p><strong>14.1 — Script de backup:</strong></p>
        <CodeBlock>{`# ~/sig-deploy/backup.sh
#!/bin/bash
set -euo pipefail
BACKUP_DIR=~/backups
DATE=$(date +%Y-%m-%d_%H%M)
mkdir -p $BACKUP_DIR

# Backup do schema public
pg_dump "postgresql://postgres:SuaSenhaForteAqui123!@localhost:5432/postgres" \\
  --no-owner --no-privileges --schema=public \\
  -f "$BACKUP_DIR/public_$DATE.sql"

# Backup dos usuários e sessões (auth)
pg_dump "postgresql://postgres:SuaSenhaForteAqui123!@localhost:5432/postgres" \\
  --data-only --no-owner --no-privileges \\
  --table=auth.users --table=auth.identities --table=auth.refresh_tokens \\
  -f "$BACKUP_DIR/auth_$DATE.sql"

# Backup da pasta de storage (arquivos enviados via Supabase Storage)
STORAGE_DIR=~/supabase/docker/volumes/storage
tar -czf "$BACKUP_DIR/storage_$DATE.tar.gz" -C "$STORAGE_DIR" . 2>/dev/null || true

# Comprimir dumps SQL num único arquivo
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" \\
  -C "$BACKUP_DIR" \\
  "public_$DATE.sql" "auth_$DATE.sql"

# Limpar arquivos soltos
rm "$BACKUP_DIR/public_$DATE.sql" "$BACKUP_DIR/auth_$DATE.sql"

# Manter apenas últimos 30 backups
ls -t $BACKUP_DIR/backup_*.tar.gz  | tail -n +31 | xargs -r rm
ls -t $BACKUP_DIR/storage_*.tar.gz | tail -n +31 | xargs -r rm

echo "$(date): Backup completo - backup_$DATE.tar.gz" >> /var/log/backup.log`}</CodeBlock>
        <CodeBlock>{`chmod +x ~/sig-deploy/backup.sh

# Agendar backup diário às 2h da manhã:
crontab -e
# Adicione:
0 2 * * * /root/sig-deploy/backup.sh >> /var/log/backup.log 2>&1`}</CodeBlock>

        <p><strong>14.2 — Cópia externa (recomendado):</strong></p>
        <CodeBlock>{`# Opção A: Copiar para pasta compartilhada do Windows Server (SMB)
# Monte o compartilhamento:
sudo apt-get install -y cifs-utils
sudo mkdir -p /mnt/backup-share
sudo mount -t cifs //WINDOWS-SERVER/Backups /mnt/backup-share \\
  -o username=backup_user,password=senha,uid=1000

# Adicione ao script de backup:
cp "$BACKUP_DIR/backup_$DATE.tar.gz" /mnt/backup-share/
cp "$BACKUP_DIR/storage_$DATE.tar.gz" /mnt/backup-share/

# Opção B: rsync para outro servidor
rsync -az ~/backups/ usuario@servidor-externo:/backups/sig-execut/`}</CodeBlock>
      </Step>

      {/* ============ STEP 15 ============ */}
      <Step n={15} title="Atualizações e Manutenção">
        <p><strong>Atualizar o frontend:</strong></p>
        <CodeBlock>{`cd ~/sig-execut
git pull
npm install
npm run build
cp -r dist/* ~/sig-deploy/dist/
cd ~/sig-deploy && docker compose restart`}</CodeBlock>

        <p><strong>Aplicar novas migrations do repositório:</strong></p>
        <CodeBlock>{`cd ~/sig-execut && git pull

# As migrations são idempotentes — rodar tudo de novo é seguro:
for f in db/migrations/*.sql; do
  psql "postgresql://postgres:SENHA@localhost:5432/postgres" \\
    -v ON_ERROR_STOP=1 -f "$f" || break
done`}</CodeBlock>

        <p><strong>Atualizar Edge Functions após um pull:</strong></p>
        <CodeBlock>{`cd ~/sig-execut && git pull
for fn in invite-user list-users manage-user despesas-scheduler; do
  rsync -a --delete supabase/functions/$fn/ ~/supabase/docker/volumes/functions/$fn/
done
cd ~/supabase/docker && docker compose restart functions`}</CodeBlock>

        <p><strong>Atualizar o Supabase:</strong></p>
        <CodeBlock>{`cd ~/supabase/docker
git pull
docker compose pull
docker compose up -d`}</CodeBlock>

        <p><strong>Monitorar containers:</strong></p>
        <CodeBlock>{`# Ver status de todos:
docker compose ps

# Logs em tempo real:
docker compose logs -f

# Logs de um serviço específico:
docker compose logs -f rest       # API REST
docker compose logs -f auth       # Autenticação
docker compose logs -f functions  # Edge Functions

# Uso de recursos da VM:
htop
df -h   # Espaço em disco
free -h # Memória`}</CodeBlock>
      </Step>

      {/* ============ CHECKLIST ============ */}
      <Step n={16} title="Checklist Final">
        <div className="space-y-2">
          {[
            "VM Ubuntu LTS criada no Hyper-V com IP estático",
            "vCPU, RAM e disco dentro dos requisitos (mín. 4 vCPU, 8 GB, 80 GB SSD)",
            "Portas 22, 80 e 443 abertas (VM + Windows Server + roteador)",
            "Docker Engine instalado e funcionando na VM",
            "Supabase Self-Hosted rodando (docker compose ps — ~15 containers)",
            "JWT_SECRET, ANON_KEY e SERVICE_ROLE_KEY configurados no .env",
            "SMTP configurado (testar enviando convite de usuário)",
            "Extensões pgcrypto, uuid-ossp, pg_cron e pg_net habilitadas",
            "Schema criado (db/migrations aplicadas OU dump do Cloud importado com session_replication_role)",
            "Tabelas assinadas em tempo real adicionadas ao publication supabase_realtime",
            "Usuários migrados ou super_admin inicial criado — login testado",
            "Edge Functions no volume (invite-user, list-users, manage-user, despesas-scheduler) e container reiniciado",
            "cron.schedule do despesas-scheduler ativo — cron.job_run_details mostra status 200",
            "Frontend buildado com VITE_SUPABASE_URL correto",
            "Nginx com rotas /rest/, /auth/, /realtime/v1/, /storage/, /functions/v1/",
            "HTTPS configurado (se acesso externo) com Let's Encrypt",
            "DNS A record apontando para o IP público do servidor",
            "Backup diário (public + auth + storage/) automatizado via cron e testado",
            "Cópia externa dos backups configurada (NAS/SMB/rsync)",
            "Renovação automática do certificado SSL agendada",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Step>

      <Card className="mt-4 mb-8 border-destructive/30 bg-destructive/5">
        <CardContent className="py-4 text-sm">
          <p className="font-semibold text-destructive mb-2">⚠️ Troubleshooting Comum</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li><strong>Login não funciona após migração:</strong> as <em>senhas</em> continuam válidas (hash bcrypt independe do JWT_SECRET); só as <em>sessões</em> caem — o usuário refaz login uma vez. Se ninguém consegue entrar, confira se <code>auth.users</code> e <code>auth.identities</code> foram importados.</li>
            <li><strong>E-mail de convite não chega:</strong> Confira as variáveis SMTP no <code>.env</code> do Supabase. Teste com <code>docker compose logs auth</code> para ver erros de envio.</li>
            <li><strong>Edge Function 404:</strong> confira se a pasta existe em <code>~/supabase/docker/volumes/functions/&lt;nome&gt;/index.ts</code> e se você reiniciou o container <code>functions</code>. A rota no Nginx precisa ser <code>/functions/v1/</code>, não <code>/functions/</code>.</li>
            <li><strong>Edge Function 500:</strong> <code>docker compose logs -f functions</code> e verifique <code>SUPABASE_URL</code>/<code>SUPABASE_SERVICE_ROLE_KEY</code> presentes no container.</li>
            <li><strong>despesas-scheduler não roda:</strong> <code>select * from cron.job_run_details order by start_time desc limit 5;</code> — se estiver vazio, o job não está agendado. Se aparecer com <code>status_code 401</code>, a <code>SERVICE_ROLE_KEY</code> no <code>cron.schedule</code> está errada; recrie o job com <code>select cron.unschedule('despesas-scheduler-diario');</code> e re-agende com a chave correta.</li>
            <li><strong>Realtime silencioso:</strong> a UI não recebe eventos mesmo com o WebSocket conectado. Rode <code>select * from pg_publication_tables where pubname='supabase_realtime';</code> e adicione as tabelas que estão faltando com <code>alter publication supabase_realtime add table public.&lt;tabela&gt;;</code>.</li>
            <li><strong>WebSocket não conecta:</strong> confirme o bloco <code>/realtime/v1/</code> no Nginx com <code>proxy_http_version 1.1</code> + headers <code>Upgrade</code>/<code>Connection</code>.</li>
            <li><strong>"permission denied for table X" no frontend:</strong> falta <code>GRANT</code> após import do dump. Rode o <code>GRANT</code> exato que o HINT do Postgres sugerir (ou re-aplique a migration correspondente do repositório, que já contém os GRANTs).</li>
            <li><strong>CORS errors no frontend:</strong> Confirme que <code>VITE_SUPABASE_URL</code> corresponde exatamente à URL configurada no Nginx e no <code>API_EXTERNAL_URL</code> do Supabase.</li>
            <li><strong>VM não acessível pela rede:</strong> Verifique o Virtual Switch do Hyper-V (deve ser External/Bridge), o IP estático da VM, e as regras de firewall nas três camadas (VM, Windows Server, roteador).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeployGuide;
