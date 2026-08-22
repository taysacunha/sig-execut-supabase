# Liberar "Entregar" para solicitações já separadas e evitar falha silenciosa

## O que já está confirmado

- **As políticas do banco estão corretas.** O `pg_policies` mostra `estoque_saldos` e `estoque_movimentacoes` com insert/update/delete liberados por `can_edit_system(auth.uid(), 'estoque')`. Não é preciso rodar a migration de novo.
- **Os pedidos novos já funcionam**, como você disse. A migration de permissão já está em vigor.
- **Os pedidos antigos ficaram inconsistentes:** foram marcados como `separada` sem ter gravada a movimentação de saída, porque a Rejane foi recusada pela RLS anterior e o código de separação não exibia o erro. Por isso hoje existem 8 pedidos com `status = 'separada'` e `movs = 0`.

## Causa real

A ação **Separar** grava o status, mas não checa o erro das gravações anteriores (saldo, item e movimentação). Se alguma falhar, o status vira `separada` mesmo assim. A ação **Entregar** depois exige uma movimentação vinculada, e como ela não existe, bloqueia.

## Passo 1 — Liberar a entrega pelo status

Trocar o critério da trava em `entregarMutation` (`src/pages/estoque/EstoqueSolicitacoes.tsx`):

```text
bloquear entrega  =  status da solicitação NÃO é "separada"
```

- Pedidos em `pendente` ou `aprovada` continuam bloqueados com orientação de usar **Separar** primeiro.
- Pedidos já em `separada` — novos e os 8 antigos — passam a poder ser entregues.

**Resultado:** a mensagem de erro que a Rejane está vendo some para sempre. Novos pedidos e os antigos já marcados como separados passam a permitir entrega.

## Passo 2 — Nunca mais falhar em silêncio na separação

Em `separarMutation`, verificar o `error` de **todas** as gravações e abortar antes de mudar o status:

- `update`/`delete` em `estoque_saldos` (baixa de saldo)
- `update` em `estoque_solicitacao_itens` (quantidade atendida e local)
- `insert` em `estoque_movimentacoes` (saída)

Se qualquer uma falhar, o fluxo para com a mensagem real do banco e o pedido **não** fica como "Separada".

Aplicar a mesma checagem nas demais ações que gravam no banco (aprovar, entregar, confirmar recebimento), para padronizar o tratamento de erro.

## Passo 3 — Ajustar o aviso no diálogo de detalhes (só para os antigos)

A mensagem de "Nenhuma movimentação registrada" só aparecerá nos 8 pedidos antigos. Para novos pedidos, depois do Passo 2, a movimentação será gravada normalmente, então o aviso não aparece.

Para os antigos, trocar o texto atual (que afirma que o pedido "ainda não foi separado") por algo neutro:

> "Nenhuma movimentação de saída vinculada a esta solicitação. O status está como separado, mas a baixa de saldo não foi registrada no momento."

Assim ninguém pensa que o pedido ainda precisa ser separado.

## Passo 4 — Corrigir os 8 pedidos antigos (opcional, recomendado)

Como a baixa de saldo não foi gravada para os antigos, o estoque em tela está maior que o real. Se quiser regularizar, posso montar um script que:

- Leia os itens de `estoque_solicitacao_itens` para cada um dos 8 pedidos;
- Insira a movimentação de saída faltante em `estoque_movimentacoes`;
- Desconte a quantidade do saldo correspondente em `estoque_saldos`.

Antes de rodar, você pode validar as quantidades com:

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

Se preferir, também dá para ajustar manualmente pela tela de **Saldos** em vez de rodar um script.

## Passo 5 — Validar

- Rejane abre um pedido antigo com status **Separada** → **Entregar** funciona sem erro.
- Novo pedido: Aprovar → Separar → confere que a movimentação aparece em Movimentações e o saldo baixa → Entregar.
- Um pedido em **Aprovada** continua sem permitir entrega direta.

## Detalhes técnicos

- Alterações apenas no frontend: `src/pages/estoque/EstoqueSolicitacoes.tsx`.
  - Regra de entrega por `sol.status === "separada"`.
  - Verificação de `error` em todas as escritas de `separarMutation` e demais mutations.
  - Texto condicional no bloco de movimentações do diálogo de visualização.
- Sem alterações de banco nem de RLS (as políticas já estão corretas).
- Script de regularização dos 8 pedidos é feito apenas se você quiser corrigir o saldo histórico.
