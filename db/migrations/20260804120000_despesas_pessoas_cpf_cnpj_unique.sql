-- Impede CPF/CNPJ duplicado entre pessoas ativas em despesas_pessoas.
DO $$
DECLARE
  v_dup integer;
BEGIN
  SELECT count(*) INTO v_dup
    FROM (
      SELECT cpf_cnpj
        FROM public.despesas_pessoas
       WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '' AND is_active = true
       GROUP BY cpf_cnpj
      HAVING count(*) > 1
    ) d;
  IF v_dup > 0 THEN
    RAISE NOTICE 'Existem % CPF/CNPJ duplicados entre pessoas ativas. Limpe antes de aplicar o índice.', v_dup;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desp_pessoas_cpf_cnpj_unique
  ON public.despesas_pessoas (cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND is_active = true;
