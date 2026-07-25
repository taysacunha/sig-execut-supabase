-- Renomeia papel "loja" para "empresa", adiciona "prestador_servico" e "beneficiario",
-- e cria coluna papel_outro_descricao para o texto livre quando "outro" for marcado.

UPDATE public.despesas_pessoas
   SET papeis = array_replace(papeis, 'loja', 'empresa')
 WHERE 'loja' = ANY(papeis);

ALTER TABLE public.despesas_pessoas
  DROP CONSTRAINT IF EXISTS despesas_pessoas_papeis_ck;

ALTER TABLE public.despesas_pessoas
  ADD CONSTRAINT despesas_pessoas_papeis_ck CHECK (
    papeis <@ ARRAY[
      'proprietario','inquilino','empresa','fornecedor','cliente',
      'funcionario','motorista','corretor','prestador_servico',
      'beneficiario','outro'
    ]::text[]
  );

ALTER TABLE public.despesas_pessoas
  ADD COLUMN IF NOT EXISTS papel_outro_descricao text;

ALTER TABLE public.despesas_pessoas
  DROP CONSTRAINT IF EXISTS despesas_pessoas_papel_outro_len_ck;

ALTER TABLE public.despesas_pessoas
  ADD CONSTRAINT despesas_pessoas_papel_outro_len_ck CHECK (
    papel_outro_descricao IS NULL OR char_length(papel_outro_descricao) <= 120
  );