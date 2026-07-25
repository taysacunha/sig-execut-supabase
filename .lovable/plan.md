## Problema

No `RepasseDialog`, ao abrir o `ComboboxSelect` do campo "Pessoa" (beneficiário), a lista rola apenas pelas setas do teclado. O scroll com mouse/touchpad não funciona porque o `PopoverContent` está renderizado dentro do `DialogContent` (Radix), que intercepta eventos de wheel/touch e bloqueia a propagação para o `CommandList` do cmdk.

## Correção

Ajuste único no componente compartilhado `src/components/ui/combobox-select.tsx`:

1. Garantir que o `CommandList` tenha altura máxima e overflow explícitos (`max-h-64 overflow-y-auto overscroll-contain`) — o default do cmdk pode não bastar quando aninhado em Dialog.
2. Impedir que o Radix Dialog engula o wheel: adicionar `onWheel={(e) => e.stopPropagation()}` e `onTouchMove={(e) => e.stopPropagation()}` no `PopoverContent` (ou no `CommandList`).
3. Manter `onOpenAutoFocus` padrão para não quebrar o foco do `CommandInput`.

## Escopo

- Apenas `src/components/ui/combobox-select.tsx`.
- Sem alterações em `RepasseDialog`, dados ou lógica de negócio.
- A correção beneficia automaticamente todos os outros diálogos que usam o mesmo componente (Lançamento, Imóvel, Veículo, Pagamento).

## Validação

Abrir `/despesas/repasses` → Novo repasse → aba Beneficiários → clicar em Pessoa e rolar com touchpad/mouse.
