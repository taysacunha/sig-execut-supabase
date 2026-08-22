# Separar grava status sem baixar saldo/movimentação — corrigir e liberar entrega

## O que já está confirmado

- Você já executou a migration `20260822120000_estoque_saldos_edit_access.sql`. Se ela rodou certo, as políticas de `estoque_saldos` e `estoque_movimentacoes` já permitem qualquer usuário com `can_edit_system(auth.uid(), 'estoque')`.
- Mesmo assim, **todas** as solicitações com status `separada` têm `movs = 0` — incluindo as criadas hoje por você (Rejane) e por outros usuários. A baixa de saldo e a movimentação não estão sendo gravadas, apesar do toast dizer sucesso.
- O erro de entrega (“Esta solicitação não possui movimentação…”) é apenas a **consequência**; a causa é a separação que não grava nada.

## Hipótese provável

Em `separarMutation` (`src/pages/estoque/EstoqueSolicitacoes.tsx`) as chamadas de `update`/`delete` em `estoque_saldos`, de `update` em `estoque_solicitacao_itens` e de `insert` em `estoque_movimentacoes` **não verificam o objeto `error` de retorno**. O Supabase não lança exceção quando uma operação é recusada por RLS, por trigger ou por qualquer outro motivo — ele devolve `{ error }`. Como o código ignora, o fluxo continua e o status final é atualizado para `separada`, dando a falsa impressão de sucesso.

Outra possibilidade: a migration anterior (`20260815120000`) ainda está em alguma forma conflitante, ou a policy ainda não entrou em vigor devido a caching. Precisamos confirmar as políticas atuais antes de tratar.

## Passo 1 — Confirmar as políticas atuais no banco

Rodar no SQL Editor:

```sql
select tablename, policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('estoque_saldos','estoque_movimentacoes')
order by tablename, cmd;
```

- Se as políticas ativas ainda forem `Admin/Super can ...` ou `Gestao estoque can ...` que exijam admin/supervisor, rode a migration `20260822120000_estoque_saldos_edit_access.sql` **novamente** (ela usa `DROP POLICY IF EXISTS` + `CREATE`, então pode ser re-executada sem problema).
- Se as políticas já forem `Users with edit access can ...`, a causa é o erro silencioso no frontend e vamos para o Passo 2.

## Passo 2 — Impedir que a separação falhe em silêncio

Em `separarMutation` (`src/pages/estoque/EstoqueSolicitacoes.tsx`), verificar o `error` de **todas** as operações de escrita e abortar imediatamente se houver erro:

- `update`/`delete` em `estoque_saldos` (baixa de saldo);
- `update` em `estoque_solicitacao_itens` (salvar quantidade/local);
- `insert` em `estoque_movimentacoes` (registrar saída);
- `update` do status em `estoque_solicitacoes` (já verifica, mas manter por segurança).

Se alguma falhar, lançar exceção com `error.message` **antes** de atualizar o status. Assim o pedido **não** fica como `separada` se a baixa não foi gravada.

Aplicar a mesma checagem nas outras mutations que escrevem no banco (aprovar, entregar, confirmar recebimento) — mesmo que elas já estejam relativamente seguras, o padrão deve ser verificar sempre.

## Passo 3 — Liberar a entrega para pedidos já separados

Mesmo que tenham sido separados de forma inconsistente, se o status já está `separada`, a ação **Entregar** deve ser permitida. Trocar a trava de `entregarMutation`:

```text
bloquear entrega = sol.status !== "separada"
```

Isso desbloqueia os 8 pedidos atuais e evita que a mensagem confusa apareça quando a separação já aconteceu (ou pareceu acontecer).

## Passo 4 — Ajustar mensagem no diálogo de detalhes

No bloco de movimentações da visualização, quando o pedido estiver `separada` mas sem movimentação vinculada, exibir:

> "Nenhuma movimentação registrada para esta solicitação. A separação foi marcada, mas a baixa no saldo não consta."

Isso evita que o usuário entenda como "pedido ainda não separado".

## Passo 5 — Regularizar saldo dos pedidos inconsistentes (decisão do usuário)

Após os Passos 1–3, os 8 pedidos listados podem ser entregues, mas o saldo físico pode estar divergente. Para corrigir, precisamos ver o que realmente saiu do estoque. Opções:

a) Ajustar manualmente pela tela de **Saldos** (Ajuste), baixando as quantidades que já foram separadas/entregues.
b) Rodar um script de regularização que insira as movimentações de saída em lote para esses pedidos, usando os dados de `estoque_solicitacao_itens` (quantidade_atendida, local_armazenamento_id).

Sugiro primeiro descobrir o erro real no Passo 2 (a mensagem que vai aparecer ao tentar separar um novo pedido depois do Passo 1). A partir daí, decido se precisamos do script de regularização.

## Detalhes técnicos

- Nenhuma nova migration de banco, a menos que o Passo 1 revele que a policy antiga ainda está vigente.
- Alterações no frontend: `src/pages/estoque/EstoqueSolicitacoes.tsx`.
- Sem alteração de RLS se a migration já estiver ativa.
