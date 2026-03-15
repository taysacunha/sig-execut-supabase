

## Plano: Priorizar alocação TOTAL de externos antes de qualquer interno

### Diagnóstico real (confirmado no código)

O problema central é a **ordem de execução** e **o gate global bloqueando indevidamente**:

1. **ETAPA 8.11 (passe final de externos) roda DEPOIS de ETAPA 8.10 (internos seg-sex)** — linhas 4052-4207 são internos, linhas 4209-4260 são o passe final. Ou seja, internos seg-sex criam conflitos de turno que impedem alocação de externos no passe final.

2. **O gate `canAnyoneStillReachTwo` (linha 830) bloqueia 3º externo** mesmo quando os corretores "under two" NÃO conseguem pegar as demandas pendentes (são elegíveis para OUTRAS demandas, não as que faltam). O gate retorna `canReach: true` e impede a alocação, deixando demandas sem corretor.

3. **`checkAbsoluteRules` (linha 976) hard-blocka na REGRA 1** (`>= MAX_EXTERNAL_SHIFTS_PER_WEEK = 2`) nos passes 1-5, impedindo que Andrea (ou qualquer um) chegue a 3 mesmo com demanda pendente. Só na ETAPA 9 isso é relaxado, mas aí o gate trava.

4. **Na ETAPA 9, a compensação dinâmica (linha 3927) também usa `>= MAX_EXTERNAL_SHIFTS_PER_WEEK`** para filtrar corretores de compensação — ou seja, quem já tem 2 NÃO entra na compensação dinâmica, anulando o efeito.

### Mudanças (arquivo: `src/lib/scheduleGenerator.ts`)

#### 1. Trocar ordem: ETAPA 8.11 ANTES de ETAPA 8.10

Mover o bloco do passe final de externos (linhas 4209-4260) para ANTES dos internos seg-sex (linhas 4052-4207). Isso garante que TODOS os externos sejam alocados antes de qualquer interno consumir slots.

#### 2. Corrigir gate global para verificar elegibilidade REAL por demanda

Na função `canAnyoneStillReachTwo` (linha 830), o gate diz "pode" mas ninguém é alocado. Correção: verificar se o broker under-two é elegível **especificamente para pelo menos uma das demandas pendentes** usando as MESMAS regras que `findBrokerForDemand` usa (incluindo sábado interno, sábado externo, Bessa, etc.). Também verificar Regra 8 (consecutivos) que hoje é verificada em `checkInviolableRules` mas não nos bloqueios soft de `findBrokerForDemand`.

#### 3. Relaxar gate quando há demandas sem saída

Quando o gate diz `canReach: true` mas nenhuma das demandas pendentes consegue ser alocada a nenhum broker under-two (tentativa real falha), forçar liberação do gate para permitir 3º externo. Hoje o código cai no diagnóstico (linha 4020) e para.

#### 4. Compensação dinâmica: usar HARD_CAP, não PER_WEEK

Na ETAPA 9, substituir `MAX_EXTERNAL_SHIFTS_PER_WEEK` por `MAX_EXTERNAL_SHIFTS_HARD_CAP` nos filtros de compensação (linhas 3852, 3884, 3927). Isso permite que corretores com 2 externos recebam o 3º quando necessário para cobertura.

#### 5. Passes 1-5: permitir 3º externo no pass 4-5 para quem precisa de compensação

Em `checkAbsoluteRules` (linha 976), quando `pass >= 4` e o broker tem `workedSaturdayLastWeek` ou é `saturdayInternalWorker`, relaxar o limite de 2 para 3 (usar `HARD_CAP` em vez de `PER_WEEK`). Isso dá à Andrea a chance de pegar o 3º antes do último recurso.

#### 6. Diagnóstico final: se ainda houver pendências, explicar com motivo real

Manter os logs de diagnóstico atuais mas adicionar tentativa REAL de alocação no final — se impossível, logar motivo específico por broker por demanda.

### Resumo da ordem corrigida

```text
ETAPA 5:    Passes 1-5 (externos, regras normais, pass 4-5 relaxa para compensação)
ETAPA 8.6:  Rebalanceamento 2-antes-3
ETAPA 8.8:  Desconsecutivar + Chain Swap
ETAPA 8.9:  Internos SÁBADO
ETAPA 9:    Último recurso (gate inteligente + compensação dinâmica corrigida)
ETAPA 8.11: Passe final de externos (MOVIDO PARA ANTES dos internos)
ETAPA 8.10: Internos SEG-SEX (ÚLTIMO — só depois que TODOS os externos foram resolvidos)
```

### Regras preservadas (não mexo)
- Nunca mesmo corretor manhã+tarde no mesmo local externo
- Regra 9 (sáb OU dom)
- Regra 6 (construtora)
- Regra 4 (dois locais externos no mesmo dia)
- Hard cap de 3 externos
- Proteção Bessa

