## Causa

A mutation `deletePerdaMutation` em `src/pages/ferias/FeriasFolgas.tsx` (linhas 336–347) só invalida `["ferias-perdas"]`. As outras queries que consomem a tabela `ferias_folgas_perdas` ficam com cache antigo:

- `["ferias-perdas-gerador", year, month]` em `GeradorFolgasDialog`
- `["ferias-perdas-check", year, month]` em `PerdaFolgaDialog`

Por isso, ao apagar a perda e abrir o Gerador, ela ainda aparece como bloqueada / indisponível.

## Mudança

Em `src/pages/ferias/FeriasFolgas.tsx`, no `onSuccess` da `deletePerdaMutation`, invalidar também:

```ts
queryClient.invalidateQueries({ queryKey: ["ferias-perdas-gerador"] });
queryClient.invalidateQueries({ queryKey: ["ferias-perdas-check"] });
```

Nenhuma outra alteração.

## Validação

Apagar perda → abrir Gerador para o mesmo mês → colaboradora deve voltar a estar disponível.
