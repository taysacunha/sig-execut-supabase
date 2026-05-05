-- Backfill corrigido: deduplica por lower(btrim(...)) antes do INSERT

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
