

## Plano: Cascatear disponibilidade do corretor para os locais (bidirecional)

### Resumo

Quando o usuario alterar a disponibilidade de um corretor na tela de Corretores, o sistema replica a alteracao completa (adicoes e remocoes) para todos os registros de `location_brokers` desse corretor. Alteracoes feitas diretamente no local ficam apenas no local. A regra e: **a ultima alteracao e a que vale** para gerar escalas, pois ambas escrevem em `location_brokers`.

### Regras

1. **Corretor → Locais**: ao salvar o corretor, substituir o `weekday_shift_availability` de todos os `location_brokers` desse corretor pela nova disponibilidade do corretor. Nao e intersecao — e substituicao total. Se adicionou quarta, todos os locais ganham quarta. Se removeu segunda, todos perdem segunda.

2. **Local → Local**: ao salvar no local, atualiza apenas aquele registro de `location_brokers`. Nao propaga para o corretor nem para outros locais.

3. **Ultima alteracao prevalece**: o gerador de escalas le `location_brokers.weekday_shift_availability`. Tanto o cadastro do corretor quanto o do local escrevem nessa mesma coluna. A ultima escrita e a que sera usada na geracao.

### Alteracao

**Arquivo: `src/pages/Brokers.tsx`** — no `updateMutation.mutationFn`, apos atualizar a tabela `brokers`:

1. Buscar todos os registros de `location_brokers` onde `broker_id` = id do corretor
2. Para cada registro, substituir `weekday_shift_availability` pela nova disponibilidade do corretor (copia direta, nao intersecao)
3. Atualizar `available_morning` e `available_afternoon` para retrocompatibilidade
4. Invalidar as queries `["locations"]` e `["brokers"]`

### Exemplo

- Lisandra tinha `monday: ["morning"], tuesday: []` no corretor
- No Botanic, `location_brokers` tinha `monday: ["morning"]`
- Usuario adiciona terca manha no corretor → `tuesday: ["morning"]`
- Sistema atualiza Botanic: `monday: ["morning"], tuesday: ["morning"]`
- Depois, no local Botanic, usuario remove segunda → Botanic fica `monday: [], tuesday: ["morning"]`
- Se depois o usuario volta ao corretor e remove terca → cascata substitui tudo: Botanic fica `monday: ["morning"], tuesday: []` (a alteracao do local e sobrescrita pela do corretor, pois a ultima alteracao prevalece)

### Detalhes tecnicos

```typescript
// No updateMutation, apos atualizar brokers:
const newAvail = data.weekday_shift_availability;

const { data: linked } = await supabase
  .from("location_brokers")
  .select("id")
  .eq("broker_id", id);

for (const lb of linked) {
  await supabase.from("location_brokers").update({
    weekday_shift_availability: newAvail,
    available_morning: Object.values(newAvail).some(s => s?.includes("morning")),
    available_afternoon: Object.values(newAvail).some(s => s?.includes("afternoon")),
  }).eq("id", lb.id);
}
```

Apenas um arquivo sera alterado: `src/pages/Brokers.tsx`.

