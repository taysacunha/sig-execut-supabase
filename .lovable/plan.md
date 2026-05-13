## Plano

Quatro ajustes independentes na área de Férias.

### 1) Página Férias — Clarear o filtro "Ano de referência"

Arquivo: `src/pages/ferias/FeriasFerias.tsx` (linhas ~578-585).

- Manter o label "Ano de referência" como título.
- Adicionar um subtítulo logo abaixo do label, em texto pequeno e `text-muted-foreground`, deixando explícito que se trata do ano do **período aquisitivo**, não do ano em que o gozo das férias foi marcado.
- Adicionar um `Tooltip` (ícone `HelpCircle`) ao lado do Select com um exemplo curto: "Ex.: período aquisitivo 2025 pode ter gozo marcado em 2026 — selecione 2025."
- Reorganizar o bloco para layout em coluna (label + subtítulo) com o Select à direita, mantendo responsividade.

Sem mudanças de lógica/consulta — apenas UI/copy.

### 2) Aba Gantt (Calendário) — unificar mês do gráfico e do PDF, e melhorar o PDF

Arquivos:
- `src/components/ferias/calendario/CalendarioFeriasTab.tsx`
- `src/components/ferias/calendario/GanttFeriasPDFGenerator.tsx`

Mudanças:

- Remover o `Select` de mês interno do `GanttFeriasPDFGenerator` (props `defaultMonth` deixa de ser usado para escolha de mês).
- O componente passa a receber e respeitar o intervalo já filtrado no Gantt (`startDate`/`endDate`) e o array de meses selecionados (ou "year").
- O botão "Gerar PDF do mês" passa a "Gerar PDF" e gera exatamente o que está em tela: um único mês, vários meses ou ano inteiro (paginação por mês).
- Em `CalendarioFeriasTab`, passar para o gerador as props `range`, `ganttMonths`, `ganttYear` e a lista atual de `feriasGantt` (ou seja, os colaboradores realmente exibidos).
- No PDF, abaixo do gráfico Gantt da página, incluir uma seção "Detalhamento por colaborador" listando, para cada colaborador presente naquela página/mês:
  - Nome, setor, unidade
  - Cada período de gozo com texto: `dd/MM/yyyy a dd/MM/yyyy (Nd)`
  - Caso vários períodos, listar todos em linhas separadas
- Ajustar `rowsPerPage` para reservar espaço da seção de detalhamento; se não couber tudo na mesma página do gráfico, paginar a lista textual em páginas seguintes mantendo o cabeçalho.

### 3) Calendário > Folgas de Sábado — corrigir justificativa de exceção e visual do alerta

Arquivos:
- `src/components/ferias/folgas/MoverFolgaDialog.tsx`
- `src/components/ferias/folgas/MoverFolgasLoteDialog.tsx`
- `src/components/ferias/folgas/TrocarFolgaDialog.tsx`
- `src/components/ferias/calendario/CalendarioFolgasTab.tsx`

Diagnóstico: ao mover uma folga, gravamos `is_excecao=true` e `excecao_motivo`, mas **não** atualizamos `excecao_justificativa` com a origem→destino correta. Como a coluna pode ter ficado de uma exceção anterior (ex.: alocação no gerador), a justificativa atual fica defasada (caso da Taysa: justificativa antiga "saiu de 9/5 para 2/5" persiste mesmo após ser realocada de volta para 9/5).

Correções:

- Em `MoverFolgaDialog`: ao mover, gravar `excecao_justificativa = "Movida de dd/MM para dd/MM"` usando `folga.data_sabado` (origem) e `newSaturday` (destino), tanto para a folga principal quanto para a do familiar.
- Em `MoverFolgasLoteDialog`: já preenche `excecao_justificativa` no caso "Realocado em lote"; padronizar para o mesmo formato "Movida de dd/MM para dd/MM" e garantir que o caso "Alocado em lote" também grave a origem (sábado anterior, quando existir) ou um texto consistente.
- Em `TrocarFolgaDialog`: gravar `excecao_justificativa = "Trocada com {nome do colega} (dd/MM ↔ dd/MM)"` para cada lado da troca; mesmo padrão para o caso "Troca junto com familiar".
- Visual em `CalendarioFolgasTab`:
  - Substituir o emoji `⚠️` no Badge por um `AlertCircle` (lucide) pequeno, com `text-orange-500`, alinhado, removendo concatenação de string.
  - Usar `Tooltip` no Badge mostrando `excecao_motivo` + `excecao_justificativa` em hover, para reduzir a sensação de "tudo alertado".
  - Manter o estilo visualmente mais sutil para exceções comuns (borda laranja já existe), reservando destaque maior apenas quando `excecao_motivo` indicar conflito real (lista a definir: "Conflito", "Falha de validação"). Para os demais ("Mudança de sábado", "Realocado em lote", "Troca entre colaboradores"), usar `border-muted` e ícone `text-muted-foreground` para reduzir ruído visual.

Observação: as exceções já gravadas no banco continuarão exibindo a justificativa antiga; a correção evita o problema daqui pra frente. Não vamos rodar backfill automático sem confirmação do usuário.

### 4) Calendário > Férias (Lista) — filtro por ano do gozo

Arquivo: `src/components/ferias/calendario/CalendarioFeriasTab.tsx`.

- Adicionar dois novos controles na barra de filtros (visíveis no modo "Lista"):
  - `Select "Ano do gozo"` com opções de `getYearOptions()` + opção "Todos os anos".
  - O filtro atual já tem multi-select de colaborador; nada muda nele.
- Novo `useMemo` `feriasDoAno`:
  - Se "Todos os anos" → não filtra por ano.
  - Caso contrário → mantém apenas férias cujos `getGozoIntervals` tenham algum intervalo cruzando o ano selecionado (independe do `ano_referencia` do período aquisitivo).
- No modo "Lista", trocar a fonte da listagem de `feriasDoMes` para `feriasDoAno` quando "Ano do gozo" estiver definido, mantendo o calendário mensal como visual auxiliar e exibindo a contagem total no card "Total no ano" coerente com o filtro.
- Agrupar a listagem por mês quando o filtro for "ano inteiro" para facilitar leitura, mantendo o item de detalhe atual ao clicar.
- Não altera o Gantt; ele continua com seu próprio seletor de meses/ano.

### Validação

- Conferir que o filtro "Ano de referência" mostra subtítulo e tooltip e não quebra geração de férias/formulário (mesma prop `anoReferencia` continua sendo passada).
- Gerar o Gantt com 1 mês, vários meses e "Ano inteiro" e gerar o PDF: deve sair com o mesmo recorte da tela e trazer a seção textual por colaborador.
- Mover, trocar e mover em lote folgas e abrir o detalhe no Calendário > Folgas de Sábado: a justificativa deve refletir a origem→destino correta; ícone de alerta sutil para exceções rotineiras.
- No Calendário > Férias (Lista), selecionar "2026" como ano do gozo e confirmar que Maria de Lourdes aparece mesmo com período aquisitivo de 2025.
