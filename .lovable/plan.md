# Estoque máximo e painel de reposição

## Objetivo
Permitir definir um estoque máximo por material e ter uma visão que mostre, para cada material, quanto existe hoje (total e por local) e quanto falta para atingir o máximo.

## O que será feito

### 1. Campo "Estoque máximo"
- Novo campo no banco na tabela de materiais (`estoque_maximo`, número inteiro, padrão 0 = sem máximo definido).
- Campo adicionado nos formulários de **novo material** e **editar material** (página Materiais), ao lado de "Estoque mínimo".
- Validação simples: se preenchido, precisa ser maior ou igual ao mínimo.
- O mesmo campo também no diálogo de cadastro/edição de **Placas**, para manter consistência.
- Coluna "Máx." exibida na tabela de materiais.

### 2. Nova aba "Reposição" na página Saldos
Uma aba ao lado das abas de unidades, listando somente materiais com estoque máximo definido:

- Material | Unidade de medida | Mínimo | Máximo | Estoque atual (soma de todos os locais) | Falta para o máximo | Situação
- Situação: "Abaixo do mínimo" (alerta), "Repor" (abaixo do máximo), "Completo" (atingiu o máximo).
- Busca sem acento, ordenação e paginação (25/50/100/200), no mesmo padrão das outras tabelas.
- Filtro por unidade (Bessa, Tambaú, etc.) para ver a necessidade só daquela unidade.

### 3. Detalhe por material
Ao clicar em uma linha, abre um diálogo mostrando:
- Estoque atual total e quanto falta para o máximo.
- Quebra por local: ex. "Bessa: 5", "Tambaú: 10".
- Mínimo e máximo cadastrados.

Exemplo: Açúcar, mínimo 5, máximo 20, saldo 15 (5 no Bessa, 10 em Tambaú) → "Faltam 5 para o estoque máximo".

## Detalhes técnicos
- Migration: `ALTER TABLE public.estoque_materiais ADD COLUMN estoque_maximo integer NOT NULL DEFAULT 0;` (sem mudança de RLS/grants).
- `src/pages/estoque/EstoqueMateriais.tsx`: incluir `estoque_maximo` na interface `Material`, no state do form, no insert/update e na tabela.
- `src/components/estoque/materiais/NovaPlacaDialog.tsx`: mesmo campo no cadastro/edição de placas.
- `src/pages/estoque/EstoqueSaldos.tsx`: nova aba "Reposição" agregando `estoque_saldos` por `material_id` e por local, cruzando com `estoque_materiais`; reaproveitar `useTableControls` e `TableSearch`/`TablePagination`/`SortableHeader`.
- Novo componente `src/components/estoque/saldos/ReposicaoDetalheDialog.tsx` para o detalhe por local.
- Visibilidade seguindo `can_view_system('estoque')`; edição do campo apenas com `canEdit("estoque")`.
