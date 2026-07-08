## Correção da migration de atributos de placa

O erro `set-returning functions are not allowed in UPDATE` vem de `regexp_matches(...)` no `SET`, pois essa função retorna um conjunto. A correção é trocar por `substring(nome from '<regex>')`, que retorna um único texto (o primeiro grupo capturado) e pode ser usado em `UPDATE`.

### Alteração no arquivo

`db/migrations/20260708120000_estoque_materiais_placa_atributos.sql` — substituir o último `UPDATE` (linhas 47-55) por:

```sql
UPDATE public.estoque_materiais
SET tamanho_outro = trim(substring(
      nome from '([0-9]+(?:[,.][0-9]+)?\s*[xX]\s*[0-9]+(?:[,.][0-9]+)?)'
    ))
WHERE is_placa = true
  AND tamanho = 'outro'
  AND tamanho_outro IS NULL
  AND nome ~ '([0-9]+(?:[,.][0-9]+)?\s*[xX]\s*[0-9]+(?:[,.][0-9]+)?)';
```

Nenhuma outra parte da migration muda. Após aplicar, reexecute o arquivo no SQL Editor do Supabase.
