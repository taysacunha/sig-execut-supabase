

## Problema Real Identificado

Encontrei bugs concretos no motor que explicam por que Andrea (e corretores similares com 1 externo) ficam subalocados enquanto demandas sobram.

### Bug 1: ETAPA 9 PASSO 1 bloqueia Regra 8 desnecessariamente

Linha 3910 do `scheduleGenerator.ts`:
```typescript
const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, false);
//                                                                          ^^^^^^^ false = NÃO relaxa Regra 8
```

O PASSO 1 da ETAPA 9 é justamente para corretores com <2 externos que não foram alocados nos passes normais. Se a razão pela qual não foram alocados é conflito de dias consecutivos (Regra 8), chamar com `false` garante que eles vão ser bloqueados DE NOVO. O `true` deveria ser usado aqui — é exatamente o caso de uso do relaxamento.

### Bug 2: ETAPA 8.6 (Rebalanceamento) não verifica checkAbsoluteRules

Linha 3429: o rebalanceamento usa apenas `checkTrulyInviolableRulesWithRelaxation` mas NÃO verifica `checkAbsoluteRules`. Isso significa que o rebalanceamento ignora regras como:
- Regra 4 (conflito com outro local externo no mesmo dia)
- Regra 10 (sábado externo + cap de 2)
- Proteção do Bessa

Isso pode causar alocações inválidas durante o rebalanceamento, gerando violações que fazem o retry rejeitar a escala.

### Bug 3: Chain Swap (ETAPA 8.8.1) também não verifica checkAbsoluteRules

Linha 3514: mesmo problema — swaps podem violar regras absolutas.

### Correções

**Arquivo:** `src/lib/scheduleGenerator.ts`

1. **ETAPA 9 PASSO 1** (linha 3910): Mudar `false` para `true` no `checkTrulyInviolableRulesWithRelaxation` — corretores com <2 externos DEVEM ter Regra 8 relaxada, especialmente na etapa de emergência.

2. **ETAPA 8.6 Rebalanceamento** (linha 3429): Adicionar verificação de `checkAbsoluteRules` antes de alocar, para não criar alocações inválidas que invalidam a escala inteira.

3. **ETAPA 8.8.1 Chain Swap** (linha 3514): Adicionar verificação de `checkAbsoluteRules` na mesma lógica.

4. **findBrokerForDemand Passes 1-5**: Dentro do loop principal, quando um broker com <2 externos é elegível para uma demanda não alocada, o sistema bloqueia pela Regra 8 em passes 1-3 mas deveria relaxar desde o Pass 1 para quem tem <2 — isso já está correto na linha 2017. O problema real é que o `checkAbsoluteRules` (linha 1999) roda ANTES e pode bloquear por outras razões antes de chegar à Regra 8.

### Resultado Esperado

- Andrea com 1 externo não será mais bloqueada em ETAPA 9 por Regra 8
- Rebalanceamento e swaps não criarão violações que invalidam a escala
- Menos retries necessários = geração mais rápida e consistente

