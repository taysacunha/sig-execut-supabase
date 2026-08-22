# Liberar "Entregar" para solicitações já separadas

## O que está acontecendo

Na ação **Entregar** (`src/pages/estoque/EstoqueSolicitacoes.tsx`, `entregarMutation`), antes de mudar o status o sistema conta as linhas de `estoque_movimentacoes` ligadas à solicitação (`solicitacao_id`). Se a contagem vier zero ou nula, ele bloqueia com a mensagem que a Rejane está vendo.

Essa trava foi criada para impedir entrega **sem** separação (pedido pulando a baixa de saldo). O problema: ela também barra pedidos que **já estão com status `separada`** — casos antigos, separados antes da trava, cuja movimentação não ficou vinculada pelo `solicitacao_id` (ou cuja contagem não retorna para o usuário). O status `separada` já é a prova de que a baixa foi feita; exigir a movimentação além dele é redundante.

Diagnóstico de dados ainda não confirmado (a consulta ao banco está bloqueada por preferência de aprovação) — o passo 1 abaixo confirma quantos pedidos estão nessa situação, mas a correção de tela não depende disso.

## Passo 1 — Confirmar (opcional, SQL Editor)

```sql
select s.id, s.solicitante_nome, s.status, s.created_at,
       (select count(*) from estoque_movimentacoes m where m.solicitacao_id = s.id) as movs
from estoque_solicitacoes s
where s.status = 'separada'
order by s.created_at desc;
```

## Passo 2 — Corrigir a regra da entrega

Trocar o critério da trava:

```text
bloquear entrega  =  status da solicitação NÃO é "separada"
```

- Se o pedido está **separada** → entrega liberada sempre (com ou sem movimentação vinculada). É o caso da Rejane.
- Se o pedido está **pendente** ou **aprovada** → continua bloqueado, com a mensagem orientando a usar **Separar** primeiro. A proteção original (não entregar sem baixa de saldo) permanece intacta, já que a baixa acontece exatamente na transição para `separada`.

Como o botão **Entregar** só aparece quando o status é `separada`, na prática a trava passa a ser apenas uma verificação de segurança contra chamadas fora de ordem.

## Passo 3 — Ajustar o aviso no diálogo de detalhes

No bloco de movimentações do diálogo de visualização, quando a solicitação estiver **separada** mas sem movimentação vinculada, trocar o texto atual ("ainda não foi separada, o saldo não foi baixado") por um aviso neutro: nenhuma movimentação vinculada a este pedido (separação registrada antes do vínculo). Assim ninguém interpreta como erro de saldo.

## Passo 4 — Validar

- Rejane: abrir um pedido antigo com status **Separada** → clicar **Entregar** → deve concluir sem erro.
- Pedido novo: fluxo completo (Aprovar → Separar → Entregar) continua funcionando e baixando saldo.
- Pedido **Aprovada**: não deve permitir entrega direta.

## Detalhes técnicos

- Apenas `src/pages/estoque/EstoqueSolicitacoes.tsx`: a checagem por contagem em `entregarMutation` passa a validar `sol.status === "separada"`; texto condicional no bloco de movimentações do diálogo de visualização.
- Sem alterações de banco de dados nem de RLS.
