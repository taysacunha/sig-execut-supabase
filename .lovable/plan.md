# Correções — Despesas (repasses, imóveis, lançamentos)

## 1. Layout quebrado na aba Beneficiários (Repasses)
Reorganizar o bloco "adicionar beneficiário" do `RepasseDialog` em um formulário em grade estável:
- Linha 1: Pessoa (combobox largo) | Valor | Limite
- Linha 2: Data do recebimento | Observação | botões "Restante" e "Adicionar"
O botão "Restante" fica colado ao campo Valor (nunca abaixo de Observação), e a mesma grade é usada no modo de edição inline, para não quebrar em telas menores.

## 2. Repasse: limite por beneficiário, sobra para a proprietária, data de recebimento
Regras a implementar:
- Cada beneficiário passa a ter **valor limite** (teto do que pode receber no mês) além do **valor do mês** e uma **data de recebimento**.
- Botão "Distribuir": preenche os valores do mês respeitando o limite de cada beneficiário, na ordem definida; o que sobrar após todos atingirem o limite é atribuído ao beneficiário marcado como **proprietário/residual** (a proprietária, que também pode ser beneficiária).
- O valor de cada mês pode variar livremente — o limite é apenas teto, nunca valor fixo.
- Continua valendo a regra de que a soma não pode exceder o valor líquido do repasse.

## 3. Prestação de contas com locatário/inquilino
- No cadastro do imóvel, o campo Inquilino passa a exibir **nome + CPF/CNPJ** (no seletor e no resumo do imóvel).
- Na aba "Imóveis & inquilinos" do repasse e na exportação/prestação, cada imóvel mostra o locatário com nome e CPF/CNPJ.

## 4. Exclusão de imóveis não aparece para a Germana (super admin)
O botão só aparece com nível `delete` na aba "imoveis". O padrão para admin/super admin já é `delete`, mas uma linha explícita em `despesas_aba_permissoes` sobrepõe esse padrão. Passos:
1. Verificar as permissões gravadas para o usuário (aba `imoveis`).
2. Ajustar a regra para que **super_admin sempre tenha nível `delete`**, ignorando linhas explícitas (no hook de permissões e na função `despesas_nivel_aba` do banco), evitando que uma configuração acidental bloqueie o super admin.

## 5. Erro ao editar lançamento: `uq_desp_lanc_serie_venc`
O índice único atual cobre `(serie_recorrencia_id, data_vencimento)` sem filtro. Editar um lançamento de uma série para uma data já ocupada por outra parcela da mesma série dispara o erro. Correção:
- Recriar o índice como parcial (`WHERE serie_recorrencia_id IS NOT NULL`) e ajustar a função de geração para usar `ON CONFLICT ... WHERE` correspondente.
- Na edição manual, permitir a alteração de data desvinculando a parcela da série (marcando como manual) quando houver colisão, e exibir mensagem em português explicando o caso em vez do erro bruto do Postgres.

## 6. Lançamentos cancelados na lista
Separar cancelados do fluxo normal no Calendário: por padrão a lista exclui cancelados e eles passam a ter uma aba/visão própria "Cancelados", com o mesmo filtro de período e a ação de estorno já existente.

## Detalhes técnicos
- `src/components/despesas/RepasseDialog.tsx`: grade do formulário, novos campos (limite, data de recebimento), botão "Distribuir".
- `src/hooks/useDespesasRepasses.ts`: tipos e mutations dos novos campos.
- Migration: `ALTER TABLE despesas_repasse_beneficiarios ADD COLUMN valor_limite numeric(14,2), data_recebimento date, is_residual boolean default false`; índice único parcial garantindo um único residual por repasse; recriação do índice `uq_desp_lanc_serie_venc` como parcial; `despesas_nivel_aba` retornando `delete` para super_admin.
- `src/hooks/useDespesasPermissions.ts`: super_admin sempre `delete`.
- `src/pages/despesas/DespesasCalendario.tsx`: exclusão de cancelados da lista principal + aba "Cancelados".
- `src/components/despesas/ImovelDialog.tsx` e listagens: inquilino com CPF/CNPJ.
