## Objetivo

No diálogo "Novo lançamento" (a pagar/a receber), logo abaixo do campo **Descrição**, o usuário escolherá um **tipo de referência** e informará o valor correspondente:

- **Nº de Pasta** — numérico
- **Cód. Venda** — numérico
- **Imóvel** — numérico
- **Pessoa** — seleção da lista de pessoas cadastradas

Apenas um tipo por lançamento. A referência aparece nas listagens/relatórios como contexto do lançamento.

## Mudanças

### 1. Banco (`db/migrations/20260729120000_despesas_lancamento_referencia.sql`)

- Criar enum `despesa_referencia_tipo` com valores `pasta`, `venda`, `imovel`, `pessoa`.
- Adicionar em `despesas_lancamentos`:
  - `referencia_tipo despesa_referencia_tipo NULL`
  - `referencia_numero text NULL` (armazena o valor numérico como texto p/ preservar zeros à esquerda)
- Reaproveitar `pessoa_id` já existente quando `referencia_tipo = 'pessoa'`.
- Constraint de consistência:
  - se `referencia_tipo = 'pessoa'` → `pessoa_id NOT NULL` e `referencia_numero NULL`
  - se `referencia_tipo` em (`pasta`,`venda`,`imovel`) → `referencia_numero` obrigatório (`~ '^[0-9]+$'`) e `pessoa_id NULL`
  - se `referencia_tipo` NULL → ambos NULL (compatibilidade retroativa).
- Propagar as mesmas colunas em `despesas_recorrencias` para que ocorrências geradas herdem a referência.
- Índice `(referencia_tipo, referencia_numero)` e manter `(pessoa_id)`.

### 2. UI — `src/components/despesas/LancamentoDialog.tsx`

- Remover o Select "Pessoa" isolado.
- Adicionar bloco **Referência** logo abaixo de Descrição (ocupa `md:col-span-2`) com:
  - Toggle/Select "Tipo de referência" (Nenhuma / Nº Pasta / Cód. Venda / Imóvel / Pessoa).
  - Campo condicional: `Input type="number"` (Pasta/Venda/Imóvel) OU Select de pessoas (Pessoa).
- Validação: se um tipo é escolhido, valor obrigatório e ≥ 0 (numérico) ou pessoa selecionada.
- Enviar `referencia_tipo`, `referencia_numero`, `pessoa_id` corretos ao salvar; ao editar, hidratar o estado a partir dos campos existentes.

### 3. Hooks / listagens

- `src/hooks/useDespesasLancamentos.ts`: incluir `referencia_tipo`/`referencia_numero` em `Lancamento`, `LancamentoInput`, no `select` e no `insert/update`. Manter filtro `pessoaId` inalterado.
- `src/hooks/useDespesasRecorrencias.ts`: propagar os novos campos na criação e nas ocorrências geradas.
- `src/pages/despesas/DespesasCalendario.tsx` (linha do lançamento) e `DespesasRelatorios.tsx`: mostrar rótulo curto (ex.: `Pasta 1234`, `Venda 987`, `Imóvel 55`, `Pessoa: Fulano`).

### 4. Ajuda

- `src/pages/despesas/DespesasHelp.tsx`: parágrafo curto explicando a referência (para que serve, quando usar cada tipo).

## Sem impacto

- Regras de RLS, credenciais, pagamentos e permissões permanecem iguais.
- Lançamentos antigos ficam com `referencia_tipo = NULL` — nada quebra.

## Detalhes técnicos

- Validação do input numérico só aceita dígitos (regex client-side + `pattern="[0-9]*"`).
- Ao mudar o tipo, limpar o valor anterior para não persistir campo do tipo errado.
- Cast em TypeScript: adicionar `DespesaReferenciaTipo = 'pasta' | 'venda' | 'imovel' | 'pessoa'`.

## Pergunta pendente

Deseja que o campo **Imóvel** seja um número livre (como Pasta/Venda) ou um **select vinculado à tabela `despesas_imoveis**` já existente? Se preferir vínculo, ajusto o plano para usar `imovel_id` (FK) em vez de número. Select vinculado à tabela despesas_imóveis já existente.