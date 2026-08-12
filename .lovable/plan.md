# Busca, ordenação e paginação em Recorrências

Adicionar controles de tabela à página Despesas > Recorrências, reaproveitando os componentes já usados no módulo de Vendas.

## O que muda na tela

Acima da tabela de séries:
- Campo de busca livre (ignora acentuação e maiúsculas), pesquisando em: descrição, empresa/pessoa, centro de custo e frequência.
- Filtros rápidos por frequência (Mensal, Anual, Meses fixos, Intercalada), centro de custo, empresa/pessoa e status (Ativa/Pausada).
- Filtro de período por data de início (data inicial e data final).
- Botão "Limpar filtros" quando houver algum filtro ativo.

Na tabela:
- Cabeçalhos ordenáveis (clique alterna asc/desc) em: Descrição, Frequência, Valor, Centro, Empresa, Início, Última geração até e Status.

Abaixo da tabela:
- Paginação com seletor de 25 / 50 / 100 / 200 por página e contador "Mostrando X-Y de Z".
- Ao mudar busca, filtros ou itens por página, volta para a página 1.
- Mensagem "Nenhuma série encontrada com os filtros aplicados" quando o resultado for vazio.

## Detalhes técnicos

- `src/pages/despesas/DespesasRecorrencias.tsx`: montar uma lista derivada (`useMemo`) achatando os campos aninhados em colunas planas — `empresa_nome` (`pessoa.nome`), `centro_nome` (`centro_custo.nome`) e `frequencia_label` (mapa `TIPO_LABEL`) — e usar `useTableControls` (`src/hooks/useTableControls.ts`) sobre essa lista, com `searchField: ["descricao", "empresa_nome", "centro_nome", "frequencia_label"]` e `defaultItemsPerPage: 25`.
- Busca sem acento já é atendida por `normalizeText` (`src/lib/textUtils.ts`), usada internamente pelo hook.
- Filtros de select e intervalo de datas aplicados antes do hook (o hook recebe a lista já filtrada), para que busca/ordenação/paginação operem sobre o conjunto filtrado.
- Reusar `TableSearch`, `SortableHeader` e `TablePagination` de `src/components/vendas/TableControls.tsx` (já suporta 25/50/100/200).
- Renderizar `paginatedData` no lugar de `data`; nenhuma mudança em hooks de dados, query ou banco.