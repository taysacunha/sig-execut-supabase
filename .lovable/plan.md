

## Plano: Página de Desenvolvimento Protegida por Código + Guia de Deploy

### Parte 1: Página de Registro de Desenvolvimento

**Proteção**: Ao acessar `/dev`, aparece um campo de senha. Somente com o código correto (hardcoded no frontend, ex: `EXECUT2026`) o conteudo é exibido. Sem envolvimento de banco para a autenticação da página.

**Dados no Supabase**: Criar tabela `dev_tracker` para armazenar funcionalidades, horas e valores, editáveis pela interface.

**Estrutura da tabela `dev_tracker`**:
- `id` (uuid, PK)
- `system_name` (text) - ex: "escalas", "vendas", "ferias", "estoque", "infraestrutura"
- `feature_name` (text) - nome da funcionalidade
- `description` (text) - descrição
- `hours` (numeric) - horas gastas
- `cost` (numeric) - valor em R$
- `created_at`, `updated_at` (timestamps)
- Sem RLS (página protegida por código, não por auth)

**Interface**:
- Tabela agrupada por sistema com subtotais de horas e valores
- Total geral no final
- Botões para adicionar, editar e remover funcionalidades inline
- Export PDF
- Estes dois itens (tracker + deploy guide) NÃO entram nos registros

### Parte 2: Guia de Deploy Self-Hosted

Página `/dev/deploy-guide` (mesma proteção por código) com instruções para:
1. Pré-requisitos no Windows Server 2022 (Docker, WSL2, Git)
2. Supabase Self-Hosted via Docker Compose
3. Build do frontend e servir com Nginx
4. Configuração de domínio + HTTPS com Let's Encrypt
5. Migração do banco de dados

### Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/DevTracker.tsx` | Página com tabela editável + proteção por código |
| `src/pages/DeployGuide.tsx` | Guia de deploy self-hosted |
| `src/App.tsx` | Rotas `/dev` e `/dev/deploy-guide` (sem ProtectedRoute, sem menu) |
| Migration SQL | Tabela `dev_tracker` no Supabase |

