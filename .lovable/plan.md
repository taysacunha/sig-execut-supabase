## Concluído: Weekend Rescue Swap + Sunday Lookahead

### Implementado

1. **ETAPA 8.85 - Weekend Rescue Swap** — Após passes 1-5 e de-consecutivização, identifica domingos não alocados onde o corretor elegível está bloqueado por ter sábado externo. Tenta trocar o plantão de sábado para outro corretor válido e libera o original para o domingo.
2. **Sunday Lookahead** — Durante a alocação de sábado (passes 1-5), verifica se usar um corretor deixaria alguma demanda de domingo sem NENHUM elegível. Se sim e há alternativa para o sábado, protege o corretor para o domingo.
3. Campos `sundayDemandsForLookahead` e `allocatedDemandsRef` adicionados ao `AllocationContext`

### Cenário resolvido
- Leonardo alocado no sábado M. Ruy Carneiro → swap para Daniela (disponível sábado, sem plantão)
- Leonardo liberado para domingo Setai
- Eliminação de correção manual

### Arquivo alterado
- `src/lib/scheduleGenerator.ts`
