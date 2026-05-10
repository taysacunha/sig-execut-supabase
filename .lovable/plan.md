# Corrigir bloqueio de folga por férias

## Problema

No `GeradorFolgasDialog.tsx`, o cálculo de "está de férias no mês" usa apenas as colunas da tabela `ferias_ferias` (`quinzena1_*`, `quinzena2_*` e, quando `gozo_diferente`, `gozo_quinzena*`). Esses campos representam os períodos enviados ao contador, **não** o gozo real.

Quando o colaborador tem `gozo_flexivel = true` (vendeu dias e/ou dividiu o gozo em sub-períodos), o gozo real está em `ferias_gozo_periodos` (com `tipo = 'gozo_diferente'` para descanso e `tipo = 'venda'` para dias vendidos). Hoje o gerador ignora essa tabela.

**Caso Anderson:** contador 25/05–08/06, mas gozo real só 25/05–29/05 (vendeu 10 dias). O sistema bloqueia folga em junho porque enxerga as férias até 08/06 — quando na verdade ele só descansa em maio.

Há também um bug no `shouldSkipDueToTwoMonthVacation`: ele não compara corretamente os dias de descanso em cada mês quando o gozo cruza meses. Deve eleger o mês com **mais dias de gozo** como o mês sem direito a folga, liberando o(s) outro(s).

## Mudanças

### 1. Buscar sub-períodos reais (`src/components/ferias/folgas/GeradorFolgasDialog.tsx`)

- Estender a query `feriasAtivas` para incluir `id` e `gozo_flexivel`.
- Adicionar nova query `feriasGozoPeriodos` em `ferias_gozo_periodos` filtrando pelos `ferias_id` retornados, trazendo apenas linhas com `tipo <> 'venda'` (i.e., gozo real). Indexar por `ferias_id`.

### 2. Helper único de "intervalos de gozo real" por férias

Criar `getGozoRanges(ferias)` que retorna um array de `{inicio, fim}` representando o descanso efetivo:
- Se a férias tem registros em `ferias_gozo_periodos` (com `tipo <> 'venda'`) → usar esses intervalos.
- Senão, fallback atual: usar `gozo_quinzena*` quando `gozo_diferente`, ou `quinzena1/quinzena2` (descontando `quinzena2_*` quando ausente).

### 3. Usar os intervalos reais em todos os pontos

Reescrever para usar `getGozoRanges`:
- `countVacationDaysInMonth(colabId)` — soma dias de cada intervalo real que caem no mês alvo.
- `isColabOnVacation(colabId, sábado)` — verifica se o sábado cai em algum intervalo real.
- `shouldSkipDueToTwoMonthVacation(colabId)` — corrigir lógica:
  - Para cada férias do colaborador, somar dias de gozo por mês (mapa `mês → dias`).
  - Se o mês atual aparece e existe outro mês com **mais** dias de gozo do que o mês atual, retorna `true` (pula folga no outro mês, libera no atual).
  - Se o mês atual tem ≥ dias que qualquer outro, retorna `false` (mantém a folga sendo bloqueada apenas neste mês via `hasFullMonthVacation`).
- `hasFullMonthVacation` continua usando `countVacationDaysInMonth` corrigido.

### 4. Mensagens

Manter o motivo atual ("Férias no mês" / "Folga no outro mês (férias dividida)"). Nenhuma mudança de UI.

## Detalhes técnicos

- A tabela `ferias_gozo_periodos` já existe com RLS (`can_view_system('ferias')`).
- Tipos: `tipo IN ('venda','gozo_diferente')`. Filtrar `neq('tipo','venda')` para obter só gozo.
- Sem alteração de schema. Apenas leitura adicional + lógica.
- Sem mudanças em outras telas (Calendário, Gantt, etc.) — escopo restrito ao gerador de folgas, conforme o problema relatado.

## Arquivos afetados

- `src/components/ferias/folgas/GeradorFolgasDialog.tsx` (única mudança)

## Validação

- Caso Anderson (gozo real só em maio, contador atravessa junho): deve aparecer disponível para folga em junho.
- Caso férias 10 dias em maio + 5 em junho: bloqueio só em maio.
- Caso férias 7 + 7 dividido entre dois meses: bloqueio no mês com mais dias; em empate, mantém comportamento atual (bloqueia ambos via `hasFullMonthVacation` se >50%).
