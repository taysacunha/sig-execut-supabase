## Problema

A migration `20260730120000_despesas_centros_permitidos_deny_default.sql` falha porque referencia `c.ativo`, mas a coluna real em `public.despesas_centros_custo` é `is_active` (confirmado em `src/hooks/useDespesasLancamentos.ts` linha 311 e `src/pages/despesas/DespesasCadastros.tsx`).

## Correção

Editar a migration substituindo as duas ocorrências de `c.ativo = true` por `c.is_active = true`:

- Linha 24: filtro do ramo super_admin
- Linha 32: filtro do ramo com grants explícitos

Depois o usuário reexecuta a migration no SQL Editor.