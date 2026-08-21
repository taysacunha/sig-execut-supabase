# Entender e corrigir: solicitações que não aparecem em Movimentações

## Como as duas páginas se relacionam hoje (verificado no código)

- **Solicitações** grava apenas em `estoque_solicitacoes` + `estoque_solicitacao_itens`. Criar, aprovar, entregar e confirmar recebimento **não geram nenhuma linha** em `estoque_movimentacoes`.
- **Movimentação de saída só nasce em um ponto**: quando o gestor executa a ação **Separar** (status `aprovada` → `separada`). Só aí o sistema baixa o saldo e insere a movimentação com `tipo = saida`, ligada à solicitação.
- Na tabela de Movimentações, a coluna **Responsável** é quem *separou* (o gestor), não quem solicitou. O nome do solicitante só aparece dentro do texto de **Observações** ("Separação para solicitação de X").
- A busca da página de Movimentações procura **apenas** em `material_nome` e `observacoes`, e a lista carrega somente as **500 movimentações mais recentes**.

## Por que a solicitação da Érika (Resma A4, 15/08) não aparece

Duas explicações possíveis, ambas coerentes com o código acima:

1. **A solicitação dela nunca foi separada** — ficou em `pendente`/`aprovada`, ou foi entregue "por fora" e apenas marcada como entregue. Sem a etapa Separar, não existe movimentação. É a hipótese mais provável, e explica por que só aparecem os pedidos de Ruan, Diego e Rejane (os que passaram pelo fluxo completo).
2. **A movimentação existe mas caiu fora do recorte** — o limite de 500 registros mais recentes pode ter cortado 15/08.

Nada indica filtro por usuário: a RLS de `estoque_movimentacoes` libera leitura para todo usuário com acesso ao módulo estoque, sem distinção de solicitante.

## Passo 1 — Confirmar a causa

Rodar no SQL Editor:

```sql
select s.id, s.solicitante_nome, s.status, s.created_at,
       i.quantidade_solicitada, i.quantidade_atendida, m.nome as material,
       (select count(*) from estoque_movimentacoes mv where mv.solicitacao_id = s.id) as movimentacoes
from estoque_solicitacoes s
join estoque_solicitacao_itens i on i.solicitacao_id = s.id
join estoque_materiais m on m.id = i.material_id
where s.created_at::date between '2026-08-14' and '2026-08-16'
order by s.created_at desc;
```

Se `movimentacoes = 0` e o status não for `separada`/`entregue` via separação, está confirmada a hipótese 1.

Esse foi o retorno do SQL:  
| id                                   | solicitante_nome                       | status   | created_at                    | quantidade_solicitada | quantidade_atendida | material                  | movimentacoes |

| ------------------------------------ | -------------------------------------- | -------- | ----------------------------- | --------------------- | ------------------- | ------------------------- | ------------- |

| 1f1b98e2-1ccf-403e-9457-f368651c5d4f | Erika Weruska Gonzaga Fernandes Cirilo | entregue | 2026-08-15 11:42:27.416506+00 | 4                     | 4                   | Resma A4                  | 0             |

| f8852371-4ce9-4328-8cbb-c9e67305be76 | Rejane de Araujo Santos Ferreira       | entregue | 2026-08-14 11:30:56.684169+00 | 4                     | 4                   | Copo descataveis - 180 ml | 0             |

| f8852371-4ce9-4328-8cbb-c9e67305be76 | Rejane de Araujo Santos Ferreira       | entregue | 2026-08-14 11:30:56.684169+00 | 1                     | 1                   | Garrafão de água 20 L     | 0             |

## Passo 2 — Ajustes na página de Movimentações

- Adicionar coluna **Solicitante** (via `solicitacao_id` → `estoque_solicitacoes.solicitante_nome`, com resolução por `user_profiles` quando o nome estiver salvo como e-mail).
- Incluir solicitante, local de origem/destino e responsável no campo de busca (sem acento).
- Trocar o `limit(500)` por filtro de período (padrão: últimos 90 dias) com opção "todo o histórico", para nada sumir silenciosamente.

## Passo 3 — Tornar o vínculo visível na página de Solicitações

- No diálogo de detalhes da solicitação, mostrar as movimentações geradas por ela (ou o aviso "Nenhuma movimentação registrada — esta solicitação ainda não foi separada").
- Impedir marcar como **Entregue** uma solicitação que nunca foi separada, ou exibir alerta de que o saldo não foi baixado.

## Detalhes técnicos

- `src/pages/estoque/EstoqueMovimentacoes.tsx`: nova query de solicitações, enriquecimento das linhas, colunas/busca/filtro de período.
- `src/pages/estoque/EstoqueSolicitacoes.tsx`: bloco de movimentações no diálogo de visualização e guarda na ação Entregue.
- Sem alterações de banco de dados nem de RLS.