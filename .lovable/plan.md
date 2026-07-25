## Objetivo
CPF/CNPJ duplicado deixa de ser bloqueio. Ao salvar, se já existirem pessoas com o mesmo documento, mostrar aviso listando-as e pedir confirmação para prosseguir.

## Mudanças

### 1. Banco — nova migration `db/migrations/20260804130000_despesas_pessoas_cpf_cnpj_index.sql`
- **Não criar** índice único.
- Remover o índice único (se já tiver sido criado em ambiente algum): `DROP INDEX IF EXISTS public.idx_desp_pessoas_cpf_cnpj_unique;`
- Criar índice **não único** para acelerar a busca por duplicatas:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_desp_pessoas_cpf_cnpj
    ON public.despesas_pessoas (cpf_cnpj)
    WHERE cpf_cnpj IS NOT NULL;
  ```

### 2. Hook `src/hooks/useDespesasPessoas.ts`
- Remover o `throw` de duplicidade e o `translate` para 23505.
- Exportar helper `buscarPessoasPorCpfCnpj(cpfCnpj, excluirId?)` que retorna `Pick<Pessoa,"id"|"nome"|"papeis"|"is_active">[]` (inclui inativas, marcando quais).

### 3. Diálogo `src/components/despesas/PessoaDialog.tsx`
- Ao clicar em **Salvar** com CPF/CNPJ preenchido, chamar `buscarPessoasPorCpfCnpj`. Se retornar itens, abrir `AlertDialog` de confirmação com:
  - Título: "CPF/CNPJ já cadastrado"
  - Corpo: lista com nome, papéis e status (Ativa/Inativa) de cada pessoa encontrada.
  - Botões: "Cancelar" e "Salvar mesmo assim".
- Se o usuário confirmar, prosseguir com o `saveMut.mutateAsync`.
- Se não houver duplicatas, salvar direto (comportamento atual).

## Notas
- Uma única confirmação por tentativa — se o usuário confirmar e o salvamento falhar por outro motivo, o toast de erro atual cobre.
- Não altera diálogos de Imóvel/Veículo (não criam pessoas com documento).
- O índice não único mantém a consulta rápida mesmo com o cadastro crescendo.
