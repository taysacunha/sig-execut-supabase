import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

const DEV_CODE = "EXECUT2026";

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="bg-muted/70 border rounded-md p-4 text-sm overflow-x-auto my-3 font-mono whitespace-pre-wrap">
    {children}
  </pre>
);

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">{n}</span>
      {title}
    </h3>
    <div className="pl-9 space-y-2 text-sm text-foreground/90 leading-relaxed">{children}</div>
  </div>
);

const DeployGuide = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === DEV_CODE) {
      setAuthenticated(true);
    } else {
      toast({ title: "Código incorreto", variant: "destructive" });
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle>Área Restrita</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Input type={showCode ? "text" : "password"} placeholder="Digite o código de acesso" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCode(!showCode)}>
                  {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" className="w-full">Acessar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dev">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Guia de Deploy Self-Hosted</h1>
          <p className="text-muted-foreground text-sm">Windows Server 2022 + Supabase + Docker + Nginx</p>
        </div>
      </div>

      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-start gap-3">
          <Terminal className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Stack utilizada (100% gratuita):</p>
            <p className="text-muted-foreground">Docker Desktop (WSL2) · Supabase Self-Hosted · Nginx · Let's Encrypt (Certbot)</p>
          </div>
        </CardContent>
      </Card>

      <Step n={1} title="Pré-requisitos no Windows Server 2022">
        <p><strong>1.1 — Habilitar WSL2:</strong></p>
        <p>Abra o PowerShell como Administrador:</p>
        <CodeBlock>{`wsl --install
# Reinicie o servidor após a instalação
# Depois, defina o WSL2 como padrão:
wsl --set-default-version 2`}</CodeBlock>

        <p><strong>1.2 — Instalar Docker Desktop:</strong></p>
        <p>Baixe em <code>https://docs.docker.com/desktop/install/windows-install/</code></p>
        <p>Durante a instalação, marque "Use WSL 2 instead of Hyper-V".</p>
        <CodeBlock>{`# Verifique a instalação:
docker --version
docker compose version`}</CodeBlock>

        <p><strong>1.3 — Instalar Git:</strong></p>
        <CodeBlock>{`winget install Git.Git
# Ou baixe em https://git-scm.com/download/win`}</CodeBlock>

        <p><strong>1.4 — Instalar Node.js (para build do frontend):</strong></p>
        <CodeBlock>{`winget install OpenJS.NodeJS.LTS
# Verifique: node --version && npm --version`}</CodeBlock>
      </Step>

      <Step n={2} title="Supabase Self-Hosted via Docker Compose">
        <p><strong>2.1 — Clonar o repositório oficial:</strong></p>
        <CodeBlock>{`git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker`}</CodeBlock>

        <p><strong>2.2 — Configurar variáveis de ambiente:</strong></p>
        <CodeBlock>{`# Copie o .env de exemplo
cp .env.example .env

# Edite o .env com suas configurações:
# IMPORTANTE: altere estas variáveis:
#
# POSTGRES_PASSWORD=SuaSenhaForteAqui123!
# JWT_SECRET=SuaChaveJWTSuperSecreta (mínimo 32 caracteres)
# ANON_KEY=gere em https://supabase.com/docs/guides/self-hosting#api-keys
# SERVICE_ROLE_KEY=gere no mesmo link acima
# DASHBOARD_USERNAME=admin
# DASHBOARD_PASSWORD=SuaSenhaDoDashboard
# SITE_URL=https://seudominio.com.br
# API_EXTERNAL_URL=https://api.seudominio.com.br`}</CodeBlock>

        <p><strong>2.3 — Gerar JWT Keys:</strong></p>
        <p>Use o gerador oficial: <code>https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys</code></p>
        <p>Ou via Node.js:</p>
        <CodeBlock>{`node -e "
const crypto = require('crypto');
const jwt_secret = crypto.randomBytes(32).toString('hex');
console.log('JWT_SECRET=' + jwt_secret);

// Para gerar ANON_KEY e SERVICE_ROLE_KEY, use:
// https://jwt.io com o payload correto e o jwt_secret acima
"`}</CodeBlock>

        <p><strong>2.4 — Subir os containers:</strong></p>
        <CodeBlock>{`docker compose up -d

# Verifique se todos estão rodando:
docker compose ps

# Acesse o Studio em: http://localhost:8000`}</CodeBlock>
      </Step>

      <Step n={3} title="Migração do Banco de Dados">
        <p><strong>3.1 — Exportar dados do Supabase Cloud:</strong></p>
        <p>No dashboard do Supabase Cloud, vá em <strong>Settings → Database → Connection String</strong>.</p>
        <CodeBlock>{`# No seu servidor, instale o pg_dump (via PostgreSQL client tools):
# Baixe em https://www.postgresql.org/download/windows/

# Exportar schema + dados:
pg_dump "postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" \\
  --clean --if-exists --no-owner --no-privileges \\
  --schema=public \\
  -f backup_completo.sql`}</CodeBlock>

        <p><strong>3.2 — Importar no Supabase Self-Hosted:</strong></p>
        <CodeBlock>{`# O PostgreSQL do Supabase Self-Hosted roda na porta 5432 por padrão
psql "postgresql://postgres:SuaSenhaForteAqui123!@localhost:5432/postgres" \\
  -f backup_completo.sql`}</CodeBlock>

        <p><strong>3.3 — Verificar a migração:</strong></p>
        <p>Acesse o Supabase Studio local (<code>http://localhost:8000</code>) e confira as tabelas e dados.</p>
      </Step>

      <Step n={4} title="Build do Frontend (SIG Execut)">
        <p><strong>4.1 — Clonar o repositório do projeto:</strong></p>
        <CodeBlock>{`git clone https://github.com/seu-usuario/sig-execut.git
cd sig-execut`}</CodeBlock>

        <p><strong>4.2 — Configurar variáveis de ambiente:</strong></p>
        <CodeBlock>{`# Crie o arquivo .env na raiz do projeto:
VITE_SUPABASE_URL=https://api.seudominio.com.br
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key_gerada`}</CodeBlock>

        <p><strong>4.3 — Build de produção:</strong></p>
        <CodeBlock>{`npm install
npm run build
# A pasta dist/ será gerada com os arquivos estáticos`}</CodeBlock>
      </Step>

      <Step n={5} title="Nginx como Reverse Proxy (via Docker)">
        <p><strong>5.1 — Estrutura de arquivos:</strong></p>
        <CodeBlock>{`C:\\sig-execut\\
├── dist/              ← Build do frontend
├── nginx/
│   └── default.conf   ← Configuração do Nginx
└── docker-compose.yml ← Arquivo unificado`}</CodeBlock>

        <p><strong>5.2 — Configuração do Nginx (<code>nginx/default.conf</code>):</strong></p>
        <CodeBlock>{`server {
    listen 80;
    server_name seudominio.com.br;

    # Frontend (SPA React)
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy para Supabase API
    location /supabase/ {
        proxy_pass http://host.docker.internal:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Se usar HTTPS (recomendado):
# server {
#     listen 443 ssl;
#     server_name seudominio.com.br;
#     ssl_certificate /etc/letsencrypt/live/seudominio.com.br/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/seudominio.com.br/privkey.pem;
#     ... (mesmas locations acima)
# }`}</CodeBlock>

        <p><strong>5.3 — Docker Compose para o Nginx:</strong></p>
        <CodeBlock>{`# docker-compose.yml (na pasta C:\\sig-execut\\)
version: "3.8"
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      # Se usar HTTPS:
      # - ./certbot/conf:/etc/letsencrypt:ro
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: always`}</CodeBlock>

        <CodeBlock>{`docker compose up -d`}</CodeBlock>
      </Step>

      <Step n={6} title="HTTPS com Let's Encrypt (Certbot)">
        <p><strong>6.1 — Pré-requisitos:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Domínio apontando para o IP público do servidor (DNS A record)</li>
          <li>Porta 80 e 443 abertas no firewall do Windows e no roteador</li>
        </ul>

        <p><strong>6.2 — Instalar Certbot via Docker:</strong></p>
        <CodeBlock>{`# Gerar certificado (com Nginx parado na porta 80):
docker run --rm -it \\
  -v C:/sig-execut/certbot/conf:/etc/letsencrypt \\
  -v C:/sig-execut/certbot/www:/var/www/certbot \\
  -p 80:80 \\
  certbot/certbot certonly --standalone \\
  -d seudominio.com.br \\
  --email seu@email.com \\
  --agree-tos --no-eff-email

# Renovação automática (agendar no Task Scheduler do Windows):
# Executar a cada 60 dias:
docker run --rm \\
  -v C:/sig-execut/certbot/conf:/etc/letsencrypt \\
  certbot/certbot renew`}</CodeBlock>

        <p><strong>6.3 — Ativar HTTPS no Nginx:</strong></p>
        <p>Descomente o bloco HTTPS no <code>default.conf</code> e adicione o volume do certbot no <code>docker-compose.yml</code>.</p>
      </Step>

      <Step n={7} title="Acesso Interno (Intranet)">
        <p>Se quiser acessar apenas pela rede interna sem domínio:</p>
        <CodeBlock>{`# No default.conf do Nginx, use:
server_name _;  # Aceita qualquer hostname

# Acesse pelo IP do servidor:
# http://192.168.1.100

# Para resolver por nome internamente, edite o arquivo hosts
# dos computadores que precisam acessar:
# C:\\Windows\\System32\\drivers\\etc\\hosts
# 192.168.1.100  sig-execut.local`}</CodeBlock>
      </Step>

      <Step n={8} title="Checklist Final">
        <div className="space-y-2">
          {[
            "WSL2 e Docker Desktop instalados e funcionando",
            "Supabase Self-Hosted rodando (docker compose ps)",
            "JWT_SECRET, ANON_KEY e SERVICE_ROLE_KEY configurados",
            "Banco de dados migrado e verificado no Studio",
            "Frontend buildado (npm run build) com .env correto",
            "Nginx servindo o frontend e proxy para Supabase",
            "HTTPS configurado (se acesso externo)",
            "Firewall: portas 80 e 443 abertas (se acesso externo)",
            "DNS A record apontando para o IP do servidor",
            "Renovação automática do certificado SSL agendada",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Step>

      <Card className="mt-8 mb-8 border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-4 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠️ Observações Importantes</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Faça backups regulares do banco: <code>pg_dump</code> agendado no Task Scheduler</li>
            <li>Monitore os containers: <code>docker compose logs -f</code></li>
            <li>Para atualizar o Supabase: <code>git pull && docker compose up -d</code></li>
            <li>Para atualizar o frontend: rebuild e copiar <code>dist/</code></li>
            <li>Edge Functions do Supabase Self-Hosted rodam via Deno Deploy local (já incluído no Docker Compose)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeployGuide;
