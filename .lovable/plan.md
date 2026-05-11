## Problema

No dialog "Gerar Escala de Folgas - Todos os Setores", quando o preview é gerado, o bloco de alertas (`diagnosticMessage`) aparece no topo com texto longo. Como o `DialogContent` tem `max-h-[90vh]` mas o conteúdo interno usa altura fixa (`ScrollArea h-[400px]`), o alerta empurra o restante (badges, tabela, footer) para fora da área visível.

## Solução

Reorganizar o layout do preview para que:

1. O `DialogContent` use `flex flex-col` com `max-h-[90vh]`, garantindo que footer e tabela fiquem sempre visíveis.
2. A `ScrollArea` da tabela passe a usar `flex-1 min-h-0` (em vez de `h-[400px]`), ocupando o espaço restante.
3. O bloco de alertas deixe de ser um painel sempre expandido. Será substituído por um **Badge/Botão "Alertas (N)"** colocado na linha de badges do topo. Ao clicar, abre um **Popover** com o conteúdo dos alertas em uma área rolável (`max-h-64 overflow-auto`).
   - Se não houver alertas, o badge não aparece.
   - O conteúdo do popover preserva o ícone, a cor âmbar e a mensagem completa.

Resultado: o alerta continua acessível e visível (badge sempre destacado), mas não consome espaço vertical, e a tabela do preview e o footer (botão Salvar) ficam sempre dentro do dialog.

## Arquivo afetado

- `src/components/ferias/folgas/GeradorFolgasDialog.tsx` — alterações apenas de layout/JSX no bloco do preview (`!showPreview ? ... : (...)`). Sem mudanças de lógica, regras, queries ou banco.