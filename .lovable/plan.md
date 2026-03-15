## Concluído: Alocação por Níveis com Gate Obrigatório

### Implementado

1. **Alocação por 4 níveis** — substitui passes 1-5 por loop nível 1→4
   - Nível 1: todos recebem 1º externo
   - Nível 2: todos recebem 2º externo
   - Nível 3: GATE (globalMin ≥ 2?) → 3º externo
   - Nível 4: GATE (globalMin ≥ 3?) → 4º externo
2. **maxAllowedExternals em findBrokerForDemand** — impede broker acima do nível atual
3. **Chain swaps entre níveis** — tenta maximizar cobertura antes de avançar nível
4. **Rebalanceamento com 2-hop chains** — cadeia over→mid→under quando swap direto falha
5. **MAX_REBALANCE_SWAPS** de 20 → 40
6. **MAX_EXTERNAL_SHIFTS_HARD_CAP** de 3 → 4 (só via gate nível 4)
