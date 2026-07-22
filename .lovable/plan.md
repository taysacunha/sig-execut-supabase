## Contexto

A tabela `despesas_pessoas` já existe na base (nome, tipo_pessoa, cpf_cnpj, oab, creci, papeis[], email, telefone, observacao, is_active) e é referenciada por Imóveis (`proprietario_id`, `inquilino_id`), Veículos (`motorista_id`, `proprietario_id`, `comprador_id`) e Lançamentos (`pessoa_id`). Mas a aba **Pessoas** em `/despesas/cadastros` só mostra um card de aviso — não existe UI para cadastrar. Por isso, ao abrir o diálogo de Imóvel, os comboboxes de Proprietário e Inquilino ficam vazios e o usuário não consegue "alocar" ninguém.

## Objetivo

1. Transformar a aba **Pessoas** num CRUD completo.
2. Modelar **papéis** de forma explícita e reutilizável (proprietário, inquilino, loja/fornecedor, cliente, funcionário, motorista, corretor, outro), permitindo múltiplos papéis por pessoa.
3. Fazer os seletores de Proprietário/Inquilino (e demais) filtrarem por papel, com atalho para cadastrar uma nova pessoa direto do diálogo do Imóvel.

## O que será construído

### 1. Backend (uma migration em `db/migrations/`)

- Padronizar o vocabulário de `despesas_pessoas.papeis` (array de text) com um CHECK controlado:
  - Valores aceitos: `proprietario`, `inquilino`, `loja`, `fornecedor`, `cliente`, `funcionario`, `motorista`, `corretor`, `outro`.
- Índice GIN em `papeis` para busca rápida por papel.
- Trigger `updated_at`.
- Confirmar/ajustar policies existentes (view liberada às abas cadastros/calendario/repasses/imoveis; edit exige `cadastros` edit).
- **Não** exigir CPF/CNPJ único (permitir nulo e evitar bloqueios); apenas normalizar (remover máscara) via trigger opcional.

### 2. Hook novo — `src/hooks/useDespesasPessoas.ts`

- Types: `Pessoa`, `PessoaInput`, `PapelPessoa`.
- `usePessoas({ papel?, busca?, apenasAtivas? })` — lista com filtro por papel via `.contains("papeis", [papel])` e busca ilike em nome/cpf_cnpj.
- `useSavePessoa()` (insert/update).
- `useDeletePessoa()` (soft-delete via `is_active=false`; bloqueia se estiver referenciada em imóveis/veículos/lançamentos → tratar erro FK com mensagem amigável).

### 3. UI da aba Pessoas — `PessoasTab` em `DespesasCadastros.tsx`

- Tabela com: Nome, Tipo (PF/PJ), CPF/CNPJ, Papéis (badges), Contato, Ações.
- Barra superior: busca por nome/documento, filtro por papel (multi), botão "Nova pessoa".
- `PessoaDialog` (novo componente `src/components/despesas/PessoaDialog.tsx`) com:
  - Nome*, Tipo (Física/Jurídica), CPF/CNPJ (com máscara), OAB, CRECI, Email, Telefone.
  - **Papéis** como grupo de checkboxes (multi-seleção) — obrigatório ao menos um.
  - Observação.
- AlertDialog para confirmar exclusão/desativação (padrão do projeto).

### 4. Diálogo de Imóvel — ajustes em `ImovelDialog.tsx`

- Filtrar `pessoas` do combobox de **Proprietário** por papel `proprietario` e **Inquilino** por papel `inquilino` (usar `usePessoas({ papel })`).
- Ordenar por nome e mostrar CPF/CNPJ ao lado no label (`João Silva — 123.456.789-00`) para diferenciar homônimos.
- Botão "+ Nova pessoa" ao lado de cada combobox, abrindo o `PessoaDialog` já com o papel pré-marcado; ao salvar, refetch e auto-selecionar a pessoa criada.
- Se o registro editado tem `proprietario_id`/`inquilino_id` cujo papel não bate mais (ex.: papel removido), exibir alerta discreto e ainda permitir manter a seleção atual.

### 5. Aproveitar em outros pontos

- `LancamentoDialog` já usa `pessoas` via `useDespesasLookups`; adicionar botão "+ Nova pessoa" no combobox e continuar mostrando todas (qualquer papel).
- `VeiculoDialog`: filtrar por papéis `motorista`, `proprietario`, `cliente` conforme o campo.

### 6. Ajuda

- Atualizar `DespesasHelp.tsx`: seção "Pessoas" explicando papéis e como isso alimenta os demais cadastros.

## Detalhes técnicos

- Papéis vivem em coluna `text[]` (não criar tabela auxiliar) — simples e suficiente. Consulta: `.contains("papeis", ["proprietario"])`.
- Nenhum breaking change em FKs — apenas passamos a preencher a tabela.
- Sem alteração de RLS além do CHECK/índice.
- Confirmações destrutivas via `AlertDialog` (memória do projeto).
- Timers/debounce continuam com `ReturnType<typeof setTimeout>`.

## Fora do escopo (para depois)

- Endereço completo por pessoa.
- Histórico de troca de inquilino no imóvel (já existe `despesas_imovel_situacao_historico`; ligação com pessoa fica para próxima etapa).
- Importação em lote de pessoas.
