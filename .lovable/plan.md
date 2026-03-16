

## Diagnóstico: Elegibilidade de Andrea está sendo cortada na construção da demanda

### O que encontrei

O problema está na função `isBrokerAvailableForShift` (linhas 3021-3049 do `scheduleGenerator.ts`). Essa função decide quem entra na lista `eligibleBrokerIds` de cada demanda — e quem não entra **nunca será considerado** para aquela demanda em nenhum pass.

Há dois filtros que podem excluir Andrea silenciosamente:

1. **Filtro Global** (linha 3031-3036): Se o campo `weekday_shift_availability` da tabela `brokers` estiver preenchido para Andrea, e não incluir um turno para um dia específico, ela é bloqueada para TODOS os locais naquele turno/dia. Mesmo que o vínculo `location_brokers` diga que ela pode.

2. **Filtro Local** (linha 3040-3042): Se o campo `weekday_shift_availability` no registro `location_brokers` de Andrea estiver preenchido para um dia, ele **substitui** completamente os campos `available_morning`/`available_afternoon` (fallback legacy). Se esse campo JSON existir mas estiver incompleto (ex: só `["morning"]` quando ela deveria ter `["morning","afternoon"]`), ela perde elegibilidade para o turno faltante.

**O problema crítico**: Não existe NENHUM log que mostre quem foi excluído da elegibilidade e por quê. O sistema apenas conta `eligibleBrokerIds.length` no final. Se Andrea é cortada aqui, o motor inteiro nunca a vê como opção — e nenhum diagnóstico posterior (trace, rebalanceamento, etc.) pode recuperá-la.

### Plano de correção

#### 1. Adicionar log de elegibilidade na ETAPA 1

Na construção de demandas (linhas 3109-3133), após montar `eligibleIds`, logar cada corretor que foi **excluído** e o motivo:

- `"GLOBAL: sem disponibilidade para {shift} em {dayOfWeek}"`
- `"LOCAL: weekday_shift_availability não inclui {shift} em {dayOfWeek}"`  
- `"LEGACY: available_{shift} = false"`
- `"DIA: {dayOfWeek} não está em available_weekdays"`

Isso vai revelar em tempo real, no console, exatamente por que Andrea não aparece como elegível para cada demanda.

#### 2. Incluir mapa de elegibilidade no trace de diagnóstico

Adicionar ao `GenerationQualityReport` um campo `eligibilityExclusions` que registra, por corretor subalocado, em quantas demandas ele foi excluído da elegibilidade e por qual motivo (global vs local vs dia).

Salvar isso junto do `brokerDiagnostics` no `setLastGenerationTrace`.

#### 3. Mostrar exclusões de elegibilidade no painel "Por que não alocou"

No `ValidationReportPanel`, quando o modo é "diagnostic", incluir uma seção separada para cada corretor subalocado mostrando:
- Quantas demandas existiam nos locais onde ele está cadastrado
- Em quantas ele foi considerado elegível
- Em quantas foi excluído e por quê (global, local, dia)

#### 4. Corrigir fallback de disponibilidade local

Atualmente, se `localAvail[dayOfWeek]` existe, o fallback legacy (`available_morning`/`available_afternoon`) é completamente ignorado. Isso pode causar restrição indevida se o JSON local foi salvo incompleto.

Correção: se `localAvail` existe para o dia mas está vazio (`[]`), tratar como "sem restrição local" e usar o fallback legacy em vez de retornar `false`.

### Arquivos a alterar

- `src/lib/scheduleGenerator.ts` — logs de elegibilidade + correção de fallback + captura de exclusões no trace
- `src/lib/generationTrace.ts` — nova interface para exclusões de elegibilidade
- `src/components/ValidationReportPanel.tsx` — exibir exclusões de elegibilidade no diagnóstico

### Resultado esperado

Após essa correção:
- Será possível ver no console exatamente por que Andrea não é elegível para cada demanda
- Se for um problema de configuração (dados), o log apontará direto
- Se for um bug no fallback de disponibilidade, a correção do item 4 resolve
- O painel de validação mostrará o diagnóstico completo de elegibilidade

