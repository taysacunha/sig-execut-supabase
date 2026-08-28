# Repasse — remover imóvel do bloco e campos de valor sem setas

## 1. Remover imóvel (com confirmação)
- Cada bloco de imóvel na aba Itens ganha um botão de remover (lixeira) no cabeçalho, visível apenas em modo de edição.
- Ao clicar, abre um AlertDialog: informa o nome do imóvel, quantos lançamentos serão apagados e o valor de créditos/débitos que sairão do total. Texto deixa claro que todos os lançamentos daquele imóvel na competência serão excluídos definitivamente.
- Ao confirmar: todos os itens da competência vinculados ao imóvel são excluídos; o bloco some da lista e o imóvel volta a ficar disponível no seletor "Selecione um imóvel para lançar".
- Se o bloco só existir na tela (imóvel adicionado e ainda sem itens), a remoção é local, sem confirmação de exclusão de lançamentos.

## 2. Recalcular totais após a remoção
- Após excluir os itens, o repasse é recalculado como já ocorre ao excluir um item avulso: totais de créditos/débitos, valor líquido e saldos por imóvel refletem apenas os itens restantes (ex.: 10.000 com 5.000 do imóvel removido passa a 5.000).
- Os beneficiários/limites são revalidados contra o novo líquido, com o mesmo aviso já existente quando a soma distribuída ultrapassa o líquido.

## 3. Campos de valor sem setas e sem alteração pela roda do mouse
- Todos os campos monetários do diálogo de repasse deixam de exibir as setas (spinner) do input numérico.
- A rolagem do mouse sobre o campo não altera mais o valor: o campo perde o foco no evento de roda, mantendo exatamente o que foi digitado.

## Detalhes técnicos
- `src/components/despesas/RepasseDialog.tsx`: botão + AlertDialog de remoção por grupo; exclusão em sequência via `useDeleteRepasseItem` para os itens do grupo, depois limpeza do imóvel de `imoveisExtras`/`novoPorImovel`; o recálculo já roda no `onSuccess` da mutation (invalidate das queries do repasse).
- Campos de valor: aplicar classe utilitária `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none` e `onWheel={(e) => e.currentTarget.blur()}` em todos os `Input type="number"` do arquivo (itens, encargos, beneficiários, limites, taxa).
