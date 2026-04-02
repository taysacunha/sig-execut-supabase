

## Plano: Trocar lista longa por seletores de Mes e Ano

### Problema

O campo "Atualizar vendas a partir de" usa um `Select` com 24 meses listados, gerando uma lista gigante e confusa.

### Correcao

Substituir o `Select` unico por dois selects lado a lado: um de **Mes** (Janeiro a Dezembro) e um de **Ano** (ultimos 3 anos). O valor final continua sendo montado como `yyyy-MM` para o `cascadeTeamFrom`.

### Alteracoes em `src/pages/vendas/SalesBrokers.tsx`

1. Trocar o estado `updateSalesFrom` (string `yyyy-MM`) por dois estados: `cascadeMonth` e `cascadeYear`, ou manter `updateSalesFrom` e compor ele a partir de dois selects separados
2. Substituir o bloco do `Select` (linhas 669-684) por dois selects:
   - **Ano**: anos de `currentYear - 2` ate `currentYear`
   - **Mes**: Janeiro a Dezembro (valores "01" a "12")
3. Adicionar opcao "Nao atualizar" como checkbox ou manter o comportamento: se ambos selecionados, monta `yyyy-MM`; se nao, `null`
4. Reusar o componente `YearMonthSelector` que ja existe em `src/components/vendas/YearMonthSelector.tsx` — ele aceita `selectedYear`, `selectedMonth`, `onYearChange`, `onMonthChange` e resolve exatamente esse caso

### Resultado

Dois selects compactos (Ano + Mes) em vez de uma lista de 24 itens.

