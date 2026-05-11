## Problema

Após reorganizar o `DialogContent` como `flex flex-col`, o scroll interno parou de funcionar — provavelmente porque o `DialogContent` do shadcn aplica seus próprios paddings/grid e o filho `flex-1 min-h-0` não está recebendo a altura esperada.

## Correção

Em `src/components/ferias/folgas/GeradorFolgasDialog.tsx`:

1. Manter o `DialogContent` com `max-h-[90vh] flex flex-col overflow-hidden`.
2. Garantir que o container interno (tanto o estado inicial quanto o de preview) seja:
   - `flex-1 min-h-0` para herdar a altura disponível, e
   - tenha um wrapper rolável próprio com `overflow-y-auto` quando necessário.
3. No estado de preview, envolver a `ScrollArea` da tabela em um wrapper `flex-1 min-h-0` e dar à `ScrollArea` `h-full` (em vez de `flex-1`), pois o `ScrollArea` do Radix precisa de altura concreta para ativar o scroll interno.
4. No estado inicial (configuração), trocar `overflow-auto flex-1 min-h-0` por um wrapper `flex-1 min-h-0 overflow-y-auto` claro, para restabelecer o scroll do conteúdo de configuração quando ultrapassa a altura.
5. Manter `DialogHeader` e `DialogFooter` como `flex-shrink-0`.

Sem mudanças de lógica, regras ou banco — apenas layout.