-- CPF/CNPJ pode se repetir (variações fiscais). Remove índice único e mantém apenas índice de busca.
DROP INDEX IF EXISTS public.idx_desp_pessoas_cpf_cnpj_unique;

CREATE INDEX IF NOT EXISTS idx_desp_pessoas_cpf_cnpj
  ON public.despesas_pessoas (cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL;
