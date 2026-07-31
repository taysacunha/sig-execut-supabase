# Repasse: excluir competência e navegação por ano

## Hoje

No diálogo de repasse a barra lista todas as competências lado a lado, sem agrupamento e sem forma de excluir. Por isso "fev/2027" aparece misturado com "jul/2026" e não há como remover o mês criado por engano.

## 1. Excluir competência

- Cada competência selecionada ganha um botão de exclusão (ícone de lixeira) ao lado das ações de fechar/marcar como pago.
- Ao clicar, abre uma confirmação (AlertDialog) informando o mês e que serão removidos também os itens e beneficiários daquele mês.
- Só é permitido excluir competências que **não** estejam com status "pago" (nesse caso o botão fica desabilitado com explicação: é preciso estornar antes).
- Se tiver com o status pago, deve ser possível voltar para o status anterior, justificando, e depois disso pode-se ajustar e voltar para pago ou até excluir.
- Após excluir, a seleção volta para a competência mais recente restante.

## 2. Agrupar por ano

- A barra passa a ter duas linhas:
  - Linha 1: botões de **ano** (2026, 2027, …) em ordem crescente, mais o botão "Todas" (consolidado geral).
  - Linha 2: os **meses do ano selecionado**, em ordem cronológica (jan → dez), cada um com seu badge de status.
- Ao abrir o diálogo, seleciona-se automaticamente o ano mais recente com competências e o mês mais recente desse ano.
- Ao adicionar uma nova competência, o ano dela é selecionado automaticamente.
- O consolidado "Todas" continua somando todas as competências; opcionalmente o rodapé de totais indica o ano em foco.

## Detalhes técnicos

- `src/components/despesas/RepasseDialog.tsx`: novo estado `anoAba`; competências agrupadas por `competencia.slice(0,4)`; meses ordenados crescente dentro do ano; botão + AlertDialog de exclusão usando o hook já existente `useDeleteRepasse` de `src/hooks/useDespesasRepasses.ts` (invalida `REPASSES_KEY` e `CONTAS_KEY`).
- Sem mudanças de banco: a exclusão de `despesas_repasses` já remove itens/beneficiários em cascata.