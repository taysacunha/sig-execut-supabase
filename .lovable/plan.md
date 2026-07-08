## Corrigir "Saldo não encontrado" ao excluir entrada de estoque

### Causa
No `AlertDialog` de exclusão em `src/pages/estoque/EstoqueSaldos.tsx`, o `AlertDialogAction` do Radix fecha o dialog automaticamente no clique. O `onOpenChange` dispara `resetForms()`, que zera `selectedSaldo` **antes** de a mutation async lê-lo do closure. A mutation então cai no `throw new Error("Saldo não encontrado")`.

### Correção (uma linha)

`src/pages/estoque/EstoqueSaldos.tsx`, no `AlertDialogAction` da exclusão (linha ~769-770):

```tsx
onClick={(e) => {
  e.preventDefault();       // impede o auto-close do Radix
  excluirMutation.mutate();
}}
```

O `resetForms()` continua sendo chamado no `onSuccess` da mutation, então o dialog fecha normalmente após a exclusão. Em caso de erro, o dialog permanece aberto para o usuário corrigir/tentar de novo — comportamento adequado.

### Fora de escopo
- Alterar `ajuste`/`transferência` (esses usam `DialogFooter`/`Button`, sem o auto-close).
- Mexer em outras exclusões.
