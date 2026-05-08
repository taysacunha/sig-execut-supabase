## Problema

No dialog "Editar Colaborador", a aba de setores substitutos exibe dados antigos (cache) em vez do que foi salvo na última edição. O salvamento funciona corretamente no banco (a visualização pelo botão "olho" mostra o valor certo), mas ao reabrir o lápis aparece a seleção anterior.

## Causa raiz

Em `src/components/ferias/colaboradores/ColaboradorDialog.tsx`:

1. A query `["ferias-setores-substitutos", colaborador?.id]` **nunca é invalidada** após o `mutation.onSuccess`. Logo, na próxima abertura do dialog o React Query devolve imediatamente o array em cache (estado anterior).
2. O efeito que popula `selectedSetoresSubstitutos` usa um flag `hasLoadedSubstitutos` que dispara apenas uma vez por abertura. Como o cache já está "fetched", ele copia o valor antigo e ignora qualquer refetch posterior.

Por isso o usuário vê "locação" (valor anterior) mesmo tendo salvo "cadastro de imóvel".

## Correção

Em `ColaboradorDialog.tsx`:

1. No `onSuccess` da mutation, adicionar:
   ```ts
   queryClient.invalidateQueries({ queryKey: ["ferias-setores-substitutos"] });
   ```
2. Para garantir dados frescos ao abrir o dialog (mesmo se a invalidação não tiver corrido ainda), forçar refetch quando `open && colaborador?.id` mudarem — usar `refetchOnMount: "always"` na query ou chamar `queryClient.invalidateQueries` no `useEffect` que abre o dialog.
3. Tornar o efeito de carga reativo a `setoresSubstitutos`: em vez do flag `hasLoadedSubstitutos` (que congela o estado), sincronizar `selectedSetoresSubstitutos` sempre que a query atualizar enquanto o dialog estiver aberto e o usuário ainda não tiver feito alterações locais — ou simplesmente recarregar quando `colaborador?.id` ou o array retornado mudar de identidade após refetch.

## Arquivos afetados

- `src/components/ferias/colaboradores/ColaboradorDialog.tsx`

Sem alterações de schema ou backend.
