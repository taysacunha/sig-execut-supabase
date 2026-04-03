

## Plano: Campo de busca no seletor de corretor e VGV com valor completo

### Alteracoes em `src/components/vendas/BrokerIndividualReport.tsx`

**1. VGV com valor completo (linha 372-378)**

O `formatCurrency` usa `notation: "compact"`, que abrevia valores (ex: "R$ 1,2 mi" em vez de "R$ 1.200.000,00"). Remover essa opcao para exibir o valor completo com duas casas decimais no card VGV Total. Manter `formatCurrencyShort` para os graficos (labels curtos fazem sentido ali).

```typescript
// ANTES
notation: "compact",

// DEPOIS
minimumFractionDigits: 2,
maximumFractionDigits: 2,
```

Nota: o `formatCurrency` tambem e usado no eixo Y e tooltip dos graficos. Para evitar que os eixos fiquem com numeros muito longos, criar uma funcao separada `formatCurrencyFull` para o card, e manter `formatCurrency` com compact para graficos. Ou: usar `formatCurrencyFull` no card e tooltip, e manter compact no eixo Y.

Abordagem: renomear `formatCurrency` atual para `formatCurrencyCompact`, criar novo `formatCurrency` sem compact (valor completo), usar o completo no card e tooltip, e o compact no eixo Y.

**2. Campo de busca no seletor de corretor (linhas 490-502)**

Substituir o `Select` por um `Popover` + `Command` (padrao cmdk ja instalado no projeto em `src/components/ui/command.tsx`). Isso adiciona um campo de busca integrado ao dropdown, permitindo filtrar corretores por nome.

### Arquivo alterado

1. **`src/components/vendas/BrokerIndividualReport.tsx`**

