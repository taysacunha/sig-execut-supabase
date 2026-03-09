

## Plano - 4 Correções

### 1. Dialog de corretores quebrado (sem scroll)

**Problema:** O `DialogContent` em `SalesBrokers.tsx` (linha 473) não tem limite de altura. Com os novos campos CRECI e Nome de Exibição, o conteúdo ultrapassa a viewport e os botões Cancelar/Salvar ficam inacessíveis.

**Solução:** Adicionar `className="max-w-lg max-h-[90vh] overflow-y-auto"` ao `DialogContent` (linha 473). O `DialogFooter` (linha 638) receberá `className="sticky bottom-0 bg-background pt-4 border-t"` para ficar sempre visível.

**Arquivo:** `src/pages/vendas/SalesBrokers.tsx` (linhas 473, 638)

---

### 2. Relatório Corretores Vendas - dados de meses sem cadastro

**Problema:** No modo mensal, o `months` (linha 200-224) inclui o mês anterior para "contexto de evolução". Os totais (linhas 400-409) e queries de `saleDetails`, `proposalsData`, `leadsData`, `evaluationsData` usam esse array completo, então dados do mês anterior "vazam" para o mês selecionado.

**Solução:** Criar um `reportMonths` separado que contém apenas o mês selecionado (sem o anterior). Usar `reportMonths` para calcular totais e buscar `saleDetails`. Manter `months` completo apenas para os gráficos de evolução (`salesData`, `proposalsData`, `leadsData`, `evaluationsData` nos charts).

Concretamente:
- Adicionar `const reportMonths = periodType === "month" ? [months[months.length - 1]] : months;`
- Alterar `totalVGV`, `totalSales` para somar apenas entries cujo `month` esteja em `reportMonths`
- Alterar `totalProposals`, `totalConverted`, `totalLeads`, `totalLeadsActive`, `totalVisits`, `avgScore` idem
- Alterar query de `saleDetails` para usar `reportMonths` no `.in("year_month", ...)`

**Arquivo:** `src/components/vendas/BrokerIndividualReport.tsx` (linhas ~200, 384-409)

---

### 3. Divs de vendas/avaliação não aparecem no PDF

**Problema:** `hidden print:block` (linhas 713, 753) funciona com `window.print()` mas **não** com `html2canvas`, que captura o estado visual atual do DOM. Os elementos ficam `display:none` durante a captura.

**Solução:** Usar o estado `isExporting` (já existe, linha 192) para controlar visibilidade:
- Trocar `className="hidden print:block"` por renderização condicional: `{isExporting && saleDetails.length > 0 && (<Card>...</Card>)}`
- No `handleExportPDF` (linha 428), o `setIsExporting(true)` já é chamado antes do `html2canvas`. Adicionar um `await new Promise(r => setTimeout(r, 100))` entre o `setIsExporting(true)` e o `html2canvas` para dar tempo ao React de renderizar os blocos.

**Arquivo:** `src/components/vendas/BrokerIndividualReport.tsx` (linhas 711-755, 434-436)

---

### 4. Ajuste de qualidade - acessibilidade do dialog

**Identificado:** O `DialogContent` de corretores já tem `DialogDescription`, então está ok. Verificar se outros dialogs do mesmo arquivo têm `DialogDescription` para evitar warnings no console.

**Arquivo:** `src/pages/vendas/SalesBrokers.tsx`

---

### Resumo

| Arquivo | Alteração |
|---------|-----------|
| `SalesBrokers.tsx` | Scroll + footer sticky no dialog |
| `BrokerIndividualReport.tsx` | `reportMonths` para totais, renderização condicional por `isExporting` |

