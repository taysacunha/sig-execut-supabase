## Causa provável

O cache já foi invalidado ao criar/apagar perda, mas se o usuário apaga o registro e clica em **Gerar Preview** sem recarregar a página, pode acontecer uma corrida: o `GeradorFolgasDialog` ainda usa o array `perdas` antigo em memória enquanto a refetch assíncrona ainda não terminou.

Além disso, se já havia um preview aberto, ele fica guardado em `previewData` até fechar o gerador.

## Correção

Em `src/components/ferias/folgas/GeradorFolgasDialog.tsx`:

1. Capturar `isFetching`/`refetch` da query de perdas:

```ts
const { data: perdas = [], isFetching: fetchingPerdas, refetch: refetchPerdas } = useQuery(...)
```

2. Transformar `handleGeneratePreview` em `async` e, no início, buscar perdas diretamente antes de montar exclusões:

```ts
const { data: perdasAtualizadas } = await refetchPerdas();
const perdasParaGerar = perdasAtualizadas ?? perdas;
```

3. Ajustar `hasPerda` para receber a lista usada naquela geração, evitando depender do estado antigo do React Query:

```ts
const hasPerda = (colabId: string, perdasBase: Perda[]) => ...
```

4. Limpar o preview quando o mês/ano mudar ou quando o diálogo abrir para uma nova geração, evitando exibir resultado antigo.

5. Desabilitar o botão **Gerar Preview** enquanto as perdas estão sendo buscadas (`fetchingPerdas`) e mostrar carregamento nesse caso.

## Resultado esperado

Após apagar uma perda e clicar direto em **Gerar Preview**, sem F5, o gerador vai consultar o estado atualizado da tabela antes de decidir quem está bloqueado. A colaboradora removida da lista de perdas volta a ficar elegível imediatamente.
