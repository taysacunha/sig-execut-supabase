# Revisão do Módulo de Estoque — Status e Plano de Conclusão

Fiz uma varredura página a página. Abaixo está o que está pronto, o que falta, e um plano objetivo para fechar os fluxos mais críticos (solicitação → separação → entrega → recebimento) que hoje estão incompletos.

---

## 1. Status atual de cada página

### ✅ Materiais (`EstoqueMateriais.tsx`)
- Cadastro, edição, ativar/desativar, exclusão (com checagem de saldo) → **OK**.
- Faltando: cadastro estruturado de **categorias** (hoje é texto livre, gera duplicidades).

### ✅ Locais de Armazenamento (`EstoqueLocais.tsx`)
- Cadastro por unidade, soft-delete, exclusão → **OK**.
- Faltando: suporte a **hierarquia** (campo `parent_id` existe na tabela mas a UI não usa — depósito → armário → prateleira).

### ⚠️ Saldos (`EstoqueSaldos.tsx`)
- Entrada, ajuste, transferência, exclusão com justificativa → **OK**.
- Tabs por unidade → **OK**.
- Faltando: nada bloqueante. Pequeno: visão consolidada por material somando todos os locais.

### 🔴 Solicitações (`EstoqueSolicitacoes.tsx`) — **principal lacuna**
- Criar solicitação (com unidade/setor auto-preenchidos do vínculo do usuário) → **OK**.
- Mudança de status `pendente → aprovada → separada → entregue` → **só altera o campo `status`**.
- **NÃO faz baixa de saldo**, **NÃO cria movimentação de saída**, **NÃO permite definir local de origem por item**, **NÃO permite informar `quantidade_atendida`** (fica sempre 0).
- **NÃO existe confirmação de recebimento** pelo solicitante (campos `recebido_por_user_id` / `recebido_em` em `estoque_movimentacoes` nunca são preenchidos).
- Cancelar não tem AlertDialog de confirmação.
- Não dá para editar itens depois de criada.

### ⚠️ Movimentações (`EstoqueMovimentacoes.tsx`)
- Listagem com filtros e busca → **OK**.
- Faltando: exibir nome do **responsável** e do **recebedor** (hoje mostra só IDs internamente, nem isso). Botão de exportar.

### ⚠️ Notificações (`EstoqueNotificacoes.tsx`)
- Listagem, marcar como lida, marcar todas → **OK**.
- Faltando: clicar na notificação **navegar** para a solicitação referenciada; gerar notificação automática de **estoque baixo** (não existe hoje).

### ✅ Dashboard, Auditoria, Gestores/Usuários
- Funcionais. Sem ajustes urgentes.

---

## 2. Plano de implementação (prioridade alta → baixa)

### 🔴 Etapa 1 — Fechar o fluxo de Solicitação/Separação/Entrega/Recebimento
Fluxo proposto (estados existentes na tabela, sem migração de schema):

```text
pendente  → (gestor APROVA)        → aprovada
aprovada  → (gestor SEPARA itens)  → separada   [baixa saldo + movimentação de saída]
separada  → (gestor MARCA ENTREGUE)→ entregue
entregue  → (solicitante CONFIRMA RECEBIMENTO) → preenche recebido_por/recebido_em
```

Mudanças em `EstoqueSolicitacoes.tsx`:
1. Novo **Dialog "Separar"** acionado quando o gestor avança de `aprovada → separada`:
   - Lista cada item da solicitação com: quantidade solicitada, **Select de local de origem** (filtrado pelos locais da unidade da solicitação que tenham saldo > 0 do material) e campo **quantidade atendida** (default = solicitada, máx = saldo disponível).
   - Ao confirmar:
     - Atualiza `estoque_solicitacao_itens.quantidade_atendida` e `local_armazenamento_id`.
     - Para cada item: faz **UPDATE** no `estoque_saldos` correspondente (subtrai) e **INSERT** em `estoque_movimentacoes` com `tipo='saida'`, `local_origem_id`, `solicitacao_id`, `responsavel_user_id = auth.uid()`.
     - Muda status para `separada`.
2. Botão **"Marcar como Entregue"** (gestor) → apenas muda status para `entregue` e notifica solicitante.
3. Novo botão **"Confirmar Recebimento"** visível **apenas para o solicitante** quando status = `entregue`:
   - Ao clicar: faz UPDATE em todas as `estoque_movimentacoes` da solicitação preenchendo `recebido_por_user_id` e `recebido_em`.
   - Notifica os gestores da unidade que o material foi recebido.
4. **AlertDialog de confirmação** ao cancelar solicitação.
5. Permitir **editar itens** enquanto status = `pendente` (acréscimo, remoção, troca de quantidade).

### 🟠 Etapa 2 — Notificações inteligentes
1. Notificação clicável: ao clicar em uma notificação com `referencia_tipo = 'solicitacao'`, navegar para `/estoque/solicitacoes` e abrir o dialog de detalhes daquela solicitação.
2. Disparar notificação **"estoque_baixo"** automaticamente nas mutations de saldo (entrada/saída/ajuste/transferência) sempre que o saldo resultante de um material em um local cair ≤ `estoque_minimo`. Notificar gestores da unidade do local.

### 🟡 Etapa 3 — Movimentações com nomes
1. Buscar nomes de usuários (responsável e recebedor) e exibi-los em colunas extras.
2. Botão **Exportar CSV** das movimentações filtradas (usando `exportUtils` já existente no projeto).

### 🟢 Etapa 4 — Polimentos de cadastro
1. **Categorias de materiais**: criar tabela leve `estoque_categorias` (id, nome, is_active) + telinha simples no menu admin; trocar input de categoria do material por Select.
2. **Hierarquia de locais**: no dialog de Local, permitir selecionar `parent_id` (mesmo unidade) e exibir os locais em formato de árvore na lista.
3. **Visão consolidada por material** em Saldos: nova aba "Por material" somando saldo total entre locais.

---

## 3. Detalhes técnicos

- **Schema**: nada novo é estritamente necessário para a Etapa 1. As colunas `quantidade_atendida`, `local_armazenamento_id`, `recebido_por_user_id`, `recebido_em` já existem mas estão sem uso.
- **RLS**: as policies de `estoque_solicitacoes`, `estoque_solicitacao_itens`, `estoque_saldos` e `estoque_movimentacoes` já permitem `INSERT/UPDATE` para usuários com `can_edit_system('estoque')`. Para a confirmação de recebimento (que precisa ser feita pelo próprio solicitante mesmo sem `view_edit`), adicionar uma policy específica em `estoque_movimentacoes` permitindo `UPDATE` apenas dos campos `recebido_por_user_id` e `recebido_em` quando `auth.uid()` for o `solicitante_user_id` da solicitação vinculada — isso exigirá uma function `is_solicitante(_solicitacao_id uuid)`.
- **Concorrência de saldos**: na separação, ler o saldo dentro da própria mutation e abortar com toast se ficar negativo (sem locking server-side por enquanto; aceitável pelo volume).
- **Memória do projeto**: AlertDialog para ações destrutivas (cancelar solicitação) está alinhado com a regra de Core memory.

---

## 4. Sugestão de execução

Posso entregar em 2 PRs/iterações:
- **Iteração A** (crítica): Etapa 1 completa + AlertDialog de cancelamento + policy/function de recebimento.
- **Iteração B** (qualidade): Etapas 2, 3 e 4.

Confirma se quer que eu siga por essa ordem, ou prefere priorizar algo diferente (por exemplo, notificação de estoque baixo antes de tudo)?
