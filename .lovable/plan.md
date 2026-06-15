## Causa raiz

O `GeradorFolgasDialog` aplica corretamente a exclusão por perda registrada (linhas 506–507 de `GeradorFolgasDialog.tsx`, usando `hasPerda(colab.id)`), e a query carrega da tabela `ferias_folgas_perdas` pela chave:

```
["ferias-perdas-gerador", year, month]
```

Mas no `PerdaFolgaDialog.tsx`, ao registrar uma nova perda, o `onSuccess` da mutation só invalida estas chaves:

```
["ferias-perdas"]
["ferias-perdas-check"]
```

A chave `["ferias-perdas-gerador", ...]` **nunca é invalidada**. Resultado: ao abrir o Gerador depois de registrar a perda, o React Query devolve o cache antigo (vazio) e a Maria de Lourdes não é excluída — exatamente o sintoma relatado.

O mesmo vale para `["ferias-afastamentos-gerador", ...]` (não afeta este caso, mas seria coerente também).

## Mudança

Em `src/components/ferias/folgas/PerdaFolgaDialog.tsx`, no `onSuccess` da `addPerdaMutation`, adicionar:

```ts
queryClient.invalidateQueries({ queryKey: ["ferias-perdas-gerador"] });
```

(invalidação por prefixo, cobre todas as combinações de year/month em cache).

Nenhuma outra alteração necessária — a lógica de exclusão do gerador já está correta.

## Validação

1. Registrar perda da Maria de Lourdes em agosto.
2. Abrir o Gerador de Folgas para agosto → ela deve aparecer como excluída (motivo "Perda registrada") e não receber sábado no preview.
