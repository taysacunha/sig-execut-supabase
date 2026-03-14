

## Plano: Adicionar seletor de itens por página (25/50/100) nas tabelas de Férias

### Situação atual

- **FeriasColaboradores**: Já usa `useTableControls` + `TablePagination` com seletor 25/50/100. Já está correto.
- **FeriasFerias**: Usa `usePagination` com 15 itens fixos e controles manuais (sem seletor de itens por página) nas 3 tabelas: Férias, Formulários Anuais e Contador.

### Mudança

No `FeriasFerias.tsx`, substituir os 3 blocos de paginação manual por `TablePagination` (de `@/components/vendas/TableControls`), que já inclui o seletor 25/50/100.

1. Importar `TablePagination` de `@/components/vendas/TableControls`
2. Trocar `usePagination(filteredFerias, 15)` por `usePagination(filteredFerias, 25)` e adicionar estado `itemsPerPage` para cada tabela (ferias, formulários, contador)
3. Substituir os 3 blocos manuais de paginação (linhas ~547-556, ~651-660, e contador sem paginação) pelo componente `<TablePagination>` unificado
4. Adicionar paginação com seletor também na aba Contador (atualmente sem paginação)

### Arquivo impactado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ferias/FeriasFerias.tsx` | Importar `TablePagination`; adicionar 3 estados `itemsPerPage`; substituir blocos manuais por `<TablePagination>`; adicionar paginação ao Contador |

