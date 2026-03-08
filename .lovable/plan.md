

## Plano: Ciclo de Vida Completo para Materiais, Locais e Unidades no Estoque

### Problema

Atualmente, itens ativos e inativos aparecem misturados na mesma tabela. Não existe opção de exclusão definitiva. Não há validação de dependências antes de desativar/excluir (ex: desativar um local que tem saldo, ou um material com estoque). Unidades não têm controle nenhum nesse sentido.

### Solução Proposta

#### 1. Materiais (`EstoqueMateriais.tsx`)

**Abas Ativos / Inativos:**
- Tabs separando materiais ativos e inativos
- Por padrão, mostra só ativos
- Aba "Inativos" mostra materiais desativados com opções de reativar ou excluir

**Desativação com validação:**
- Ao desativar: verificar se existem saldos > 0 em qualquer local
- Se houver saldo: bloquear e informar "Zere o saldo deste material em todos os locais antes de desativar"
- Se não houver: desativa normalmente (saldos zerados são removidos automaticamente)

**Exclusão definitiva:**
- Botão de excluir visível APENAS na aba de inativos
- AlertDialog de confirmação com texto forte ("Esta ação é irreversível")
- DELETE real no banco (a auditoria já captura via trigger)
- Antes de excluir: remover saldos zerados vinculados ao material

#### 2. Locais de Armazenamento (`EstoqueLocais.tsx`)

**Mesma estrutura de abas Ativos / Inativos**

**Desativação com validação:**
- Verificar se existem saldos > 0 neste local
- Se houver: bloquear e informar "Transfira ou zere o estoque deste local antes de desativar"

**Exclusão definitiva:**
- Apenas na aba de inativos
- Remover saldos zerados vinculados antes de excluir

#### 3. Unidades (contexto)

As unidades vêm da tabela `ferias_unidades` e são compartilhadas com outros módulos. Não vamos adicionar exclusão/desativação de unidades diretamente na página de estoque, pois isso impactaria férias e outros módulos. Porém:

- Ao desativar um local, os selects de unidade já filtram por `is_active = true` das unidades
- Se uma unidade for desativada no módulo de férias/estrutura, os locais dessa unidade continuam existindo mas a unidade não aparece mais para novos cadastros
- Na página de Locais, exibir um alerta visual se um local pertence a uma unidade inativa

#### 4. Efeitos cascata automáticos

Ao desativar um material:
- Saldos zerados desse material são removidos
- Material some dos selects de Entrada/Ajuste/Transferência (já filtra `is_active = true`)

Ao desativar um local:
- Saldos zerados desse local são removidos
- Local some dos selects de Entrada/Ajuste/Transferência (já filtra `is_active = true`)

### Detalhes Técnicos

**Arquivos a alterar:**

| Arquivo | Alteração |
|---------|-----------|
| `EstoqueMateriais.tsx` | Adicionar Tabs ativo/inativo, validação de saldo antes de desativar, botão excluir na aba inativos, deleteMutation com limpeza de saldos |
| `EstoqueLocais.tsx` | Mesma estrutura: Tabs, validação de saldo, exclusão na aba inativos |

**Nenhuma migração de banco necessária** - as tabelas já suportam `is_active` e DELETE. Os triggers de auditoria já capturam exclusões.

**Fluxo de desativação (material ou local):**

```text
Clique "Desativar" → Verificar saldos > 0?
  ├─ SIM → Toast erro: "Transfira/zere o estoque antes"
  └─ NÃO → AlertDialog confirmação → Desativa + limpa saldos zerados
```

**Fluxo de exclusão:**

```text
(Só visível na aba Inativos)
Clique "Excluir" → AlertDialog "Ação irreversível"
  → DELETE saldos zerados vinculados
  → DELETE do registro
  → Auditoria registra automaticamente
```

