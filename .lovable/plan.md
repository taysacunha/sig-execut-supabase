## Problema

O Postgres rejeitou as policies porque `public.despesas_centros_permitidos(auth.uid())` é uma função *set-returning* (retorna `SETOF uuid`), e desde a Fase 1 usamos ela com `= ANY(...)`. Dentro de expressões de policy o planejador não aceita SRFs nessa posição — daí o erro `0A000: set-returning functions are not allowed in policy expressions`.

## Correção

Trocar, em todas as 8 policies criadas na migration da Fase 2, o padrão:

```sql
centro_custo_id = ANY (public.despesas_centros_permitidos(auth.uid()))
```

por uma subquery escalar equivalente:

```sql
centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
```

Isso vale para:
- `desp_lanc_select` / `desp_lanc_insert` / `desp_lanc_update` (USING e WITH CHECK) / `desp_lanc_delete`
- `desp_pag_select` / `desp_pag_insert` / `desp_pag_update` (USING e WITH CHECK) / `desp_pag_delete` (dentro do EXISTS, referenciando `l.centro_custo_id`)

Nenhuma regra de negócio muda — apenas a forma de invocar a função. O restante da migration (tabelas, GRANTs, triggers de recálculo, auditoria) permanece igual.

## Passos

1. Editar `db/migrations/20260717120000_despesas_fase2_lancamentos.sql` aplicando a substituição nas 8 policies.
2. Você roda novamente a migration no SQL Editor do Supabase.

Se preferir, posso também alterar `despesas_centros_permitidos` para retornar `uuid[]` (array) em vez de `SETOF uuid`, mas isso mexeria em código da Fase 1 já validado — recomendo manter a correção localizada nas policies.
