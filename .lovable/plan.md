

## Rastreio Exclusivo Andrea: Diagnóstico Forense Completo

### Por que as soluções anteriores estavam erradas

As correções anteriores (gate global, Bessa mapping, etc.) são mudanças **sistêmicas** — afetariam TODOS os corretores igualmente. Se o problema fosse o gate, outros corretores também ficariam com 1 externo. Mas é SÓ Andrea. Isso significa que o problema está em algo **exclusivo** à configuração ou posição dela no fluxo de alocação.

### O que falta no diagnóstico atual

O diagnóstico atual (`brokerDiagnostics`) só captura **rejeições por regras** — quando Andrea foi avaliada e uma regra a bloqueou. Mas NÃO captura o caso mais provável:

**Andrea era elegível, passou em todas as regras, mas OUTRO corretor foi escolhido antes dela** (porque estava mais alto na ordenação).

Cenário provável:
```text
1. Andrea está vinculada a poucos locais externos (ex: 2-3)
2. Esses locais têm outros corretores elegíveis também
3. Demanda do Local X é processada → Andrea está na posição 3 da fila
4. Broker A (posição 1) é escolhido → demanda alocada
5. Andrea perde essa oportunidade sem nenhuma "rejeição" registrada
6. Suas poucas demandas restantes caem em dias consecutivos → Rule 8 bloqueia
7. Resultado: 1 externo
```

### Plano: Rastreio ponta-a-ponta para corretores subalocados

**Arquivo:** `src/lib/scheduleGenerator.ts`

Adicionar um trace dedicado que, para cada corretor que termina com <2 externos, mostra:

1. **Quantas demandas ela é elegível** (total de vezes que aparece em `eligibleBrokerIds`)
2. **Ordem de processamento**: em que momento cada demanda elegível dela foi processada
3. **Para cada demanda elegível**:
   - Se foi **alocada para outro**: quem foi escolhido e qual era a posição de Andrea na fila naquele momento
   - Se Andrea **foi rejeitada por regra**: qual regra e por quê
   - Se a demanda **ficou sem alocação**: por quê
4. **Após a 1ª alocação**: quais demandas restantes ela PODERIA pegar, e o que especificamente impede (Rule 8? Outro broker na frente? Demanda já tomada?)
5. **`saturdayInternalWorkers`**: se Andrea está neste set (reservada para sábado interno de Tambaú), isso elimina demandas de sábado nos passes 1-3

### Implementação técnica

No loop de alocação (passes 1-5, linhas 3332-3365), para cada demanda processada:
- Verificar se a demanda tem Andrea nos `eligibleBrokerIds`
- Se sim, registrar:
  - `sortPosition`: posição de Andrea no `sortedQueue` filtrado
  - `selectedBroker`: quem foi escolhido (se não foi Andrea)
  - `andreaRuleBlock`: se Andrea foi avaliada e bloqueada, qual regra
  - `andreaExternalCountAtTime`: quantos externos Andrea tinha naquele momento

Salvar este trace no `brokerDiagnostics` existente com um campo `competitionTrace` adicional.

### O que isso vai revelar

- Se Andrea **perde por ordenação** (outcompeted) → o fix é ajustar prioridade para quem tem poucos locais configurados
- Se Andrea **perde por regras** → o fix é relaxar a regra específica que a bloqueia
- Se Andrea **tem poucas demandas elegíveis** → o problema é configuração de dados (poucos vínculos)
- Se Andrea **está em saturdayInternalWorkers** → ela perde sábado, e se seus outros locais caem em dias consecutivos, fica com 1

### Resultado

Um diagnóstico que mostra EXATAMENTE por que Andrea especificamente termina com 1 externo, sem alterar nenhuma lógica de alocação. Com essa informação, a correção será cirúrgica e correta.

