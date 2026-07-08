## Objetivo

No diálogo "Nova saída para imóvel", exibir no campo **Material da placa** apenas os materiais que possuem saldo em estoque (> 0 em qualquer local) e mostrar a quantidade total disponível ao lado do nome — evitando perder tempo abrindo materiais sem saldo.

## Comportamento esperado

- Lista de materiais mostra apenas materiais-placa ativos com saldo total > 0.
- Cada opção exibe o nome seguido do total disponível, ex: `Placa - Aluga (43)`.
- Se nenhum material tiver saldo, a lista fica vazia com mensagem existente do combobox.
- O nome exibido no botão do combobox (após selecionar) também mostra `(N)`.
- Nada muda no fluxo de locais, códigos, criação de código ou gravação — apenas o filtro/label do material.

## Alterações

Arquivo único: `src/components/estoque/placas/NovaSaidaDialog.tsx`

1. Criar um `useMemo` que soma `quantidade` de `saldos` agrupado por `material_id` (apenas quantidades > 0 já entram naturalmente na soma).
2. Derivar `materiaisPlacaComSaldo` a partir de `materiaisPlaca`:
   - Filtrar `total > 0`.
   - Mapear para `{ id, nome: \`${nome} (${total})\` }` para o combobox.
3. Passar `materiaisPlacaComSaldo` ao `<MaterialCombobox>` em vez de `materiaisPlaca`.
4. Ao resolver `materialSelecionado` e `syncAttributesFromMaterial`, continuar usando `materiaisPlaca` original (com nome sem sufixo) para não afetar atributos.
5. Placeholder/emptyMessage: ajustar `emptyMessage` para "Nenhum material-placa com saldo em estoque. Registre uma entrada na aba Saldos." quando aplicável.

## Fora de escopo

- Diálogo/ferramenta de saída em outros locais (só este dialog foi pedido).
- Regras de código de placa (mantidas como estão).
- Alterações no `MaterialCombobox`.
