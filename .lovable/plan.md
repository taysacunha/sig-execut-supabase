

## Diagnóstico Raiz: Regra 10 é absoluta e mata o equilíbrio

O problema central: **Regra 10 ("sábado = máx 1 externo") está codificada como ABSOLUTA** em 3 pontos diferentes, impedindo que corretores de sábado recebam 2+ externos mesmo quando o sistema inteiro está desequilibrado:

1. **`checkAbsoluteRules`** (linha 1063-1075): retorna `allowed: false` se sábado + 1 externo
2. **`findBrokerForDemand`** (linhas 2562-2576): bloqueia com `continue` se `worksSaturday && externalShiftCount >= 1`
3. **`findBrokerForDemand`** (linhas 2582-2592): bloqueia sexta para quem trabalha sábado

Como vários corretores trabalham sábado interno, eles ficam permanentemente travados em 1 externo. O gate de nível 2 vê `globalMin=1` (esses corretores) e nunca libera nível 3, mas ao mesmo tempo outros corretores acumulam 3-4 porque são os únicos elegíveis para certas demandas.

## Solução: Regra 10 Flexível + Gate Inteligente

### Mudança 1: Tornar Regra 10 flexível em `checkAbsoluteRules` (linhas 1063-1075)

Remover Regra 10 como bloqueio absoluto. Em vez disso, retornar um campo `softBlocked` que pode ser ignorado quando necessário:

```text
- Se trabalha sábado E externalShiftCount >= 1:
  - Retornar allowed: true, MAS com flag softRule10: true
  - O chamador decide se respeita ou não
```

Na prática, manter `checkAbsoluteRules` sem a Regra 10 (ela será enforced como preferência em `findBrokerForDemand`).

### Mudança 2: Regra 10 condicional em `findBrokerForDemand` (linhas 2562-2592)

Aplicar o bloqueio de sábado apenas quando `maxAllowedExternals <= 2` (níveis 1-2):

```text
ANTES: if (worksSaturday && externalShiftCount >= 1) → BLOQUEIA sempre
DEPOIS: if (worksSaturday && externalShiftCount >= 1 && maxAllowedExternals <= 2) → BLOQUEIA só nos níveis 1-2
```

Mesma lógica para o bloqueio de sexta (linhas 2582-2592).

Nos níveis 3-4, corretores de sábado podem receber mais externos se necessário.

### Mudança 3: Regra 10 removida de `checkTrulyInviolableRules` (linhas 747-757 / 1043-1075)

A função `checkTrulyInviolableRules` é usada pelo rebalanceamento e chain swaps. Regra 10 não deve impedir trocas de equilíbrio:

- Remover a verificação de Regra 10 desta função
- Isso permite que `rebalanceDistributionViaSwaps` mova alocações PARA corretores de sábado

### Mudança 4: Gate inteligente — excluir corretores genuinamente travados

No cálculo de `globalMin` (linhas 3815-3836), excluir corretores que NÃO podem receber nenhuma demanda restante por elegibilidade (não por Regra 10):

```text
ANTES: globalMin = min(externalShiftCount) de TODOS com externalLocationCount > 0
DEPOIS: globalMin = min(externalShiftCount) de quem tem PELO MENOS 1 demanda não-alocada elegível
```

Se um corretor tem 1 externo mas não é elegível para nenhuma demanda restante, ele não deve travar o gate.

### Mudança 5: Gate relaxável só sem opção

No passe final (Etapa 9 / 8.11), antes de permitir o 3º+ externo, tentar agressivamente chain swaps e 2-hop chains. Só liberar quando não houver mais nenhuma combinação possível que melhore a distribuição.

### Arquivos alterados

Apenas **`src/lib/scheduleGenerator.ts`**:

- `checkAbsoluteRules`: remover Regra 10 (~5 linhas removidas)
- `checkTrulyInviolableRules`: remover Regra 10 (~15 linhas removidas)  
- `findBrokerForDemand`: condicionar bloqueio sábado ao `maxAllowedExternals` (~4 linhas alteradas)
- Loop de níveis (gate): filtrar `globalMin` por elegibilidade real (~10 linhas alteradas)
- Passe final: adicionar tentativa extra de swaps antes de relaxar gate (~15 linhas adicionadas)

Total estimado: ~50 linhas alteradas/adicionadas.

