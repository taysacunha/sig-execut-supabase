# Ampliar o diálogo de Repasses e ajustar a barra de competência

## Objetivo
Dar mais espaço ao diálogo de repasses (altura e largura), corrigir o que quebrar com a expansão e permitir cancelar a adição de competência.

## O que muda

### 1. Diálogo maior
- Largura: de `max-w-6xl w-[95vw]` para praticamente tela cheia (`max-w-[98vw]`), mantendo margem lateral mínima.
- Altura: usar `h-[95vh]` com layout em coluna, cabeçalho e rodapé fixos e apenas o miolo (abas) rolando. Hoje o conteúdo inteiro rola dentro do limite de 90vh definido no componente base de diálogo.
- O componente base `dialog.tsx` não é alterado — o ajuste fica só neste diálogo, para não afetar os demais do sistema.

### 2. Ajustes de quebra com o novo tamanho
- Barra de competências (anos/meses) e bloco de totais: manter em blocos fixos no topo, sem rolagem própria.
- Tabelas de Beneficiários, Itens e Imóveis: aproveitar a largura extra, remover rolagens horizontais desnecessárias e redistribuir as colunas (descrição/pessoa ganham espaço, valores mantêm largura confortável).
- Rodapé com as ações (Fechar/Reabrir/Excluir/Marcar como pago) fixo na base, sem sobrepor conteúdo.

### 3. Cancelar a adição de competência
- Ao clicar em "Competência", além do campo de mês e do botão "Adicionar", exibir um botão "Cancelar" que fecha o campo e limpa o valor digitado.
- Tecla Esc no campo de mês também cancela.

## Detalhes técnicos
- Arquivo único: `src/components/despesas/RepasseDialog.tsx`.
- `DialogContent` com `flex flex-col` e altura fixa; área de abas com `flex-1 overflow-y-auto`.
- Estado `addOpen`/`novaComp` reaproveitado para o cancelamento.
