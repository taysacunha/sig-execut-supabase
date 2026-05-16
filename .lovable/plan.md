## Objetivo

Permitir que a aba **Tabela do Contador** mostre férias de **mais de um ano de período aquisitivo** ao mesmo tempo, com a tabela e o PDF agrupados por ano aquisitivo — eliminando a necessidade de gerar PDFs separados.

## Mudanças na UI (aba Contador)

1. **Novo filtro multi-seleção: "Anos aquisitivos"**
   - Posicionado dentro do bloco de filtros existente da aba Contador, ao lado de Mês e Período.
   - Componente: `Popover` + lista de `Checkbox` (mesmo padrão visual usado em outros multi-selects do projeto), com botão que mostra "Todos" / "2024" / "2024, 2025" / "3 anos selecionados".
   - Opções: anos derivados dinamicamente dos `periodo_aquisitivo_inicio` existentes no banco (query auxiliar leve buscando anos distintos).
   - Estado inicial: vazio = comportamento atual (usa o `anoFilter` global de gozo, como hoje).
   - Quando ≥ 1 ano é selecionado: o filtro **substitui** o escopo da query do Contador — passa a buscar férias cujo `periodo_aquisitivo_inicio` caia em qualquer um dos anos selecionados (independente do ano de gozo). O filtro global "Ano do período aquisitivo" do topo da página é **ignorado apenas nesta aba** quando há seleção múltipla, com um aviso discreto ("Filtro de anos aquisitivos ativo — sobrescrevendo o ano global").
   - Botão "Limpar filtros" também zera essa seleção.

2. **Tabela agrupada por ano aquisitivo**
   - Quando há ≥ 2 anos visíveis no resultado, inserir uma linha de cabeçalho separadora antes de cada grupo: `Período aquisitivo: 2024` (linha full-width com fundo `muted`).
   - Dentro de cada grupo: mesma estrutura atual (ordenada por nome/setor).
   - Quando há apenas 1 ano, não exibir cabeçalhos de grupo (mantém visual atual).

3. **Paginação**
   - Mantida sobre o conjunto total filtrado; os cabeçalhos de grupo aparecem onde forem necessários na página atual.

## Mudanças no PDF (`generateContadorPDF`)

1. **Título do PDF**
   - Se múltiplos anos: `TABELA DE FÉRIAS - CONTADOR - 2024, 2025`.
   - Se um único ano: comportamento atual.

2. **Agrupamento visível**
   - Antes de cada bloco de linhas de um ano aquisitivo, inserir uma faixa de cabeçalho destacada (fundo cinza claro, fonte bold, ~7mm de altura): `Período aquisitivo: 2024`.
   - Quebrar página automaticamente se o cabeçalho + primeira linha do grupo não couber.

3. **Nome do arquivo**
   - `ferias-contador-2024-2025.pdf` (anos concatenados por hífen, ordenados).

## Detalhes técnicos

- Arquivo afetado: `src/pages/ferias/FeriasFerias.tsx` (toda a lógica do Contador já está nele).
- Novo estado: `contadorAnosAquisitivos: string[]`.
- Nova query (ou ampliação da existente) para o Contador:
  - Se `contadorAnosAquisitivos.length === 0`: mantém a query atual (filtrada por `quinzena1_inicio` no `anoFilter`).
  - Caso contrário: nova query keyed por `["ferias-contador-aquisitivos", contadorAnosAquisitivos]`, com filtro `periodo_aquisitivo_inicio` entre `${min}-01-01` e `${max}-12-31` e filtro client-side garantindo que o ano de início caia exatamente nos selecionados.
- Query auxiliar para popular as opções: `select distinct extract(year from periodo_aquisitivo_inicio)` (via `.select("periodo_aquisitivo_inicio")` + dedup client-side, ou RPC se preferir — começarei com a abordagem client-side, leve).
- `contadorDataFiltered` (`useMemo`) ganha uma etapa adicional: ordenar por `(anoAquisitivo asc, nome asc)` quando há múltiplos anos, para o agrupamento ser contíguo.
- Renderização da tabela: trocar `map` simples por um `reduce`/loop que insere `<TableRow>` separador quando o `anoAquisitivo` muda em relação à linha anterior visível.
- `generateContadorPDF`: agrupar `contadorDataFiltered` por ano aquisitivo (`Map<number, Row[]>`), iterar grupos e desenhar header de grupo + linhas.

## Fora de escopo

- Não altera o filtro global de ano do topo da página (continua afetando outras abas).
- Não altera o cálculo de dias/períodos nem regras do contador.
- Não muda layout dos demais filtros ou do botão Exportar PDF.