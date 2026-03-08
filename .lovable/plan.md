

## Plano: Corrigir PDF do Relatório de Corretores (Avaliação não aparece)

### Problema

O `EvaluationDetailsPDF` é renderizado condicionalmente com `{isExporting && ...}`. Quando `isExporting` vira `true`, o componente monta e **inicia** as queries ao Supabase, mas o `html2canvas` roda apenas 150ms depois -- tempo insuficiente para as queries completarem. Resultado: a avaliação nunca aparece no PDF.

A parte de vendas (`saleDetails`) funciona porque os dados já estão carregados antes do export (a query roda sempre que há corretor selecionado).

### Solução

1. **Mover as queries de avaliação para fora do componente `EvaluationDetailsPDF`** -- buscar os dados no componente pai (`BrokerIndividualReport`) com `enabled: !!selectedBrokerId`, assim os dados já estarão prontos quando o export iniciar.

2. **Renderizar o bloco de avaliação no PDF** usando os dados pré-carregados + `{isExporting && hasData && <Card>...</Card>}` -- sem componente filho com queries próprias.

3. **Aumentar o delay** de 150ms para ~300ms como margem de segurança para o React re-render.

### Alterações em `BrokerIndividualReport.tsx`

| Trecho | Alteração |
|--------|-----------|
| Queries (após linha ~396) | Adicionar query de `broker_evaluations` (obs_feedbacks, acoes_melhorias, metas) e `monthly_leads.last_visit_date` com `enabled: !!selectedBrokerId` |
| Linhas 771-774 | Substituir `<EvaluationDetailsPDF>` por bloco inline usando dados pré-carregados |
| Linha 454 | Aumentar delay para 300ms |
| Componente `EvaluationDetailsPDF` (linhas 82-179) | Pode ser removido ou mantido (não será mais usado no export) |

