

## Plano: Corrigir troca de equipe retroativa e acesso a exclusao de vendas

### Problema 1: Flavia mudou de equipe mas vendas antigas ficaram com a equipe errada

Quando o `team_id` de um corretor e atualizado em `SalesBrokers.tsx`, apenas o registro do corretor muda. As vendas ja cadastradas na tabela `sales` mantem o `team_id` antigo. Nao existe cascateamento.

**Correcao em `src/pages/vendas/SalesBrokers.tsx`**: No `updateMutation`, quando o `team_id` mudar, atualizar tambem todas as vendas do corretor a partir de uma data configuravel. Adicionar ao dialog de edicao um campo opcional "Atualizar vendas a partir de" (tipo mes/ano) que aparece quando o usuario troca a equipe. Se preenchido, executa:

```typescript
await supabase.from("sales")
  .update({ team_id: newTeamId })
  .eq("broker_id", id)
  .gte("year_month", selectedFromMonth); // ex: "2026-01"
```

Isso resolve o caso da Flavia: ao trocar para "Mar", o usuario seleciona "Janeiro 2026" e todas as vendas de janeiro em diante sao migradas.

### Problema 2: Nao consegue excluir vendas

O botao de excluir JA EXISTE no codigo (linha 600-608 de `Sales.tsx`), mas esta restrito a `isAdmin`. O usuario provavelmente tem permissao `canEditVendas` mas nao e admin.

**Correcao em `src/pages/vendas/Sales.tsx`**: Trocar a condicao do botao de excluir de `isAdmin` para `canEditVendas`, mantendo o AlertDialog de confirmacao que ja existe. A logica de exclusao (deleteMutation) ja funciona corretamente.

```typescript
// ANTES (linha 600):
{isAdmin && (
// DEPOIS:
{canEditVendas && (
```

### Arquivos alterados

1. **`src/pages/vendas/SalesBrokers.tsx`** — Adicionar campo "Atualizar vendas a partir de" no dialog de edicao quando equipe mudar; no `updateMutation`, cascatear `team_id` para tabela `sales`
2. **`src/pages/vendas/Sales.tsx`** — Trocar `isAdmin` por `canEditVendas` no botao de excluir venda

