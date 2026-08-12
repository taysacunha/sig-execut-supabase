# Calendário: busca que encontra tudo e fim dos falsos "possíveis duplicidades"

## O que está acontecendo hoje

**1. Busca não encontra "1705"**
- O filtro de busca envia `ilike` apenas na coluna `descricao` (`useLancamentos`, `src/hooks/useDespesasLancamentos.ts` linha 118). Se "1705" for número de pasta, número de venda, documento, código do imóvel ou nome da pessoa, nada é retornado.
- A busca também é acento-sensível (`ilike` puro).
- Além disso, o calendário já inicia com o período do mês corrente (`dataInicio`/`dataFim` = 1º e último dia do mês). Ao digitar na busca esses filtros de data continuam ativos, então lançamentos de outros meses ficam fora do resultado mesmo batendo com o texto.

**2. Badge "possíveis duplicidades"**
- Esse alerta não vem da função do banco (`despesas_detectar_duplicidades`, usada só dentro do diálogo). É um cálculo próprio da página (`src/pages/despesas/DespesasCalendario.tsx`, linhas 170-186) que marca como duplicado qualquer par com: mesmo tipo, mesmo valor, mesma pessoa e vencimento com até 3 dias de diferença.
- Ele ignora centro de custo, imóvel, referência (pasta/venda) e série de recorrência, e também considera lançamentos cancelados. Por isso encargos legítimos do mesmo fornecedor com mesmo valor para imóveis/centros diferentes aparecem como "duplicados". A contagem `size / 2` também erra quando o grupo tem 3 ou mais itens.

## Correções

**Busca**
- Passar a buscar em vários campos ao mesmo tempo: descrição, documento, número de pasta, número de venda, nome da pessoa e código do imóvel.
- Ignorar acentuação e maiúsculas.
- Quando houver texto na busca, ignorar automaticamente o recorte do mês (busca passa a varrer todos os períodos), com um aviso discreto: "Busca aplicada a todos os períodos". Os filtros de data continuam valendo quando a busca está vazia.
- Atualizar o rótulo do campo para "Buscar (descrição, documento, pasta, venda, pessoa, imóvel)".

**Duplicidades**
- Só marcar como possível duplicidade quando: mesmo tipo, mesmo valor, mesma pessoa, **mesmo centro de custo**, **mesmo imóvel** (ou ambos sem imóvel), **mesma referência** (pasta/venda) e vencimento com até 3 dias de diferença.
- Ignorar lançamentos cancelados e estornados.
- Ignorar pares que pertencem à mesma série de recorrência (parcelas geradas automaticamente não são duplicidade).
- Contar grupos corretamente (número de grupos, não `itens / 2`), e o badge passa a dizer "N possível(is) duplicidade(s)".

## Detalhes técnicos

- `src/hooks/useDespesasLancamentos.ts`: substituir o `ilike("descricao", ...)` por um filtro combinado `query.or("descricao.ilike.%t%,documento_numero.ilike.%t%,referencia_numero_pasta.ilike.%t%,referencia_numero_venda.ilike.%t%,referencia_numero.ilike.%t%")` (escapando vírgulas do termo). Como `pessoa.nome` e `imovel.codigo` estão em tabelas relacionadas, aplicar esses dois como filtro adicional em memória sobre o resultado, usando `normalizeText` (`src/lib/textUtils.ts`) para ignorar acento — assim o texto digitado também casa com nome de pessoa/imóvel.
- Para tornar a busca no servidor insensível a acento sem depender de extensão no banco, normalizar apenas o termo e complementar com o filtro em memória sobre os campos textuais já carregados.
- `src/pages/despesas/DespesasCalendario.tsx`: quando `filtros.busca` tiver conteúdo, montar a consulta sem `dataInicio`/`dataFim`; exibir o aviso de período ignorado; reescrever o `useMemo` de `duplicados` com as regras acima, retornando `Map<id, grupoId>` para contar grupos.
- Nenhuma alteração de banco ou de RPC é necessária.