-- Adiciona categoria à placa e torna o código opcional (atribuído na entrada/saída).

ALTER TABLE public.estoque_placas
  ADD COLUMN IF NOT EXISTS categoria_id uuid
  REFERENCES public.estoque_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS estoque_placas_categoria_id_idx
  ON public.estoque_placas (categoria_id);

-- Permite cadastrar placa sem código (será atribuído na entrada/saída em /estoque/placas).
ALTER TABLE public.estoque_placas
  ALTER COLUMN codigo DROP NOT NULL;

-- Substitui o UNIQUE total por UNIQUE parcial (apenas quando codigo IS NOT NULL).
ALTER TABLE public.estoque_placas
  DROP CONSTRAINT IF EXISTS estoque_placas_codigo_key;

DROP INDEX IF EXISTS public.estoque_placas_codigo_key;
DROP INDEX IF EXISTS public.estoque_placas_codigo_unique;

CREATE UNIQUE INDEX estoque_placas_codigo_unique
  ON public.estoque_placas (codigo)
  WHERE codigo IS NOT NULL;