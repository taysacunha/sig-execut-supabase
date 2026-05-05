## Problema

A migration de backfill falhou porque o `SELECT DISTINCT btrim(m.categoria)` deduplica pelo texto bruto, mas o índice único é em `lower(nome)`. Existem registros como "Material de Expediente" e "material de expediente" que passam o DISTINCT mas colidem na inserção.

## Correção

Substituir a migration `20260505234838_backfill_estoque_categorias.sql` por uma versão que:

1. Deduplica pelo `lower(btrim(...))` antes do INSERT, escolhendo um nome canônico (primeiro via `MIN`).
2. Adiciona `ON CONFLICT DO NOTHING` como salvaguarda extra.
3. Mantém o UPDATE que vincula `categoria_id` por match case-insensitive (inalterado).

### SQL ajustado

```sql
INSERT INTO public.estoque_categorias (nome, is_active)
SELECT nome_canonico, true
FROM (
  SELECT MIN(btrim(m.categoria)) AS nome_canonico,
         lower(btrim(m.categoria)) AS chave
  FROM public.estoque_materiais m
  WHERE m.categoria IS NOT NULL AND btrim(m.categoria) <> ''
  GROUP BY lower(btrim(m.categoria))
) src
WHERE NOT EXISTS (
  SELECT 1 FROM public.estoque_categorias c
  WHERE lower(c.nome) = src.chave
)
ON CONFLICT DO NOTHING;

UPDATE public.estoque_materiais m
SET categoria_id = c.id
FROM public.estoque_categorias c
WHERE m.categoria_id IS NULL
  AND m.categoria IS NOT NULL
  AND lower(c.nome) = lower(btrim(m.categoria));
```

## Passos

1. Reescrever `supabase/migrations/20260505234838_backfill_estoque_categorias.sql` com o SQL acima.
2. Você executa a migration no SQL Editor.
3. Verificar em `/estoque/categorias` e `/estoque/materiais` se categorias e vínculos voltaram.