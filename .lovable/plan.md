

## Bug: Violação global "DISTRIBUICAO_2_ANTES_3" não aparece ao filtrar

### Causa raiz

A violação `DISTRIBUICAO_2_ANTES_3` é **global** — tem `brokerId: ""` e `brokerName: "Distribuição Geral"`. Ela vive em `result.violations`, não dentro de nenhum `brokerReports[].violations`.

Quando você clica no card e filtra por essa regra na visão "Por Corretor", o código filtra `brokerReports` procurando corretores com essa violação. Nenhum corretor tem, então a lista fica vazia.

### Solução

Adicionar uma seção de **"Violações Globais"** no topo da visão "Por Corretor" que exibe violações com `brokerId` vazio quando elas passam pelo filtro ativo. Isso garante que:

1. Ao clicar no card `DISTRIBUICAO_2_ANTES_3`, a violação global aparece no topo
2. Ao filtrar por "Apenas Erros", violações globais de erro também aparecem
3. A busca por corretor não afeta violações globais (elas não são de um corretor específico)

### Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/ValidationReportPanel.tsx` | Computar `filteredGlobalViolations` (violações com `brokerId` vazio que passam nos filtros de severidade e regra). Renderizar acima da lista de corretores como um card especial "Violações Gerais" com ícone e detalhes. |

