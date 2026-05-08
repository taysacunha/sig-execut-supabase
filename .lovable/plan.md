## Problema

No `ColaboradorDialog.tsx`, após salvar, o `onSuccess` invalida apenas a query key `["ferias-setores-substitutos"]` (usada pelo dialog de edição).

Porém, o `ColaboradorViewDialog.tsx` (botão olho) usa uma query key diferente: `["ferias-setores-substitutos-view", colaborador?.id]`. Como essa key nunca é invalidada após salvar, o cache antigo é servido até a página recarregar.

## Correção

Em `src/components/ferias/colaboradores/ColaboradorDialog.tsx`, no `onSuccess` da mutation, adicionar a invalidação da query do view dialog:

```ts
queryClient.invalidateQueries({ queryKey: ["ferias-setores-substitutos-view"] });
```

Isso fará com que ao clicar no olho logo após salvar, os setores substitutos sejam buscados novamente e exibidos atualizados.

Opcionalmente, adicionar `staleTime: 0` na query do `ColaboradorViewDialog` como reforço, garantindo refetch sempre que o dialog abrir.

## Arquivos afetados

- `src/components/ferias/colaboradores/ColaboradorDialog.tsx` (invalidar key do view)
- `src/components/ferias/colaboradores/ColaboradorViewDialog.tsx` (opcional: `staleTime: 0` + `refetchOnMount: "always"`)
