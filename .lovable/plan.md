## Mudanças propostas

### 1. Folgas de Sábado → aba "Mapa por Setor": tooltip ao passar o mouse no setor

Arquivo: `src/components/ferias/folgas/SetoresSabadosTable.tsx`

- Envolver o nome do setor (célula da primeira coluna) em um `HoverCard` (shadcn) com `delayDuration` curto.
- O conteúdo do popover mostra os colaboradores **daquele setor** que estão de férias no mês selecionado (props `year` + `month` já existentes na tabela).
- Buscar férias por meio de uma nova `useQuery` (`["ferias-folgas-mapa-setor-mes", year, month]`) lendo `ferias_ferias` + `ferias_colaboradores` (setor_titular_id, nome, nome_exibicao) com status ativos (`aprovada`, `em_gozo*`, `concluida`) e cujo período de gozo intersecta o intervalo `[startOfMonth, endOfMonth]`.
- A query também carrega `ferias_gozo_periodos` para usar o gozo interno (mesma lógica do item 3 abaixo).
- Cada item do popover mostra: nome do colaborador, intervalo (dd/MM–dd/MM) e total de dias do trecho que cai dentro do mês.
- Caso vazio: "Nenhum colaborador deste setor está de férias em <mês>".

### 2. Calendário de Férias → botão "Limpar filtros" com hover invertido

Arquivo: `src/components/ferias/calendario/CalendarioFeriasTab.tsx`

- Substituir as classes do botão de
  `border-destructive text-destructive hover:bg-destructive/10`
  por
  `border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive`.
- Mantém visual atual em repouso (borda + fonte vermelha, fundo branco) e, no hover, vira fundo vermelho com texto branco — contraste claro.

### 3. Gantt + PDF + Detalhamento: usar somente períodos de gozo interno

Hoje `getGozoIntervals` em `GanttFeriasView.tsx` e `GanttFeriasPDFGenerator.tsx` usa todo `_gozoPeriodos` (que inclui o registro de "vender" — dias destinados ao contador, mas não realmente gozados). Isso gera barras extras e falsas sobreposições.

Mudanças:

a) Em ambos os arquivos `GanttFeriasView.tsx` e `GanttFeriasPDFGenerator.tsx`:
- Em `getGozoIntervals(f)`:
  - Quando `gozo_flexivel` e `_gozoPeriodos` existem → filtrar `p.tipo !== "vender"` (manter apenas `gozo_diferente`/gozo interno). Se a lista filtrada ficar vazia, cair para a próxima regra.
  - Quando `gozo_diferente` for true → continuar usando `gozo_quinzena*` (internas).
  - Caso contrário, quando `vender_dias && dias_vendidos > 0` e o registro tem apenas `quinzena*` (legado): subtrair os `dias_vendidos` do **fim** do intervalo da quinzena onde a venda ocorreu (`quinzena_venda` se disponível, default 1) para representar apenas o trecho gozado. Demais quinzenas permanecem inteiras.
  - Sem venda nem gozo diferente → usar `quinzena*` cheias (são iguais ao gozo).
- Cada interval retornado passa a ser `{ start, end, diasGozados, diasVendidos }`. `diasVendidos` é 0 quando não pertence a esse trecho.

b) `GanttFeriasView.tsx`:
- Tooltip da barra mostra: `dd/MM/yyyy a dd/MM/yyyy`, `<diasGozados> dias gozados` e, se houver, `<diasVendidos> dias vendidos`.
- Recalcular `overlappingSectors` usando os novos intervals filtrados (sem "vender").
- Atualizar tipo `Ferias` para incluir `quinzena_venda?: number | null` (quando relevante para a regra legado).

c) `GanttFeriasPDFGenerator.tsx`:
- Mesmo filtro nos intervals usados para desenhar barras, detectar sobreposição e na seção "Detalhamento por colaborador".
- Cada linha do Detalhamento passa a exibir: `dd/MM/yyyy a dd/MM/yyyy — <X>d gozados` e, se houver, ` • <Y>d vendidos`.
- Garantir que a contagem de `feriasMes` (filtragem inicial por mês) também use os intervals já filtrados, para não trazer colaboradores cujo trecho do mês seja só venda.

d) `CalendarioFeriasTab.tsx`:
- Atualizar a query para selecionar também `quinzena_venda` (pode já existir; verificar) e o `tipo` ao buscar `ferias_gozo_periodos`.
- Repassar isso aos componentes Gantt e PDF.

### Observações técnicas

- Sem mudanças no banco. Toda a lógica é client-side.
- Mantemos compatibilidade com registros antigos (sem `gozo_flexivel`, sem `gozo_diferente`).
- Só camada de apresentação — nada de fluxo de cálculo de saldo, vesting, etc.