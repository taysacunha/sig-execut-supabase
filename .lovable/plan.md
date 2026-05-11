## Problema

No `src/components/ferias/folgas/GeradorFolgasDialog.tsx`, duas regras de exclusão por férias estão incorretas — produzindo o oposto do esperado.

### Bug 1 — Colaboradores em férias aparecem no preview (Luciano, Rejane, Amally...)

A função `hasFullMonthVacation` só bloqueia o colaborador se ele tiver **mais da metade do mês** em férias:

```ts
return vacationDays > daysInMonth / 2;
```

Resultado: quem tira ~15 dias (uma quinzena) num mês de 30 dias **não é bloqueado** e entra no preview, mesmo estando de férias naquele mês.

### Bug 2 — Gabriella (férias em maio com pequena sobra em junho) não aparece em junho

A função `shouldSkipDueToTwoMonthVacation` está **invertida**:

```ts
// Pula folga apenas no mês atual se ele NÃO é o que tem mais dias
return maxDays > currentMonthDays;
```

Hoje, se o colaborador tem mais dias de férias em **outro** mês, ele é excluído do mês atual. Para Gabriella (maioria em maio, ponta em junho), maio > junho → ela é **excluída de junho**. O correto é o oposto: ela deve **receber** a folga no mês onde tem **menos** sobreposição (junho), justamente porque lá ela tem sábados livres.

## Correção

Unificar a regra de "férias no mês" para um único critério:

1. **Se o colaborador tem férias somente em 1 mês** → bloquear folga nesse mês (qualquer quantidade de dias de gozo, não só >50%).
2. **Se as férias se dividem em 2 meses** → conceder a folga **no mês com menos dias de gozo** (ou seja, bloquear apenas no mês com mais dias). Empate: bloquear o mês atual (mantém comportamento conservador).

### Mudanças no código

Arquivo único: `src/components/ferias/folgas/GeradorFolgasDialog.tsx`

- **Substituir** `hasFullMonthVacation` por `hasVacationInMonth` que retorna `true` sempre que `countVacationDaysInMonth(colabId) > 0` (respeitando a flag `FOLGAS_BLOQUEAR_MES_FERIAS`).
- **Inverter** `shouldSkipDueToTwoMonthVacation` para retornar `true` quando o mês atual tem **mais ou igual** dias de gozo que os outros meses (ou seja, "este é o mês 'principal' das férias"). Caso contrário, retornar `false` para liberar a folga.
- Ajustar a ordem de checagem no `Step 1` (`exclusionReasons`) para:
  - Primeiro `hasVacationInMonth` → se falso, não há nada a checar.
  - Se verdadeiro, checar `shouldSkipDueToTwoMonthVacation`: se for o mês secundário (menos dias), **liberar** (não excluir); senão, excluir com motivo "Férias no mês".
- Manter a flag `FOLGAS_FERIAS_DOIS_MESES`: quando desligada, sempre bloquear se houver qualquer dia de férias no mês.
- Mensagens de exclusão ajustadas para refletir a nova lógica ("Férias no mês" / "Férias no mês (exceção)").

### Resultado esperado

- Luciano, Rejane, Amally (férias inteiramente dentro de junho ou maioria em junho) → **excluídos** do preview de junho.
- Gabriella (maio principal, junho secundário) → **incluída** no preview de junho.

### Não-alterações

- Sem mudanças de schema, RLS ou outras telas.
- A regra de exceção (`is_excecao`) e os afastamentos continuam exatamente como estão.
- O algoritmo de alocação (Steps 4–7) não é tocado.
