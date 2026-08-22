# Separação não está gravando movimentação — corrigir causa e liberar entrega

## O que o SQL mostrou

**Todas** as solicitações com status `separada` têm `movs = 0` — inclusive as de hoje (22/08, 11:10, 11:34 e 13:06). Ou seja, não é só um resíduo de pedidos antigos: a ação **Separar** está marcando o pedido como separado **sem gravar a movimentação**, e provavelmente sem baixar o saldo.

Causa no código (`src/pages/estoque/EstoqueSolicitacoes.tsx`, `separarMutation`): as escritas de saldo (`update`/`delete` em `estoque_saldos`), a atualização do item e o `insert` em `estoque_movimentacoes` são chamados **sem verificar o erro de retorno**. Só o `update` final do status tem checagem. Se o banco recusa as escritas por RLS, o Supabase não lança exceção — ele devolve `{ error }`, que está sendo ignorado. Resultado: o pedido vira "separada", nada é gravado, e o toast diz "baixa de saldo registrada".

Isso combina com a restrição de RLS ainda em vigor (`20260815120000`), que limita gravação em `estoque_saldos` e `estoque_movimentacoes` a admin/super_admin/supervisor — a Rejane (perfil apoio) é recusada silenciosamente. O SQL de correção já está escrito em `db/migrations/20260822120000_estoque_saldos_edit_access.sql`, mas ainda não foi executado no banco.

## Passo 1 — Aplicar a migration de permissão

Rodar `db/migrations/20260822120000_estoque_saldos_edit_access.sql` no SQL Editor. Ela recria as políticas de `INSERT`/`UPDATE`/`DELETE` de `estoque_saldos` e `estoque_movimentacoes` com o critério `can_edit_system(auth.uid(), 'estoque')` — cobrindo Rejane, Ruan (supervisor) e admins, e mantendo bloqueado quem só visualiza.

Confirmação depois de rodar:

```sql
select tablename, policyname, cmd
from pg_policies
where tablename in ('estoque_saldos','estoque_movimentacoes')
order by tablename, cmd;
```

## Passo 2 — Nunca mais falhar em silêncio na separação

Em `separarMutation`, checar o `error` de **todas** as escritas (leitura de saldo, update/delete de saldo, update do item, insert da movimentação) e interromper com mensagem clara ("Sem permissão para movimentar estoque" ou o erro do banco). Assim, se algo for recusado, o status **não** muda para `separada` e o usuário vê o motivo em vez de um falso sucesso.

Aplicar a mesma checagem nas escritas sem verificação das outras ações do fluxo (aprovar, entregar, confirmar recebimento).

## Passo 3 — Destravar a entrega dos pedidos já marcados como separados

Trocar o critério da trava em `entregarMutation`:

```text
bloquear entrega  =  status da solicitação NÃO é "separada"
```

Pedidos em `pendente`/`aprovada` continuam bloqueados com a orientação de usar **Separar**. Pedidos já em `separada` passam a poder ser entregues — inclusive os 8 da lista, cuja separação não gravou movimentação.

No diálogo de detalhes, quando o pedido estiver `separada` sem movimentação vinculada, exibir aviso neutro (separação sem movimentação registrada) em vez do texto atual que afirma que o pedido não foi separado.

## Passo 4 — Decidir o que fazer com o saldo desses 8 pedidos

Como a baixa provavelmente não ocorreu, o saldo em tela está maior que o físico. Após o Passo 1, a conferência é:

```sql
select s.id, s.solicitante_nome, s.created_at, m.nome as material,
       i.quantidade_atendida, i.local_armazenamento_id
from estoque_solicitacoes s
join estoque_solicitacao_itens i on i.solicitacao_id = s.id
join estoque_materiais m on m.id = i.material_id
where s.status in ('separada','entregue')
  and not exists (select 1 from estoque_movimentacoes mv where mv.solicitacao_id = s.id)
order by s.created_at desc;
```

Com a lista em mãos, o ajuste dos saldos pode ser feito pela própria tela de **Saldos** (ação Ajuste) ou por um script de regularização — trato isso num passo à parte, depois que você confirmar as quantidades.

## Detalhes técnicos

- Banco: executar a migration já existente `db/migrations/20260822120000_estoque_saldos_edit_access.sql` (nenhuma nova migration necessária).
- Frontend: `src/pages/estoque/EstoqueSolicitacoes.tsx` — verificação de erro em todas as escritas de `separarMutation` e demais mutations; trava de entrega baseada em `sol.status === "separada"`; texto condicional no bloco de movimentações do diálogo.
