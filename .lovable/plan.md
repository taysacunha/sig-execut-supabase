

## Plano de Melhorias — 6 Pontos

### 1. Relatório PDF na aba Períodos Aquisitivos

Adicionar botão "Exportar PDF" na aba que gera um relatório com períodos parciais, pendentes, a vencer e vencidos (excluindo quitados).

**Novo status "A Vencer"**: períodos cujo concessivo vence em até 60 dias (saldo > 0, ainda não venceu). Na ordenação de status, ficará entre "Pendente" e "Vencido". Filtro de status também incluirá essa opção.

**Arquivo**: `PeriodosAquisitivosTab.tsx` — adicionar lógica do status `a_vencer`, botão PDF, e gerador com jsPDF.

### 2. Organização da tabela por ano (agrupamento)

Ao invés de uma tabela gigante com o mesmo colaborador repetido, agrupar os dados por colaborador com sub-linhas por período aquisitivo, ou manter a tabela mas com agrupamento visual por ano (separadores de ano). A abordagem será: quando não há filtro de ano, mostrar seções colapsáveis por ano (do mais recente ao mais antigo), cada uma com sua tabela. Quando há filtro de ano, mostra tabela simples.

**Arquivo**: `PeriodosAquisitivosTab.tsx`

### 3. Dashboard — corrigir card de Período Aquisitivo (226 vencidos)

**Problema**: O cálculo no dashboard (linha 288) faz `saldo = 30 - diasGozados - diasVendidos` mas **não consulta `ferias_periodos_quitados`**. Então os períodos quitados manualmente continuam aparecendo como vencidos.

**Correção**: Adicionar query de `ferias_periodos_quitados` e subtrair `diasQuitados` no cálculo do saldo, exatamente como já é feito em `PeriodosAquisitivosTab.tsx`.

**Arquivo**: `FeriasDashboard.tsx` (linhas 210-304)

### 4. Folgas — selecionar sábados específicos ao gerar escala

Atualmente o `GeradorFolgasDialog` usa TODOS os sábados do mês automaticamente. A mudança é:
- Antes de gerar o preview, exibir checkboxes com os sábados do mês para o usuário selecionar quais devem ser incluídos na distribuição
- Default: todos selecionados
- A distribuição usará apenas os sábados selecionados para balancear as folgas

**Arquivo**: `GeradorFolgasDialog.tsx` — adicionar UI de seleção de sábados e filtrar `saturdaysOfMonth` antes da alocação.

### 5. Perda de folga vs. Afastamento — esclarecimento e comportamento

Analisando o código:
- **Afastamento**: Já exclui o colaborador da geração de folgas (linhas 363-369 e 407-409 do `GeradorFolgasDialog`). Se o afastamento cobre todos os sábados, o colaborador é excluído totalmente. Se cobre apenas alguns sábados, aqueles sábados específicos são removidos da disponibilidade (linhas 461-463, 478).
- **Perda de folga**: É um registro manual separado (tabela `ferias_folgas_perdas`) que bloqueia o colaborador de receber folga naquele mês inteiro (linha 413).

Então: se um servidor tem atestado que inclui um sábado e isso deve significar perda de folga no mês todo, **isso deve ser registrado como Perda de Folga** na aba de Perdas, não apenas como afastamento. O afastamento apenas remove aquele sábado específico da disponibilidade, não o mês inteiro.

Vou adicionar uma nota/tooltip na UI explicando essa diferença ao usuário.

### 6. Tabela do Contador — mostrar qual período foi enviado

**Problema**: Quando um colaborador tem 2 períodos de férias (1ª e 2ª quinzena separados), o campo `enviado_contador` é booleano único para todo o registro. Não distingue qual período foi enviado.

**Solução**: O `enviado_contador` é por registro de férias (uma linha em `ferias_ferias`), então cada registro já é independente. O problema é quando o colaborador tem **um único registro** com 2 quinzenas e apenas uma foi enviada. Para resolver:
- Mostrar na coluna "Enviado" badges separados: "1ª ✓" / "2ª pendente" ou similar
- Se `enviado_contador = true`, mostrar "✓ Enviado" com a data
- Se `enviado_contador = false`, mostrar "Pendente" com ícone de envio
- Para registros com 2 quinzenas, mostrar indicação visual de quais existem

---

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `PeriodosAquisitivosTab.tsx` | Status "a_vencer", agrupamento por ano, botão PDF |
| `FeriasDashboard.tsx` | Incluir quitações manuais no cálculo de alerta |
| `GeradorFolgasDialog.tsx` | Seletor de sábados antes da geração |
| `FeriasFerias.tsx` | Melhorar coluna "Enviado" na tabela do contador |

Nenhuma migração de banco necessária.

