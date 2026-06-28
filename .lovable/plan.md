# Correção: gráficos mostrando mês anterior

## Causa

Em `src/pages/vendas/VendasDashboard.tsx`, os rótulos dos meses dos gráficos (Evolução do VGV, Quantidade de Vendas, Evolução de Propostas) são gerados com:

```ts
format(new Date(month + "-01"), "MMM/yy", { locale: ptBR })
```

`new Date("2026-05-01")` é interpretado como **UTC meia-noite**. No fuso de Brasília (UTC-3), isso vira **30/abril 21:00 local**, e `format` (que usa horário local) imprime "abr" em vez de "mai". Por isso o último ponto do gráfico aparece como abril mesmo quando o usuário selecionou maio.

## Correção

Substituir as duas ocorrências de `new Date(month + "-01")` (linhas 176 e 203) por um parse explícito sem deslocamento de fuso, usando o `parse` do date-fns já importado:

```ts
month: format(
  parse(month, "yyyy-MM", new Date()),
  selectedMonth === null ? "MMM" : "MMM/yy",
  { locale: ptBR }
),
```

Aplicar nos dois `useQuery`:
- `monthlyEvolution` (VGV e quantidade de vendas)
- `proposalsEvolution` (propostas)

## Arquivos

- `src/pages/vendas/VendasDashboard.tsx` — apenas as duas linhas dos rótulos.

Nenhuma mudança de query/banco é necessária — os dados já vêm corretos por `year_month`; apenas o label estava deslocado.
