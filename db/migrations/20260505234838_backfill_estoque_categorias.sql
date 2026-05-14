-- Importa categorias-texto existentes para estoque_categorias e vincula categoria_id

INSERT INTO public.estoque_categorias (nome, is_active)
SELECT DISTINCT btrim(m.categoria), true
FROM public.estoque_materiais m
WHERE m.categoria IS NOT NULL
  AND btrim(m.categoria) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.estoque_categorias c
    WHERE lower(c.nome) = lower(btrim(m.categoria))
  );

UPDATE public.estoque_materiais m
SET categoria_id = c.id
FROM public.estoque_categorias c
WHERE m.categoria_id IS NULL
  AND m.categoria IS NOT NULL
  AND lower(c.nome) = lower(btrim(m.categoria));
