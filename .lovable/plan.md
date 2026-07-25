# Dashboard operacional de Despesas

Transformar `src/pages/despesas/DespesasDashboard.tsx` (hoje só atalhos) em um **painel operacional** com o que realmente pede atenção agora. Tudo respeitando `useDespesasPermissions` (só mostra o bloco se o usuário tem `podeVer` na aba de origem).

## KPIs no topo (4 cards)

Baseados em `despesas_lancamentos`:

1. **Vencendo em 7 dias** — status ≠ pago/quitado/gimob/cancelado, `vencimento` entre hoje e hoje+7. Mostra contagem + soma R$.
2. **Vencidos** — status `atrasado` ou `a vencer` com `vencimento < hoje`. Contagem + soma R$ (destaque vermelho).
3. **A receber em aberto (mês)** — tipo `a_receber`, status em aberto, competência do mês atual.
4. **Pago no mês** — soma dos pagamentos deste mês.

## Blocos abaixo dos KPIs

- **Próximos vencimentos (10 linhas)** — lista os 10 lançamentos a vencer/atrasados mais próximos, com descrição, centro de custo, valor e badge de status. Cada linha clica e vai para `/despesas/calendario`.
- **Coisas para atualizar** — checklist do que está incompleto:
  - Imóveis **alugados sem inquilino** vinculado.
  - Imóveis sem **RIP** ou sem **inscrição municipal**.
  - Recorrências **ativas sem data-fim** e com `data_inicio` > 12 meses (sugere renovar/encerrar).
  - Lançamentos pagos parcialmente há mais de 30 dias sem novo pagamento.
  - Cada item é um link para a página correspondente com o filtro aplicável.
- **Gráfico: Fluxo dos próximos 30 dias** — Recharts `AreaChart` empilhado: valores a receber vs a pagar por dia. Mesmo tema já usado em Relatórios.
- **Gráfico: Top 5 centros de custo — pago no mês** — `BarChart` horizontal.
- **Notificações não lidas** — reaproveita `useNotificacoes()`, mostra as 5 últimas com link para `/despesas/notificacoes`.

## Rodapé

Manter os **atalhos** atuais (Calendário / Imóveis / Repasses / Cadastros) em versão compacta, para o usuário que só quer navegar.

## Detalhes técnicos

- **Arquivo alterado:** apenas `src/pages/despesas/DespesasDashboard.tsx`.
- Novo hook consolidador `src/hooks/useDespesasDashboard.ts` com um único `useQuery` que faz as agregações em Postgres via `select(..., { count: 'exact' })` e ranges, evitando o limite de 1000 linhas por query. Consome as tabelas já existentes: `despesas_lancamentos`, `despesas_lancamento_pagamentos`, `despesas_imoveis`, `despesas_recorrencias`, `despesas_centros_custo`.
- Sem migrações: tudo lido via RLS já existente (`can_view` das políticas atuais das tabelas de despesas).
- Gráficos com `recharts` (já usado em Relatórios) e tokens semânticos (`hsl(var(--primary))`, `--destructive`, etc.). Sem cores hardcoded.
- Loading com `Skeleton`, empty states com mensagem clara.
- Sem novas dependências.
- Sem alteração em edge functions.

## Verificação

- `tsgo` para tipos.
- Abrir `/despesas` no preview e conferir: KPIs somando, listas renderizando, gráficos com dados, cliques indo para as páginas certas.
