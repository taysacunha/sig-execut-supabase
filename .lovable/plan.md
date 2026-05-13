## Plano

Melhorias de UX nos filtros e cards do Calendário > Férias (`src/components/ferias/calendario/CalendarioFeriasTab.tsx`).

### 1) Identificação clara dos campos de filtro

Hoje os filtros (Colaboradores, Setores, Unidade, Meses/Ano no Gantt, Ano do gozo na Lista) aparecem só com placeholder, sem rótulo. Vou:

- Envolver o bloco de filtros num container com fundo `bg-muted/40` e título pequeno "Filtros" (ícone `SlidersHorizontal`), padrão visual semelhante ao `ColaboradorFilters.tsx`.
- Cada controle ganha um `Label` pequeno acima (`text-xs font-medium text-muted-foreground`):
  - "Colaboradores"
  - "Setores"
  - "Unidade"
  - "Meses do Gantt" / "Ano" (no modo Gantt)
  - "Período exibido" para o select da lista (renomear "Ano do gozo" para deixar mais claro: opções "Mês atual do calendário" e "Ano de gozo: 2025/2026/...")
- Adicionar um `HelpCircle` com tooltip ao lado de "Período exibido" explicando: "Selecione um ano para ver todos os colaboradores com gozo naquele ano, mesmo que o período aquisitivo seja de outro ano."

### 2) Botão "Limpar filtros"

- Adicionar ao final da barra de filtros um botão `variant="ghost"` com ícone `X` "Limpar filtros".
- Só aparece quando há algum filtro ativo (`hasActiveFilters`).
- Ao clicar, executa um `resetFilters()` que volta tudo para o padrão:
  - `selectedColaboradores = []`
  - `selectedSetores = []`
  - `selectedUnidade = "all"`
  - `searchNome = ""`
  - `listaAnoGozo = "all"`
  - `ganttMonths = []` e `ganttYear = ano atual`
  - `calendarMonth = new Date()` (volta para o mês atual)
  - `statusFilter = "all"` (novo, ver item 3)

Resultado: calendário volta a mostrar o mês atual, lista volta a mostrar colaboradores com férias no mês atual.

### 3) Cards de resumo clicáveis (filtro rápido)

Hoje "Total no Ano", "Em Gozo", "Este Mês" e "Com Exceção" são apenas leitura. Vou transformá-los em filtros rápidos via novo estado `statusFilter: "all" | "ano" | "em_gozo" | "mes" | "excecao"`.

Comportamento:

- Cards ganham `cursor-pointer`, hover sutil (`hover:border-primary/40`) e estado ativo (`ring-2 ring-primary` + `bg-primary/5`).
- Clicar num card alterna o filtro (clique novamente no card ativo desativa, voltando a `"all"`).
- Quando um card está ativo:
  - Força `viewMode = "lista"` (a Gantt continua com seu próprio recorte de meses).
  - Reseta `listaAnoGozo` conforme o card:
    - **Total no Ano**: `listaAnoGozo = String(anoAtual)` → mostra todos os colaboradores com gozo no ano atual, agrupado por mês.
    - **Em Gozo**: `listaAnoGozo = "all"`, mas a lista é filtrada adicionalmente por `status ∈ {em_gozo_q1, em_gozo_q2, em_gozo}`. Calendário também passa a destacar só esses dias.
    - **Este Mês**: `listaAnoGozo = "all"` e `calendarMonth = new Date()` → comportamento padrão atual.
    - **Com Exceção**: `listaAnoGozo = "all"` e filtra `f.is_excecao === true`.
- Indicação textual no título do card "Lista" mostrando o filtro ativo (ex.: "Mostrando: Em gozo agora" + um chip com botão `X` para remover).

### 4) Layout

- Empilhar barra superior em duas linhas em telas estreitas: linha 1 com toggle Lista/Gantt + botão Limpar; linha 2 com os controles de filtro com seus labels.
- Manter responsivo (`flex-wrap`) e sem alterar a Gantt além do label.

### Detalhes técnicos

- Adicionar `statusFilter` state e estendê-lo em `feriasLista` / `feriasDoMes` / `feriasDoAno` via um único `useMemo` derivado: aplica os filtros base e, depois, o recorte do card.
- `hasActiveFilters` = `selectedColaboradores.length || selectedSetores.length || selectedUnidade !== "all" || listaAnoGozo !== "all" || statusFilter !== "all" || searchNome`.
- `resetFilters()` chama os setters acima.
- Para o card "Em Gozo", reaproveitar `FERIAS_EM_GOZO_STATUSES` de `src/lib/dateUtils.ts`.
- Sem mudanças de schema, queries ou lógica de domínio. Tudo em UI/estado local do componente.

### Validação

- Clicar em cada card → lista atualiza para o conjunto correto e card fica destacado.
- Clicar de novo no mesmo card → desativa.
- "Limpar filtros" volta calendário ao mês atual, lista mostra colaboradores com férias no mês atual e nenhum card fica ativo.
- Labels visíveis em todos os campos; tooltip explica "Período exibido".
- Filtros combinam (ex.: card "Em Gozo" + setor X mostra só os em gozo do setor X).
