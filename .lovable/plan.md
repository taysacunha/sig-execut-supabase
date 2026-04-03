

## Plano: Garantir que corretores sem plantao aparecam no PDF

### Problema

A query `scheduleBrokers` (linha 151 de `Schedules.tsx`) busca da tabela `schedule_brokers` usando `selectedScheduleId`. Porem, `schedule_brokers` referencia a tabela legada `schedules(id)`, enquanto `selectedScheduleId` e um ID de `generated_schedules`. Resultado: a query sempre retorna vazio, e o PDF cai no fallback (linha 95-97 de `SchedulePDFGenerator.tsx`) que extrai corretores apenas dos assignments — excluindo quem nao tem plantao alocado, como Adjane.

### Correcao

Alterar a query `scheduleBrokers` em `Schedules.tsx` para buscar todos os corretores ativos (`is_active = true`) da tabela `brokers`, em vez de usar a tabela legada `schedule_brokers`. Assim, o PDF recebe a lista completa de corretores ativos e exibe todos, mesmo sem alocacoes.

### Alteracao em `src/pages/Schedules.tsx` (linhas 150-164)

Substituir a query atual:

```typescript
// ANTES: busca da tabela legada (sempre retorna vazio)
const { data: scheduleBrokers = [] } = useQuery({
  queryKey: ["schedule_brokers", selectedScheduleId],
  queryFn: async () => {
    ...from("schedule_brokers")...
  },
});
```

Por:

```typescript
// DEPOIS: busca todos os corretores ativos
const { data: scheduleBrokers = [] } = useQuery({
  queryKey: ["brokers", "active-for-schedule"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("brokers")
      .select("id, name, creci")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data || [];
  },
  staleTime: 5 * 60 * 1000,
});
```

### Resultado

- O `SchedulePDFGenerator` recebe `propBrokers` com todos os corretores ativos
- Linha 95-96 usa `propBrokers` (nao vazio) em vez do fallback
- Corretores sem alocacao aparecem no PDF com linha vazia e marcador `-`
- Nenhum outro arquivo precisa ser alterado

### Arquivo alterado

1. **`src/pages/Schedules.tsx`** — substituir query de `schedule_brokers` por query de `brokers` ativos

