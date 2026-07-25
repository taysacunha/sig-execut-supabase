## Objetivo

No diálogo de Repasse, permitir informar **quem recebe o valor líquido** (um ou mais beneficiários, PF ou PJ — inclusive o próprio proprietário) e exibir os **inquilinos** vinculados aos imóveis do proprietário na competência (leitura).

## Mudanças

### 1) Modelo de dados

Nova migration `db/migrations/20260808120000_despesas_repasse_beneficiarios.sql`:

- Nova tabela `public.despesas_repasse_beneficiarios`
  - `id uuid pk`
  - `repasse_id uuid not null → despesas_repasses(id) on delete cascade`
  - `pessoa_id uuid not null → despesas_pessoas(id) on delete restrict`
  - `valor numeric(14,2) not null check (valor >= 0)`
  - `ordem int not null default 1`
  - `observacao text`
  - `created_at/updated_at`
  - `unique (repasse_id, pessoa_id)`
- GRANTs (authenticated/service_role) + RLS espelhando as políticas de `despesas_repasse_itens` (via `despesas_pode_*_aba('repasses')`).
- Descontinuar `despesas_repasses.valor_limite_primeiro`: manter a coluna por compatibilidade, mas remover do UI (sem drop nesta fase).
- Trigger de validação: soma dos beneficiários ≤ `valor_liquido` do repasse (não obrigar igualdade — permite repasse parcial em análise). Bloquear inclusão/edição quando `status ∈ ('pago','cancelado')`.

### 2) Hook `useDespesasRepasses.ts`

- Tipar `RepasseBeneficiario` e incluir `beneficiarios:despesas_repasse_beneficiarios(*, pessoa:despesas_pessoas(nome,tipo_pessoa,cpf_cnpj))` no select do `useRepasses`.
- Novos hooks: `useSaveRepasseBeneficiario`, `useDeleteRepasseBeneficiario`.
- Novo hook auxiliar `useRepasseInquilinos(repasseId)`: busca imóveis do `proprietario_id` (via `despesas_imoveis`) e faz join com `inquilino:despesas_pessoas(nome,tipo_pessoa,cpf_cnpj)`; retorna lista agrupada por imóvel.
- Remover `useUpdateRepasseCampos` do fluxo do limite (manter função caso já usada em outro lugar).

### 3) `src/components/despesas/RepasseDialog.tsx`

- **Remover** o bloco "Valor limite ao 1º beneficiário".
- Nova seção **Beneficiários** (editável enquanto `status === 'aberto'`):
  - Tabela com colunas: Ordem, Pessoa (nome + PF/PJ + CPF/CNPJ), Valor, Observação, Ações (remover).
  - Rodapé com indicador: "Distribuído: R$ X / Líquido: R$ Y — Restante: R$ Z" (verde se ≥ 0, vermelho se estourou).
  - Formulário de adição: Combobox de pessoa (busca todas as pessoas ativas, ordenando por papel `beneficiario` + `proprietario`), input de valor, input de observação, botão "+" e botão "Usar restante" que preenche o campo valor com o saldo remanescente.
  - Nenhum beneficiário criado automaticamente (modo manual).
  - Ao marcar como **pago**, validar que soma dos beneficiários > 0 e ≤ líquido; caso vazio, exibir toast pedindo definição antes de baixar.
- Nova seção **Inquilinos vinculados** (somente leitura), colapsável:
  - Lista agrupada por imóvel: `Código — Endereço` → `Inquilino: Nome (PF/PJ, CPF/CNPJ)` ou "Sem inquilino".
  - Rodapé discreto: "Para alterar, edite o cadastro do imóvel."

### 4) Sem mudanças em

- `despesas_montar_repasse` (RPC continua montando créditos/débitos por imóvel).
- Cadastro de Pessoas / Imóveis.

## Detalhes técnicos

- Combobox de pessoas reutiliza `ComboboxSelect` existente + `usePessoas` (sem filtro fixo de papel, para permitir proprietário/beneficiário/qualquer PJ).
- Tipagem: `beneficiarios?: RepasseBeneficiario[]` no `Repasse`.
- Invalidations: `[REPASSES_KEY]` após CRUD de beneficiários.
- Auditoria: trigger genérica já cobre alterações em novas tabelas via `despesas_audit_gaps` — confirmar e, se necessário, incluir a nova tabela no set auditado dentro da mesma migration.

## Tem que está no escopo

- Rateio percentual, split automático entre múltiplos beneficiários e geração de múltiplos lançamentos de pagamento (hoje o repasse gera 1 lançamento único ao ser marcado como pago — mantém o comportamento; posso trazer em fase seguinte se precisar dividir a baixa por beneficiário).

Múltiplos beneficiários e geração disso tem que existir. Não penso em automático, mas aglo que o usuário verifique o que foi criado e execute a ação. Dar também a opção de fazer ajustes ou exclusões de lançamentos. Veja isso para uma próxima fase. 