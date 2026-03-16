
Objetivo: parar de “caçar Andrea” individualmente e corrigir o motor que está tratando Andrea como possibilidade falsa, mantendo o gate global fechado e deixando plantões sem alocação.

1. Causa raiz que encontrei
- O problema não é “só Andrea”. Andrea vira o sintoma porque o gate global usa os corretores com menos de 2 externos como referência.
- Em `src/lib/scheduleGenerator.ts`, os helpers `canAnyoneStillReachTwo()` e `canExceedLimit()` ainda consideram um corretor como “ainda pode receber” usando só `checkTrulyInviolableRulesWithRelaxation(...)`.
- Esses helpers não aplicam o mesmo conjunto completo de bloqueios reais usado na alocação principal:
  - `checkAbsoluteRules(...)`
  - bloqueios de sexta/sábado
  - proteção do Bessa
  - demais travas operacionais do fluxo principal
- Resultado:
  - o sistema acredita que Andrea “ainda pode chegar a 2”
  - então bloqueia o 3º externo de outros corretores
  - mas, na hora real de alocar, Andrea continua impossível
  - sobra demanda sem alocação

2. Segundo bug real
- Na ETAPA 9 ainda existem caminhos que fazem `allocateDemand(...)` sem validar `checkAbsoluteRules(...)` antes:
  - bloco de re-tentativa após o gate em `3965+`
  - bloco de “compensação dinâmica” em `4011+`
- Isso deixa o comportamento inconsistente: em alguns pontos o motor considera a demanda possível sem passar pelo mesmo critério rígido do fluxo principal.

3. O que vou corrigir
- Unificar a noção de “corretor realmente pode receber esta demanda”.
- Criar um helper único, usado por:
  - `findBrokerForDemand`
  - `canAnyoneStillReachTwo`
  - `canExceedLimit`
  - ETAPA 9 PASSO 2
  - compensação dinâmica
- Esse helper vai avaliar exatamente as mesmas regras reais da alocação final, na mesma ordem, para evitar “possibilidade fantasma”.

4. Implementação
- Arquivo: `src/lib/scheduleGenerator.ts`
- Ajustes:
  1. Extrair uma função única de elegibilidade operacional real para demanda pendente.
  2. Fazer `canAnyoneStillReachTwo()` usar essa função, não só a checagem relaxada.
  3. Fazer `canExceedLimit()` usar essa função também.
  4. Antes de cada `allocateDemand(...)` na ETAPA 9 PASSO 2 e na compensação dinâmica, aplicar a mesma checagem completa.
  5. Logar explicitamente quando o gate global estiver preso por um corretor “quase elegível”, informando a regra real que o impede.

5. Resultado esperado
- Andrea só continuará segurando o gate se ela realmente puder receber.
- Se ela não puder de verdade, o gate libera e os plantões restantes poderão ir para quem já tem 2.
- Isso deve atacar diretamente o cenário de “4 plantões não alocados apesar de haver corretor disponível”.

6. Escopo mínimo
- Foco apenas no motor de geração.
- Não vou mexer em UI nem em diagnóstico visual agora, a não ser que seja necessário para expor a regra bloqueadora.
- A prioridade é parar a inconsistência lógica que está queimando créditos em tentativas cegas.
