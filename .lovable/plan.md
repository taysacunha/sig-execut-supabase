## Problema

Na aba **Férias** (tabela principal em `FeriasFerias.tsx`, coluna "Períodos"), quando o registro é padrão (não-flexível, não-exceção) e o colaborador vendeu dias de um período, as datas exibidas continuam sendo a quinzena inteira (15 dias). Exemplo: Lidiane vendeu 5 dias do 1º período — deveria aparecer `04/05/2026 a 13/05/2026` (10 dias de gozo), mas aparece `04/05/2026 a 18/05/2026` (15 dias).

A aba **Contador** (na mesma página e no `ContadorPDFGenerator.tsx`) já trata isso via `calcAdjustedPeriodo` / `calcularDiasContador` — daí a inconsistência entre abas.

## Correção

Aplicar a mesma lógica de ajuste de data no render da coluna "Períodos" da aba Férias (linhas 1038-1046 de `src/pages/ferias/FeriasFerias.tsx`) e no `FeriasViewDialog.tsx` (cards "1º Período / 2º Período (Direito)").

Regra de cálculo de dias vendidos por período (em ordem de prioridade, igual à coluna "Venda"):

1. `dias_vendidos_q1` / `dias_vendidos_q2` (colunas explícitas)
2. Derivar de `ferias_gozo_periodos` (tipo `vender`) — `15 - gozo_ref_n`
3. Legado: `dias_vendidos` + `quinzena_venda` (1 ou 2)

Para cada quinzena (Q1 e Q2):
- `dias_gozo = 15 - dias_vendidos_do_periodo`
- Se `dias_gozo <= 0` → exibir badge "Vendido (15 dias)"
- Senão → `inicio` a `addDays(inicio, dias_gozo - 1)` usando `parseISO` + `format` (mesmo padrão do `calcAdjustedPeriodo`)

## Arquivos afetados

1. `src/pages/ferias/FeriasFerias.tsx` — extrair helper `getVendaPorPeriodo(f)` (retorna `{ v1, v2 }`) reaproveitando a lógica já existente na célula "Venda" (linhas 1049-1084), e usar tanto na coluna "Períodos" (linhas 1038-1046) quanto na coluna "Venda" — eliminando duplicação. Reusar `calcAdjustedPeriodo` (já existe, linha 583) para renderizar as datas ajustadas.

2. `src/components/ferias/ferias/FeriasViewDialog.tsx` — nos cards "1º Período (Direito)" e "2º Período (Direito)" (linhas 109-127), aplicar o mesmo ajuste: exibir a data final encurtada e um sub-texto "(N dias vendidos)" quando aplicável. Reusar o mesmo helper (copiar/inline a lógica, pois o dialog não tem acesso direto a hooks da página).

## Fora do escopo

- Aba Contador (já está correta).
- Aba Exceção (já tratada anteriormente).
- Estrutura de dados / migrations (apenas apresentação).
