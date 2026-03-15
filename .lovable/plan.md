
Diagnóstico objetivo: o problema não é “só azar” nem um bloqueio exclusivo cadastrado para Andrea. O código hoje trata a Regra 8 de forma inconsistente, e isso atinge mais forte quem tem poucas janelas elegíveis restantes após o 1º externo.

O que encontrei no `src/lib/scheduleGenerator.ts`:
1. `checkAbsoluteRules()` ainda trata dias consecutivos como bloqueio absoluto (`linhas 1060-1068`).
2. Ao mesmo tempo, existe `checkTrulyInviolableRulesWithRelaxation()` (`linhas 600+`) dizendo que a Regra 8 é relaxável.
3. Ou seja: o fluxo principal continua barrando Andrea antes da lógica relaxada entrar em ação.
4. O “resgate” posterior também está incompleto: a ETAPA 8.6 só roda se existir alguém com `3+` externos (`linhas 3342+`). Então pode sobrar demanda externa, Andrea ficar com 1, e mesmo assim o rebalanceamento nem tentar corrigir.

Por que parece ser “só ela”:
- Andrea provavelmente recebe o 1º externo cedo na semana.
- As demandas em que ela ainda seria elegível depois disso caem em dias adjacentes ao já alocado.
- Como a Regra 8 ainda está absoluta no fluxo principal, ela morre ali.
- Outros corretores têm mais combinações não consecutivas e continuam sendo considerados.
- Se ninguém chegou a 3, a etapa de recuperação não entra, então sobram externos sem alocação e Andrea continua travada em 1.

Plano de correção, cirúrgico:
1. Remover a Regra 8 de `checkAbsoluteRules()`.
   - Esse helper deve ficar só com regras realmente absolutas.
   - Hoje ele contradiz a própria arquitetura nova do arquivo.

2. Fazer `findBrokerForDemand()` aplicar a Regra 8 pelo helper relaxável.
   - Após passar nas regras absolutas, usar `checkTrulyInviolableRulesWithRelaxation(...)`.
   - Permitir relaxamento da Regra 8 quando o corretor ainda está abaixo de 2 externos.
   - Manter sem relaxamento para quem já atingiu 2.

3. Corrigir a ETAPA 8.6 para não depender de existir corretor com 3+.
   - Se há demanda externa não alocada e existe corretor com `<2`, a etapa deve tentar completar 2.
   - Hoje essa condição está errada e deixa plantão sobrando mesmo com corretor subalocado.

4. Revisar logs de diagnóstico final.
   - Exibir explicitamente, por corretor com `<2`, quantas demandas foram barradas por:
     - Regra 8
     - conflito físico
     - construtora
     - sábado/domingo
   - Isso evita nova análise enganosa.

5. Corrigir log enganoso do Tambaú.
   - O log em `linhas 2873-2875` diz `target externo = 1`, mas a lógica atual não faz isso mais.
   - Isso está poluindo o diagnóstico e precisa ser alinhado com o comportamento real.

Resultado esperado:
- Andrea deixa de ficar artificialmente presa em 1 quando o 2º externo só é possível via consecutivo simples.
- Plantões externos pendentes passam a ser preenchidos antes de aceitar sobra injustificada.
- Nenhuma regra realmente absoluta será afrouxada: continuam intactas as de conflito físico, mesmo dia em outro local externo, construtora, sábado/domingo e 3 dias consecutivos.

Detalhe técnico importante:
- A falha principal não é “uma regra específica contra Andrea”.
- É um bug de fluxo: a Regra 8 continua absoluta no ponto errado do algoritmo, e a etapa corretiva só roda tarde e sob condição errada.
