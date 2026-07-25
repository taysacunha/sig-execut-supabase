## Objetivo
Ajustar os papéis de Pessoas no módulo Despesas:
- Renomear "Loja" → "Empresa"
- Adicionar "Prestador de Serviço" e "Beneficiário"
- Ao marcar "Outro", exibir campo de texto para descrever o papel

## Mudanças

### 1. Banco (migration `db/migrations/20260803120000_despesas_pessoas_papeis_v2.sql`)
- Migrar dados: `UPDATE despesas_pessoas SET papeis = array_replace(papeis, 'loja', 'empresa')`.
- Recriar `despesas_pessoas_papeis_ck` com nova lista:
  `proprietario, inquilino, empresa, fornecedor, cliente, funcionario, motorista, corretor, prestador_servico, beneficiario, outro`.
- Adicionar coluna `papel_outro_descricao text` (nullable, max 120) para o texto livre quando "Outro" for marcado.

### 2. `src/hooks/useDespesasPessoas.ts`
- Atualizar `PapelPessoa`: trocar `"loja"` por `"empresa"`; adicionar `"prestador_servico"` e `"beneficiario"`.
- Atualizar `PAPEIS_PESSOA` com rótulos PT-BR: Empresa, Prestador de Serviço, Beneficiário.
- Incluir `papel_outro_descricao: string | null` em `Pessoa` e `PessoaInput`.
- `useSavePessoa`: se `papeis` não contém `"outro"`, salvar `papel_outro_descricao = null`.

### 3. `src/components/despesas/PessoaDialog.tsx`
- Ao marcar "Outro", exibir `Input` obrigatório (min 2 chars) logo abaixo do grid de checkboxes.
- Bloquear `podeSalvar` quando `papeis` inclui `"outro"` e descrição vazia.
- Preencher/limpar campo ao alternar o papel "Outro".

### 4. `src/pages/despesas/DespesasCadastros.tsx`
- Atualizar texto descritivo da aba (trocar "lojas" por "empresas") e badges já usam `labelPapel` — sem outra alteração.

### 5. Impacto verificado (sem outras mudanças necessárias)
- `ImovelDialog` usa apenas `"proprietario"` / `"inquilino"` — não afetado.
- `VeiculoDialog` usa `motorista`/`proprietario`/`comprador` — não afetado.
- Nenhuma referência a `"loja"` em edge functions, relatórios ou lançamentos.
- Tipos gerados (`supabase/types.ts`) são regenerados automaticamente após a migration.

## Ordem de execução
1. Rodar a migration no Supabase.
2. Aplicar as edições de código acima em paralelo.
