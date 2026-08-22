# Entregar bloqueado: liberar por status e acabar com a falha silenciosa na separação

## O que já está confirmado

- **As políticas do banco estão corretas.** O `pg_policies` mostra `estoque_saldos` e `estoque_movimentacoes` com insert/update/delete liberados por `can_edit_system(auth.uid(), 'estoque')`. Nada a rodar de novo no SQL Editor — a migration `20260822120000` já está aplicada.
- **Mesmo assim, todas as solicitações com status `separada` têm 0 movimentações**, inclusive as de hoje (11:10, 11:34, 13:06). Elas foram separadas **antes** de você aplicar a migration, quando a regra antiga (`20260815120000`, só admin/supervisor) ainda recusava a gravação para a Rejane.
- A recusa não apareceu na tela porque o código de separação **não checa o erro** de cada gravação. O Supabase não lança exceção quando o banco recusa por RLS — devolve `{ error }`, que está sendo ignorado em `separarMutation`. Por isso o status virou `separada`, o toast disse "baixa de saldo registrada", e nada foi gravado.
- A mensagem ao clicar em **Entregar** é só a consequência: a trava exige movimentação vinculada, e esses pedidos não têm.

Você mencionou que "os novos pedidos estão dando certo" — coerente: depois da migration, a gravação passou a ser aceita.

## Passo 1 — Liberar a entrega pelo status

Trocar o critério da trava em `entregarMutation` (`src/pages/estoque/EstoqueSolicitacoes.tsx`):

```text
bloquear entrega  =  status da solicitação NÃO é "separada"
```

Pedidos em `pendente`/`aprovada` continuam bloqueados com a orientação de usar **Separar** primeiro. Os já marcados como `separada` — os 8 da lista — passam a poder ser entregues normalmente, que é o comportamento que você espera.

## Passo 2 — Nunca mais falhar em silêncio

Em `separarMutation`, verificar o `error` de **todas** as gravações e abortar antes de mudar o status:

- `update`/`delete` em `estoque_saldos` (baixa de saldo)
- `update` em `estoque_solicitacao_itens` (quantidade atendida e local)
- `insert` em `estoque_movimentacoes` (saída)

Se qualquer uma falhar, o fluxo para com a mensagem real do banco e o pedido **não** fica como "Separada". Mesma checagem nas demais ações que gravam (aprovar, entregar, confirmar recebimento).

## Passo 3 — Ajustar o aviso no diálogo de detalhes

Quando o pedido estiver `separada` sem movimentação vinculada, trocar o texto atual (que afirma que o pedido "ainda não foi separado") por um aviso neutro: separação registrada sem movimentação vinculada — a baixa de saldo não consta para este pedido.

## Passo 4 — Regularizar o saldo dos 8 pedidos

Como a baixa não foi gravada, o saldo em tela está maior que o físico desses itens. Levantamento:

```sql
select s.id, s.solicitante_nome, s.created_at, m.nome as material,
       i.quantidade_atendida, l.nome as local
from estoque_solicitacoes s
join estoque_solicitacao_itens i on i.solicitacao_id = s.id
join estoque_materiais m on m.id = i.material_id
left join estoque_locais_armazenamento l on l.id = i.local_armazenamento_id
where s.status in ('separada','entregue')
  and not exists (select 1 from estoque_movimentacoes mv where mv.solicitacao_id = s.id)
order by s.created_at desc;
```

Com esse retorno, dá para regularizar de duas formas — me diga qual prefere depois de ver a lista:

a) **Manual**: ajustar cada material pela tela de **Saldos** (ação Ajuste), o que já deixa a movimentação registrada com histórico.
b) **Em lote**: script que insere as movimentações de saída faltantes e desconta os saldos correspondentes, usando `quantidade_atendida` e `local_armazenamento_id` de cada item.

## Passo 5 — Validar

- Rejane abre um pedido antigo com status **Separada** → **Entregar** funciona.
- Novo pedido: Aprovar → Separar → confere que a movimentação aparece em Movimentações e o saldo baixa → Entregar.
- Um pedido em **Aprovada** continua sem permitir entrega direta.

## Detalhes técnicos

- Só frontend: `src/pages/estoque/EstoqueSolicitacoes.tsx` — trava de entrega por `sol.status`, checagem de `error` em todas as escritas das mutations, texto condicional no bloco de movimentações do diálogo.
- Sem alterações de banco nem de RLS (as políticas já estão como deveriam).
