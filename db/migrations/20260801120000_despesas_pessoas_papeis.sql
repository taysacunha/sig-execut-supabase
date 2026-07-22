-- Padroniza vocabulário dos papéis em despesas_pessoas e adiciona índice de busca.
-- Papéis aceitos: proprietario, inquilino, loja, fornecedor, cliente,
-- funcionario, motorista, corretor, outro.

-- Normaliza registros antigos (remove nulos/duplicados/vazios do array).
UPDATE public.despesas_pessoas
   SET papeis = COALESCE(
     (SELECT array_agg(DISTINCT p) FROM unnest(papeis) p WHERE p IS NOT NULL AND p <> ''),
     '{}'::text[]
   )
 WHERE papeis IS NOT NULL;

ALTER TABLE public.despesas_pessoas
  DROP CONSTRAINT IF EXISTS despesas_pessoas_papeis_ck;

ALTER TABLE public.despesas_pessoas
  ADD CONSTRAINT despesas_pessoas_papeis_ck CHECK (
    papeis <@ ARRAY[
      'proprietario','inquilino','loja','fornecedor','cliente',
      'funcionario','motorista','corretor','outro'
    ]::text[]
  );

CREATE INDEX IF NOT EXISTS idx_desp_pessoas_papeis
  ON public.despesas_pessoas USING GIN (papeis);

CREATE INDEX IF NOT EXISTS idx_desp_pessoas_nome_lower
  ON public.despesas_pessoas (lower(nome));