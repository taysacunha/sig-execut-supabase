## Objetivo

Adicionar ao módulo de Estoque uma gestão completa de **placas físicas** com rastreabilidade unitária por código, controle de instalação em imóveis, registro de perda/roubo (afetando o saldo), reposição com mesmo código (gerando nova versão), histórico por placa e exportação em PDF no mesmo padrão dos relatórios de Afastamentos / Perdas de Folga.

---

## 1. Modelo de dados (migrations)

### Tabela `estoque_placas` (uma linha = uma placa física rastreável)


| Campo                                    | Tipo                            | Observação                                                                 |
| ---------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `id`                                     | uuid PK                         | &nbsp;                                                                     |
| `codigo`                                 | text                            | Código da placa (ex.: "P-1234")                                            |
| `versao`                                 | int                             | 1 por padrão; incrementa quando o código é reusado                         |
| `material_id`                            | uuid FK → `estoque_materiais`   | Material genérico "Placa"                                                  |
| `tipo_uso`                               | text                            | `venda` ou `aluga`                                                         |
| `tamanho`                                | text                            | `1x1`, `2x2`, `outro`                                                      |
| `tamanho_outro`                          | text null                       | quando `tamanho = outro`                                                   |
| `local_armazenamento_id`                 | uuid FK                         | onde a placa está fisicamente quando disponível                            |
| `status`                                 | text                            | `disponivel`, `instalada`, `roubada`, `perdida`, `baixada`                 |
| `imovel_codigo_atual`                    | text null                       | preenchido quando `instalada`                                              |
| `data_instalacao_atual`                  | date null                       | &nbsp;                                                                     |
| `observacoes`                            | text null                       | &nbsp;                                                                     |
| `substitui_placa_id`                     | uuid null FK → `estoque_placas` | a placa anterior (mesma `codigo`, versão anterior) que foi roubada/perdida |
| `created_at`, `updated_at`, `created_by` | &nbsp;                          | &nbsp;                                                                     |


Restrição: `UNIQUE (codigo, versao)`. Apenas **uma versão "ativa"** (status ≠ `baixada/roubada/perdida`) por `codigo` por vez — garantido por índice parcial único.

### Tabela `estoque_placas_historico` (uma linha por movimento de uma placa)


| Campo                   | Tipo                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `id`                    | uuid PK                                                                            |
| `placa_id`              | uuid FK → `estoque_placas`                                                         |
| `tipo`                  | text → `instalacao`, `retirada`, `roubo`, `perda`, `criacao`, `reposicao`, `baixa` |
| `imovel_codigo`         | text null                                                                          |
| `data_evento`           | date                                                                               |
| `data_retorno`          | date null (preenchida quando uma instalação é finalizada)                          |
| `observacoes`           | text null                                                                          |
| `user_id`, `created_at` | &nbsp;                                                                             |


Para o histórico "saiu / voltou": cada instalação cria uma linha `instalacao` com `data_evento`; a retirada **atualiza** essa linha preenchendo `data_retorno` (e cria também uma linha `retirada` separada para o log cronológico). Assim a UI consegue mostrar facilmente "imóvel X — saiu 10/01 — voltou 25/02".

### Saldo de placas

- O **saldo de placas disponíveis** é calculado dinamicamente: `COUNT(*) WHERE status='disponivel'` agrupado por `local_armazenamento_id`, `tipo_uso`, `tamanho`.
- Quando uma placa muda de status (instalada, roubada, perdida) → o saldo cai automaticamente.
- Para manter a página **Saldos de Estoque** consistente, também atualizamos o registro em `estoque_saldos` do material "Placa" via trigger que recalcula `quantidade = COUNT placas disponíveis` por local. Isso preserva o histórico de movimentações que já existe.

### Trigger de movimentação

A cada mudança relevante (instalação/retirada/roubo/perda/reposição) → INSERT automático em `estoque_movimentacoes` com tipo apropriado, para manter coerência com o histórico geral do módulo.

### Permissões (RLS)

- **INSERT em `estoque_placas` com `versao = 1` (compra de placa nova)**: apenas `is_admin_or_super`.
- **INSERT de nova versão (reposição)**: apenas `is_admin_or_super`.
- **UPDATE de status / instalação / retirada / roubo / perda**: qualquer usuário com `has_system_access('estoque')`.
- **DELETE**: apenas `is_admin_or_super`.
- **INSERT em `estoque_placas_historico**`: qualquer usuário com acesso ao módulo.
- SELECT: qualquer usuário com acesso ao módulo.

Audit triggers ligados às duas novas tabelas (já há infraestrutura `audit_module_changes`).

---

## 2. UI — nova página `/estoque/placas`

Item novo no `EstoqueSidebar` ("Placas", ícone `Tag` ou `Flag`) acima de Solicitações.

### Aba 1 — **Lista de placas**

Tabela com filtros: `tipo_uso`, `tamanho`, `status`, busca por código/imóvel.
Colunas: Código (com badge da versão), Tipo (Venda/Aluga), Tamanho, Status (badge colorida), Imóvel atual, Local de armazenamento, Última movimentação.
Ações por linha (visíveis conforme permissão):

- **Instalar** (status `disponivel` → abre dialog: código do imóvel + data + obs)
- **Retirar do imóvel** (status `instalada` → dialog: data de retorno + obs)
- **Registrar roubo** (dialog: data + obs) — só se permitido
- **Registrar perda** (dialog: data + obs)
- **Ver histórico** (drawer/dialog mostrando linha do tempo: imóveis onde esteve, datas de saída e retorno, eventos de roubo/perda, criação, reposição)
- **Editar / Excluir** (apenas admin)

### Aba 2 — **Nova placa (compra)** — botão no topo, só admin

Dialog com:

- Código da placa (texto). Se o código digitado já existe e a placa atual está `roubada` ou `perdida` → mostra aviso "Esse código pertence à placa perdida/roubada em XX/XX/XXXX. Esta nova placa será registrada como **versão N** (reposição)." e pré-seleciona `substitui_placa_id`.
- Se código existe e ainda está ativo → bloqueia.
- Combobox de **códigos disponíveis para reuso** (placas com último status `roubada`/`perdida` sem versão ativa).
- Tipo de uso (Venda / Aluga), Tamanho (1x1 / 2x2 / Outro + texto), Local de armazenamento, Observações.
- Ao salvar: cria placa com `status='disponivel'` e linha em histórico `criacao` ou `reposicao`.

### Aba 3 — **Saldo de placas**

Tabela agrupando por Tipo + Tamanho + Local: total disponível, instaladas, roubadas/perdidas (mês), total geral. Reaproveita o card de saldos existente para o material "Placa" também aparecer corretamente em `/estoque/saldos`.

### PDF — `PlacasPDFGenerator.tsx`

Mesmo padrão visual dos PDFs `AfastamentosPDFGenerator` e `PerdasFolgaPDFGenerator`:

- Cabeçalho com logo Execut, título "Relatório de Placas", filtros aplicados, período.
- Modo **Inventário**: lista atual de placas com status, tipo, tamanho, imóvel, local.
- Modo **Histórico de uma placa**: linha do tempo da placa selecionada (criação → instalações com data saída/retorno → roubo/perda → reposição).
- Filtros para o PDF (popover com checkboxes igual aos atuais): tipo_uso, tamanho, status, intervalo de datas.
- Rodapé com data de geração e usuário.

---

## 3. Regras / consistência (anti-furos)

1. **Bloqueio:** não é possível instalar uma placa que não esteja `disponivel`.
2. **Bloqueio:** não é possível retirar/marcar roubo/perda de uma placa que não esteja `instalada` ou `disponivel` (estados terminais não voltam).
3. **Bloqueio:** criar uma placa nova com código que já tem versão ativa.
4. **Reposição:** ao registrar roubo/perda, o sistema sugere automaticamente o botão "Comprar nova placa com este código" (atalho que abre o dialog de nova placa pré-preenchido).
5. **Saldo sempre coerente:** trigger recalcula `estoque_saldos` do material "Placa" sempre que uma placa muda de status, garantindo que `/estoque/saldos` reflita a realidade.
6. **Histórico imutável:** linhas de `estoque_placas_historico` não podem ser editadas, só inseridas (RLS sem UPDATE/DELETE para não-admin).
7. **Validações Zod** nos formulários: código 1-30 chars alfanuméricos, código do imóvel 1-30 chars, observações ≤ 500.
8. **Auditoria:** ambas as tabelas entram em `audit_module_changes` com `module_name = 'estoque'`.

---

## 4. Arquivos a criar / alterar

**Criar**

- `.lovable/estoque_placas_migration.sql` (tabelas, índices, RLS, grants, triggers de saldo, auditoria)
- `src/pages/estoque/EstoquePlacas.tsx` (página principal com abas)
- `src/components/estoque/placas/NovaPlacaDialog.tsx`
- `src/components/estoque/placas/InstalarPlacaDialog.tsx`
- `src/components/estoque/placas/RetirarPlacaDialog.tsx`
- `src/components/estoque/placas/RoubarPerderPlacaDialog.tsx`
- `src/components/estoque/placas/HistoricoPlacaDialog.tsx`
- `src/components/estoque/placas/PlacasPDFGenerator.tsx`
- `src/hooks/useEstoquePlacas.ts` (React Query)

**Alterar**

- `src/components/EstoqueSidebar.tsx` — novo item "Placas"
- `src/App.tsx` — nova rota `/estoque/placas`
- `src/pages/estoque/EstoqueSaldos.tsx` — exibir linha consolidada de placas (opcional, já vem via material)
- `.lovable/plan.md` — registrar a feature

---

## 5. Pendências para sua confirmação antes do build

- Quer que eu **crie automaticamente o material "Placa"** na migration (se ainda não existir), ou prefere que você cadastre manualmente em `/estoque/materiais` antes de usar a tela? Já existe o material placa, quero que você pegue o que já tem e faça o ajuste com os critérios que pedi, se é venda ou locação, se é 1x1m ou 2x2m ou se é outros.
- Para o PDF, quer **dois botões separados** (Inventário e Histórico por placa) ou um único com seletor? Único com seletor.

Se estiver tudo certo, basta aprovar e eu sigo para a implementação.
---

## Implementação concluída — Gestão de Placas

- Migration: .lovable/estoque_placas_migration.sql
- Página: src/pages/estoque/EstoquePlacas.tsx (com 5 dialogs inline)
- Hook: src/hooks/useEstoquePlacas.ts
- PDF: src/components/estoque/placas/PlacasPDFGenerator.tsx
- Sidebar + rota /estoque/placas
