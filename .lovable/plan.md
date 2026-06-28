# Plano: Card de Leads no Dialog de Avaliações

## Objetivo
Adicionar um card de leads na seção "Desempenho" dos dialogs de avaliação dos corretores, exibindo leads recebidos e descartados, com alerta visual quando descartados > 50% dos recebidos.

## Escopo
Aplicar a mudança em **ambos** os dialogs:
- `EvaluationDialog.tsx` — dialog mensal (editável)
- `EvaluationSummaryDialog.tsx` — dialog anual (somente leitura)

## Mudanças Técnicas

### 1. EvaluationDialog.tsx (mês selecionado)

- Atualizar a query `performanceData` para retornar também `leads_received` e `leads_archived` da tabela `monthly_leads`.
- Atualizar a query `previousPerformanceData` para retornar os mesmos campos do mês anterior.
- Transformar o grid de Desempenho de 3 para 4 colunas (`grid-cols-2 sm:grid-cols-4`).
- Adicionar card de Leads com:
  - Ícone `Users` (lucide-react).
  - Valores: recebidos e descartados lado a lado.
  - Ícone de status:
    - `AlertTriangle` com cor `amber-500` (texto e fundo) quando descartados > 50% dos recebidos.
    - `CheckCircle` com cor `green-500` quando descartados <= 50% dos recebidos.
  - Comparativo com mês anterior (igual aos demais cards).

### 2. EvaluationSummaryDialog.tsx (visão anual)

- Adicionar query `useQuery` para agregar `leads_received` e `leads_archived` do corretor no ano filtrado (`year_month LIKE 'YYYY-%'`).
- Transformar o grid de Desempenho Anual de 3 para 4 colunas.
- Adicionar card de Leads com:
  - Ícone `Users`.
  - Total recebido e descartado no ano.
  - Alerta visual seguindo a mesma regra (>50% descartados = alerta).

### 3. Regras de Cálculo

- Regra de alerta:
  - Se `leads_received > 0` e `leads_archived / leads_received > 0.5` → status de alerta.
  - Caso contrário → status verde.
- Se `leads_received === 0` → status verde (sem alerta).
- Percentual descartado pode ser exibido como texto auxiliar (ex: "50% descartados").

## Cores
- Alerta (descartados > 50%): fundo `amber-50/50 dark:bg-amber-950/20`, texto/ícone `amber-600 dark:text-amber-400`.
- OK (descartados <= 50%): fundo `green-50/50 dark:bg-green-900/20`, texto/ícone `green-600 dark:text-green-400`.

## Arquivos Alterados
- `src/components/vendas/EvaluationDialog.tsx`
- `src/components/vendas/EvaluationSummaryDialog.tsx`

## Não Alterar
- Nenhuma tabela do banco (os dados `leads_received` e `leads_archived` já existem em `monthly_leads`).
- Sem mudanças em `Evaluations.tsx`, `EvaluationCard.tsx` ou `EvaluationRanking.tsx` (apenas dialogs).

## Verificação
- Após implementar, abrir o dialog de avaliação de um corretor e confirmar que o card de Leads aparece com os valores e ícone correto.
- Verificar um corretor com descartados > 50% dos recebidos para garantir que o alerta aparece.
- Verificar o dialog de resumo anual com o mesmo comportamento.
