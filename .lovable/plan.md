

## Plano Consolidado: Correções no Gerador + Validação Visível na Aba

### Problema

O gerador viola 3 regras e a aba de validacao nao detecta nenhuma delas, deixando o usuario sem visibilidade.

---

### Parte 1: Correções no Gerador (`src/lib/scheduleGenerator.ts`)

**1A. Disponibilidade global no sabado interno (Cleane)**

Na funcao `isEligibleForSaturdayInternal` (linha 3378), adicionar verificacao de `available_weekdays` do broker ANTES de qualquer outra verificacao:

```
// Verificar disponibilidade GLOBAL do corretor
const brokerFromQueue = brokerQueue.find(b => b.brokerId === brokerId);
if (brokerFromQueue && !brokerFromQueue.availableWeekdays.includes("saturday")) {
  return { eligible: false, reason: 'sem sabado na disponibilidade global' };
}
```

**1B. Bloquear externo quando ja tem interno no mesmo dia (Leonardo)**

Na funcao `checkTrulyInviolableRules` (linha 406), adicionar regra apos a Regra 9:

```
// REGRA: Interno + Externo no mesmo dia = PROIBIDO
const hasInternalSameDay = context.assignments.some(a =>
  a.broker_id === broker.brokerId &&
  a.assignment_date === demand.dateStr &&
  context.internalLocations?.some(l => l.id === a.location_id)
);
if (hasInternalSameDay) {
  return { allowed: false, reason: "Ja tem interno no mesmo dia", rule: "INTERNO_EXTERNO_MESMO_DIA" };
}
```

Mesma verificacao em `checkTrulyInviolableRulesWithRelaxation` para garantir que a ETAPA 9 (emergencia) tambem respeite.

**1C. Contexto de locais internos**

Garantir que `AllocationContext` tenha referencia a `internalLocations` (verificar se ja existe; se nao, adicionar ao construir o contexto).

---

### Parte 2: Novas Regras de Validacao (`src/lib/schedulePostValidation.ts`)

**2A. Expandir interface `BrokerInfo`**

Adicionar campo obrigatorio:
```typescript
interface BrokerInfo {
  id: string;
  name: string;
  availableWeekdays?: string[];
  weekdayShiftAvailability?: Record<string, { morning: boolean; afternoon: boolean }>;
}
```

**2B. Nova regra: Corretor alocado fora da disponibilidade**

Dentro do loop por broker (apos linha 109), para cada assignment verificar:
- Converter `assignment_date` para dia da semana
- Checar se esta em `broker.availableWeekdays`
- Se nao: violation `severity: "error"`, rule: `"FORA_DISPONIBILIDADE"`, detalhes: "Cleane alocada no sabado 08/03 mas sabado nao esta na sua disponibilidade"

**2C. Nova regra: Interno + Externo no mesmo dia**

Para cada dia do broker, verificar se tem assignments em local interno E local externo:
- Se sim: violation `severity: "error"`, rule: `"INTERNO_EXTERNO_MESMO_DIA"`, detalhes: "Leonardo com interno manha e externo tarde no sabado 08/03"

**2D. Nova regra: Turno alocado em horario nao configurado**

Parametro opcional novo: `locationShiftConfigs?: Map<string, Map<string, { hasMorning: boolean; hasAfternoon: boolean }>>` (Map<locationId, Map<dateStr, config>>).

Para cada assignment, verificar se o turno alocado (morning/afternoon) corresponde ao configurado:
- Se nao: violation `severity: "error"`, rule: `"TURNO_NAO_CONFIGURADO"`, detalhes: "Artus Vivence - sabado 08/03 tem turno da tarde alocado mas apenas manha esta configurado"

---

### Parte 3: Passar dados completos na chamada (`src/pages/Schedules.tsx`)

Na chamada de `postValidateSchedule` (linha 1183), expandir `brokersForValidation` para incluir:
- `availableWeekdays` (ja incluido)
- `weekdayShiftAvailability` do broker

Buscar e passar `locationShiftConfigs` construido a partir de `period_specific_day_configs` e `period_day_configs` para as semanas do mes.

---

### Parte 4: Explicacoes na aba de validacao (`src/components/ValidationReportPanel.tsx`)

Adicionar ao `ruleExplanations` (linha ~260):

```
"FORA_DISPONIBILIDADE": "Corretor foi alocado em um dia que nao esta na sua disponibilidade. Verifique o cadastro do corretor.",
"INTERNO_EXTERNO_MESMO_DIA": "Corretor tem plantao interno e externo no mesmo dia. Isso e fisicamente impossivel de cumprir.",
"TURNO_NAO_CONFIGURADO": "Um turno foi gerado para um horario que nao esta configurado no local. Verifique a configuracao de periodos do local.",
```

---

### Arquivos impactados

| Arquivo | Alteracao |
|---------|-----------|
| `scheduleGenerator.ts` | 1A: check `available_weekdays` no sabado interno; 1B: bloquear interno+externo no mesmo dia |
| `schedulePostValidation.ts` | 2B/2C/2D: 3 novas regras de validacao |
| `Schedules.tsx` | Passar dados completos para validacao |
| `ValidationReportPanel.tsx` | Explicacoes das 3 novas regras |

