# Ajustar exibição de locais na Reposição e remover filtro de unidades

## Problema
Na aba/botão **Reposição** de Saldos de Estoque, a distribuição por local é exibida sem a unidade correspondente:
- Hoje: `Depósito 1: 15 · Depósito 1 - COPA: 98`
- Desejado: `Bessa - Depósito 1: 15 · Tambaú - Depósito 1 - COPA: 98`

Além disso, o filtro **Todas as unidades / Bessa / Tambaú** deve ser removido, pois a Reposição é do material como um todo, não de uma unidade específica.

## O que será feito

1. **Enriquecer o nome do local com a unidade**
   - Em `src/components/estoque/saldos/ReposicaoTab.tsx`, buscar também o nome da unidade (`ferias_unidades.nome`) ao carregar os locais.
   - Alterar a montagem de `locaisTexto` para o padrão `{unidade} - {local}: {qtd}`.
   - Ordenar os detalhes por unidade, depois por local, para manter a leitura consistente.

2. **Remover o filtro de unidades**
   - Remover o estado `unidadeFiltro` e o `Select` de "Todas as unidades".
   - Remover a lógica de filtro por `unidadeIds` em `filtered`.
   - Remover `unidadeIds` da interface `ReposicaoRow` (não será mais necessário).
   - Ajustar a função `limparFiltros` para não resetar `unidadeFiltro`.
   - Ajustar a função `gerarPDF` para não incluir o filtro de unidade no cabeçalho.

3. **Manter os demais filtros e funcionalidades**
   - Preservar busca, filtro de categoria, filtro de situação, ordenação, paginação e exportação PDF.
   - Manter a chave de cache exclusiva da Reposição (`estoque-saldos-reposicao`, `estoque-locais-ativos-reposicao`, etc.) para não reintroduzir o bug anterior de colisão com a aba Saldos.

## Validação
- Abrir a aba Reposição e confirmar que cada linha mostra a distribuição no formato `Unidade - Local: quantidade`.
- Confirmar que o filtro de unidades não aparece mais.
- Confirmar que busca, categoria, situação, ordenação, paginação e PDF continuam funcionando.
- Alternar entre Reposição e as abas normais (Todas, Por material, Bessa, Tambaú) sem perda de dados ou nomes.

## Escopo técnico
- `src/components/estoque/saldos/ReposicaoTab.tsx`: ajuste de query de locais, formatação de `locaisTexto`, remoção do filtro de unidades e ajuste no PDF.
- Sem alteração de banco, RLS, permissões ou regras de estoque.
