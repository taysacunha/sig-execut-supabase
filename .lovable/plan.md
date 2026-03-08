

## Plano: Controle de Acesso por Unidade no Estoque

### Problema

Hoje qualquer usuário com acesso ao módulo de estoque pode solicitar materiais de qualquer unidade. Não existe vínculo entre o usuário (auth) e a(s) unidade(s) que ele pertence. A tabela `ferias_colaboradores` tem `unidade_id` mas **não tem `user_id`** (é cadastro de RH, não de login), então não serve para isso.

### Solução Proposta: Tabela `estoque_usuarios_unidades`

Criar uma tabela simples que vincula usuários às unidades do estoque:

```text
estoque_usuarios_unidades
├── id (uuid, PK)
├── user_id (uuid, NOT NULL) → auth.users
├── unidade_id (uuid, NOT NULL) → ferias_unidades
├── created_at (timestamp)
└── UNIQUE(user_id, unidade_id)
```

**Por que uma tabela nova?**
- Separação clara: o vínculo de estoque não interfere em férias/escalas
- Um usuário pode pertencer a múltiplas unidades (ex: gestor de Bessa e Tambaú)
- Gestores (`estoque_gestores`) já têm vínculo com unidade — podemos reaproveitar automaticamente

**Regra de acesso:**
- Se o usuário tem registro(s) em `estoque_usuarios_unidades` → só vê/solicita das unidades vinculadas
- Gestores (`estoque_gestores`) automaticamente têm acesso às unidades que gerenciam (sem precisar duplicar cadastro)
- Admins/super_admins → acesso a todas as unidades (sem necessidade de vínculo)

### Impacto no Sistema

#### 1. Nova tabela + RLS
- Criar `estoque_usuarios_unidades` com políticas RLS
- Admins podem gerenciar, usuários podem ver seus próprios vínculos

#### 2. Página de Gestão (`EstoqueGestores.tsx`)
- Adicionar uma nova aba ou seção "Usuários por Unidade" onde admins vinculam usuários às unidades
- Reaproveitar o padrão existente (select de usuário + select de unidade)

#### 3. Solicitações (`EstoqueSolicitacoes.tsx`)
- Ao criar solicitação: filtrar o select de unidades mostrando apenas as unidades do usuário logado
- Se o usuário tiver apenas 1 unidade → preencher automaticamente

#### 4. Hook `useUsuarioUnidades`
- Novo hook que busca as unidades do usuário logado (da tabela nova + estoque_gestores)
- Retorna lista de `unidade_id` permitidos
- Admins retornam todas

#### 5. Saldos e outras páginas
- Filtrar visualização de saldos pelas unidades do usuário (opcional, pode ser implementado depois)

### Arquivos a Criar/Alterar

| Arquivo | Alteração |
|---------|-----------|
| **Migração SQL** | Criar tabela `estoque_usuarios_unidades` + RLS |
| `src/hooks/useUsuarioUnidades.ts` | **Novo** — hook que retorna unidades permitidas do usuário |
| `EstoqueSolicitacoes.tsx` | Filtrar select de unidades pelas unidades do usuário |
| `EstoqueGestores.tsx` | Adicionar seção para vincular usuários a unidades |

### Fluxo

```text
Admin cadastra: Usuário X → Unidade Bessa
                Usuário X → Unidade Tambaú (se necessário)

Usuário X abre "Nova Solicitação":
  → Select de unidade mostra apenas: Bessa, Tambaú
  → Não vê outras unidades

Gestor Y (gestora do Bessa via estoque_gestores):
  → Automaticamente tem acesso ao Bessa sem cadastro extra
```

