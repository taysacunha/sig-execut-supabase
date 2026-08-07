# Bens Permanentes (Patrimônio) — nova página no módulo Despesas

Nova carteira para equipamentos, móveis e outros bens permanentes, com a mesma estrutura visual e de uso da página de Imóveis (KPIs, filtros, tabela, diálogo com abas).

## Página `/despesas/bens`

- Cabeçalho "Bens Permanentes" + botão "Novo bem".
- KPIs: Total de bens, Em uso, Em manutenção, Baixados, Valor total investido (mascarado pelo botão do olho).
- Filtros: busca por descrição, situação, categoria do bem, centro de custo, responsável.
- Tabela: Código (patrimônio), Descrição, Categoria, Situação, Centro de custo, Responsável, Local, Valor total, Ações (editar / desativar).
- Item no menu lateral de Despesas, abaixo de Imóveis.

## Diálogo do bem (abas)

1. **Dados** — código de patrimônio, descrição, categoria (equipamento, móvel, informática, outro), situação (em uso, em estoque, em manutenção, baixado, doado/vendido), centro de custo (obrigatório), responsável (pessoa), local/setor, marca, modelo, número de série, quantidade, data de aquisição, fornecedor, nota fiscal, garantia até, observação.
2. **Aquisições / Pagamentos** — equivalente à aba "Encargos" dos imóveis: lista de registros com **data da compra, valor e descrição** (+ categoria e plano de conta opcionais). Cada registro pode ser enviado ao calendário como **um único lançamento na data informada** (botão "Lançar no calendário"), de forma idempotente (não duplica se já lançado).
3. **Histórico** — mudanças de situação com data e motivo, registradas automaticamente.

O valor total do bem é a soma dos registros de aquisição/pagamento.

## Permissões

Nova aba `bens` no controle de permissões por aba, aparecendo na página "Permissões por Aba" junto com Calendário, Imóveis, Repasses e Cadastros. Visualizar / editar / excluir seguem o mesmo padrão (`podeVer`, `podeEditar`, `podeExcluir`).

## Detalhes técnicos

Migration (com GRANTs, RLS e políticas no mesmo padrão de `despesas_imoveis`):

- `despesas_bens` — cadastro do bem (campos acima, `is_active`, `created_by`, timestamps).
- `despesas_bem_pagamentos` — `bem_id`, `data_compra`, `valor`, `descricao`, `categoria_id`, `plano_conta_id`, `lancamento_id` (preenchido quando gerado no calendário), `observacao`.
- `despesas_bem_situacao_historico` — igual ao histórico de imóveis, alimentado por trigger.
- Incluir `'bens'` entre as abas aceitas por `despesas_aba_permissoes` e pelas funções `despesas_pode_ver_aba` / `despesas_pode_editar_aba` / `despesas_pode_excluir_aba`.
- Função `despesas_gerar_lancamento_bem(pagamento_id)` que cria um lançamento único na data da compra, referenciando o bem, sem duplicar.

Frontend:

- `src/hooks/useDespesasBens.ts` (espelha `useDespesasImoveis.ts`).
- `src/pages/despesas/DespesasBens.tsx` (espelha `DespesasImoveis.tsx`).
- `src/components/despesas/BemDialog.tsx` (espelha `ImovelDialog.tsx`).
- Rota lazy em `src/App.tsx`, item de menu em `src/components/DespesasSidebar.tsx`, tipo `DespesasAba` em `useDespesasPermissions.ts` e lista de abas em `DespesasPermissoes.tsx`.
- Todos os valores monetários usam `useDespesasValues` / `DespesasValuesScope` (botão do olho).