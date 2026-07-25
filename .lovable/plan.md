## Objetivo
Impedir cadastro duplicado de CPF/CNPJ na aba Pessoas do módulo Despesas, retornando mensagem clara ao usuário.

## Mudanças

### 1. Banco — migration `db/migrations/20260804120000_despesas_pessoas_cpf_cnpj_unique.sql`
- Detectar duplicatas existentes (informar via `RAISE NOTICE`, sem bloquear) — se houver, a criação do índice falhará; nesse caso o usuário limpa antes.
- Criar índice único parcial:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_desp_pessoas_cpf_cnpj_unique
    ON public.despesas_pessoas (cpf_cnpj)
    WHERE cpf_cnpj IS NOT NULL AND is_active = true;
  ```
  Restrito a ativos para não travar quando uma pessoa for desativada e recadastrada.

### 2. Hook `src/hooks/useDespesasPessoas.ts`
No `useSavePessoa`, antes do insert/update, checar se já existe outra pessoa ativa com o mesmo `cpf_cnpj` normalizado:
- Query: `select id, nome from despesas_pessoas where cpf_cnpj = ? and is_active = true` (excluindo `id` atual em edição).
- Se encontrar, lançar `Error("Já existe uma pessoa ativa cadastrada com este CPF/CNPJ: <nome>.")`.
- Fallback: se o insert falhar com código Postgres `23505` (unique violation), traduzir a mensagem para PT-BR amigável.

### 3. UI `src/components/despesas/PessoaDialog.tsx`
O erro é exibido pelo `toast.error(e?.message)` já existente — nenhuma mudança estrutural, apenas garantir que a mensagem lançada seja clara.

## Notas
- Não há alteração em outros diálogos (Imóvel/Veículo) porque eles apenas selecionam pessoas existentes.
- Validação em duas camadas (app + índice único) garante integridade mesmo em concorrência.
