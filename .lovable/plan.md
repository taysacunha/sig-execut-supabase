

## Plano: Atualizar guia de deploy + análise de alertas de segurança

### 1. Atualizar Step 1.2 — Docker Desktop como opção principal

No Step 1 (linhas 73-98), substituir o conteúdo para:
- Recomendar **Docker Desktop** como opção principal para pequenas empresas (gratuito para menos de 250 funcionários / US$10M receita)
- Explicar a diferença: Docker Desktop = GUI + Docker Engine embutido; Docker Engine = CLI puro, sem licença
- Manter instruções de ambas as opções (Desktop e Engine) para o usuário escolher
- Atualizar a stack description (linha 59) para mencionar "Docker Desktop ou Docker Engine"
- Atualizar checklist (linha 548) para refletir ambas as opções

### 2. Adicionar Edge Function `log-dev-work` no Step 5

Adicionar `log-dev-work` na lista de Edge Functions (linha 229-234), já que foi criada recentemente.

### 3. Análise dos alertas de segurança

| Alerta | Nível | Veredicto |
|--------|-------|-----------|
| **Security Definer View** | error | Investigar — pode ser a view `has_role` ou similar. Precisa verificar qual view é. |
| **RLS Disabled in Public** | error | Confirma: `dev_tracker` sem RLS. Corrigir habilitando RLS + policy para admin only. |
| **RLS Policy Always True** | warn | `ferias_folgas_creditos` com policy `true` para todos os comandos. Corrigir restringindo acesso. |
| **Leaked Password Protection** | warn | Config do Supabase Auth — habilitar nas settings do projeto. Não requer código. |
| **ferias_folgas_creditos unrestricted** | error | Mesmo que o "always true" acima. Precisa de policies restritivas. |
| **dev_tracker no RLS** | warn | Já identificado acima. |

**Ações no código (DeployGuide.tsx):**
- Atualizar Docker section
- Adicionar log-dev-work nas Edge Functions

**Ações no banco (migrations):**
- Habilitar RLS no `dev_tracker` + policy admin-only
- Substituir policy permissiva no `ferias_folgas_creditos` por policies restritivas por operação

### Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/DeployGuide.tsx` | Atualizar Step 1.2 (Docker Desktop vs Engine), Step 5 (adicionar log-dev-work), checklist |
| Migration SQL (via Supabase) | RLS no `dev_tracker`, policies restritivas no `ferias_folgas_creditos` |

### Sobre os alertas que NÃO requerem ação no código
- **Leaked Password Protection**: habilitar via dashboard Supabase (Settings > Auth > Password Protection)
- **Security Definer View**: precisa identificar qual view é afetada para avaliar se é falso positivo

