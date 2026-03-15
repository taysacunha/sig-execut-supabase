

## Diagnóstico

A função `rebalanceDistributionViaSwaps` usa thresholds fixos:
- **Over**: `externalShiftCount >= 3`
- **Under**: `externalShiftCount <= 1`

Lisandra tem 4 externos, Leonardo tem 2. Leonardo **não entra** como "under" porque tem 2 (> 1). O sistema nunca tenta mover um plantão de Lisandra (4) para Leonardo (2), mesmo sendo uma melhoria óbvia (4→3 e 2→3).

## Correção

Alterar a lógica de rebalanceamento para usar **thresholds dinâmicos** em vez de fixos:

```text
Enquanto (max_externos - min_externos >= 2):
  overBrokers = brokers com externalShiftCount == max_externos
  underBrokers = brokers com externalShiftCount == min_externos
  Tentar mover 1 alocação de over → under
  Se conseguiu, recalcular max/min
  Se não conseguiu nenhum swap na iteração, parar
```

Isso garante que o caso 4 vs 2 seja tratado (mover de 4→3 para 2→3), e depois 3 vs 2 também pode ser ajustado se possível (diferença = 1, para). O critério de parada é `diferença < 2`.

### Alteração em `src/lib/scheduleGenerator.ts`

Na função `rebalanceDistributionViaSwaps` (linhas ~1829-1838):
- Substituir filtros fixos `>= 3` e `<= 1` por cálculo dinâmico de `maxCount` e `minCount` a cada iteração
- Condição de parada: `maxCount - minCount < 2`
- Over = brokers com `externalShiftCount === maxCount`
- Under = brokers com `externalShiftCount === minCount`

