

## Plano: Corrigir bug critico — disponibilidade local sendo ignorada

### Problema

Taciana tem disponibilidade global no domingo de manha, mas no Nammos ela NAO tem domingo configurado. O gerador ignorou essa restricao e alocou ela no domingo para o Nammos.

### Causa raiz

No arquivo `src/lib/scheduleGenerator.ts`, linhas 3136-3147, a funcao `isBrokerAvailableForShiftWithReason` trata array vazio `[]` no `weekday_shift_availability` do vinculo local como "sem restricao" e faz fallback para campos legacy. Isso esta errado:

```typescript
// CÓDIGO ATUAL (ERRADO):
if (localShifts.length === 0) {
  // Fallback para campos legacy quando array local está vazio
  if (shift === "morning" && lb.available_morning === false) { ... }
  if (shift === "afternoon" && lb.available_afternoon === false) { ... }
  return { available: true };  // ← BUG: trata vazio como "disponível"
}
```

Quando o cascateamento do corretor ou a edicao direta do local resulta em `sunday: []`, isso significa "NAO disponivel no domingo para este local". Mas o codigo atual interpreta como "sem restricao" e retorna `true`.

### Correcao

**Arquivo: `src/lib/scheduleGenerator.ts`** — na funcao `isBrokerAvailableForShiftWithReason` (linha ~3139):

- Array vazio `[]` deve significar **indisponivel** para aquele dia, nao "sem restricao"
- Remover o fallback legacy quando o array local existe mas esta vazio
- Resultado: `sunday: []` → retorna `{ available: false, reason: "LOCAL: nenhum turno disponivel em sunday" }`

```typescript
// CÓDIGO CORRIGIDO:
if (localShifts.length === 0) {
  return { available: false, reason: `LOCAL: nenhum turno disponível em ${dayOfWeek}` };
}
```

### Verificacao de consistencia

Ha 3 funcoes de checagem de disponibilidade no mesmo arquivo. Preciso alinhar todas:

1. **`isBrokerAvailableForShiftWithReason`** (linha 3118) — externos: TEM o bug, precisa corrigir
2. **`isBrokerAvailableForInternalShift`** (linha 4687) — internos: ja funciona correto (array vazio → `.includes()` retorna false)
3. **`getAvailableBrokersForShift`** (linha 5227) — dialog de adicao manual: ja funciona correto (`!dayAvailability` captura array vazio como falsy? Nao — array vazio e truthy, mas `!dayAvailability.includes(shift)` retorna true, entao filtra corretamente)

Apenas a funcao #1 precisa de correcao.

### Resumo

- 1 arquivo alterado: `src/lib/scheduleGenerator.ts`
- 1 linha de logica substituida (linhas 3137-3147 → 2 linhas)
- A disponibilidade configurada no local passa a ser absoluta e inviolavel

