## Correção da migration de recebimento

O erro `function min(uuid) does not exist` ocorre porque Postgres não tem `MIN()` para tipo uuid. Vou trocar o backfill por `DISTINCT ON` para pegar o primeiro `recebido_por_user_id` por solicitação sem precisar agregar uuid.

### Alteração em `db/migrations/20260625140000_estoque_solicitacao_recebimento_state.sql`

Substituir o subselect do backfill por:

```sql
UPDATE public.estoque_solicitacoes s
   SET recebimento_confirmado_em = sub.recebido_em,
       recebimento_confirmado_por_user_id = sub.recebido_por_user_id
  FROM (
    SELECT DISTINCT ON (solicitacao_id)
           solicitacao_id,
           recebido_em,
           recebido_por_user_id
      FROM public.estoque_movimentacoes
     WHERE recebido_em IS NOT NULL
       AND solicitacao_id IS NOT NULL
     ORDER BY solicitacao_id, recebido_em ASC
  ) sub
 WHERE sub.solicitacao_id = s.id
   AND s.recebimento_confirmado_em IS NULL;
```

Restante da migration (colunas, RPC, GRANT) permanece igual. Depois é só reexecutar no SQL Editor.