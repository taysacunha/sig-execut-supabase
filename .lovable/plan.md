## Ajuste

Ao trocar de aba (Disponíveis / Instaladas / Baixadas) em `/estoque/placas`, resetar os filtros Tipo / Tamanho / Material / Local para "Todos" e voltar para a página 1, evitando que filtros ativos de uma aba escondam linhas em outra.

## Escopo técnico

- `src/pages/estoque/EstoquePlacas.tsx`: no `onValueChange` do `<Tabs>` (linha ~537), além de `setAba` e `setCurrentPage(1)`, chamar `setTipoFiltro("todos")`, `setTamanhoFiltro("todos")`, `setMaterialFiltro("todos")`, `setLocalFiltro("todos")`.
- Nada mais muda.
