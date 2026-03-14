Diagnóstico do porquê isso acontece hoje

1) A alocação é gulosa e sem backtracking entre sábado/domingo.
- Em `src/lib/scheduleGenerator.ts`, as demandas são processadas com sábado antes de domingo (`possibleDemands.sort`, prioridade sábado→domingo).
- Quando sábado é preenchido, o algoritmo não reabre decisões para “desfazer sábado e liberar domingo”.

2) A reserva de gargalo não protege cruzamento sábado↔domingo.
- O mecanismo de reserva (`mandatoryReservations`) protege a demanda específica (mesmo `date+shift`), não protege o corretor para o dia adjacente.
- Resultado: o corretor pode ser usado no sábado e depois cair na Regra 9 no domingo.

3) A Regra 9 é tratada como inviolável (corretamente), então no domingo não há relaxamento possível.
- Se o corretor ficou no sábado, ele é bloqueado no domingo e o passe final não resolve.
- Hoje não existe etapa “trocar sábado para liberar domingo”.

Isso explica exatamente o seu caso: existe solução viável por realocação (Leonardo→Daniela no sábado e Leonardo no domingo), mas o gerador atual não tenta essa manobra.

Implementação proposta (para eliminar solução manual)

A) Proteger domingo ainda durante a escolha de sábado (lookahead real de fim de semana)
- Arquivo: `src/lib/scheduleGenerator.ts`
- Adicionar uma checagem antes de aceitar um corretor para sábado:
  - “Se eu alocar este corretor no sábado, alguma demanda de domingo ficará sem nenhum elegível?”
- Se sim, bloquear esse corretor para o sábado (desde que exista alternativa de sábado válida).
- Isso evita consumir um corretor “crítico de domingo” cedo demais.

B) Nova etapa de “Weekend Rescue Swap” antes de declarar não alocado
- Arquivo: `src/lib/scheduleGenerator.ts`
- Criar uma etapa após passes normais e antes do relatório final:
  1. Para cada demanda de domingo não alocada, listar elegíveis.
  2. Identificar elegíveis bloqueados apenas por terem sábado.
  3. Para cada um, tentar realocar o plantão de sábado dele para outro corretor válido.
  4. Se a realocação do sábado for válida, alocar o domingo no corretor liberado.
- Garantias:
  - Não violar regras invioláveis (Regra 4/6/9, hard cap, conflitos físicos, elegibilidade).
  - Não deixar buraco no sábado (só com substituição válida).
- Essa etapa cobre o cenário que você descreveu sem intervenção manual.

C) Melhorar justificativa de não alocação
- Arquivo: `src/lib/scheduleGenerator.ts` (trecho que preenche `_unallocatedReason`)
- Quando domingo ficar sem corretor, incluir diagnóstico explícito:
  - “Bloqueado por Regra 9 devido a alocação de sábado” e
  - “swap sábado→domingo tentado/sucesso/falha”.
- Isso deixa claro por que não alocou e evita sensação de “ignorou possibilidade”.

D) Teste dirigido para o caso real
- Arquivos:
  - `src/lib/scheduleGenerator.ts` (extração de helper puro para swap de fim de semana)
  - `src/test/...` (novo teste)
- Cenário de teste:
  - Domingo Setai sem alocação inicial.
  - Leonardo elegível para domingo, mas preso no sábado.
  - Daniela elegível no sábado e livre.
  - Esperado: sábado migra para Daniela e domingo aloca Leonardo.

Critérios de aceite

1) No caso citado, o gerador deve realizar automaticamente a troca e cobrir o domingo 22/03.
2) Não pode criar novas violações invioláveis.
3) Relatório de não alocados deve explicar claramente quando houve bloqueio por Regra 9 e se swap foi tentado.
4) Em semanas sem necessidade, comportamento atual de distribuição/FIFO deve permanecer estável.

Risco controlado e mitigação

- Risco: aumentar custo computacional.
- Mitigação: limitar o rescue swap a demandas de domingo não alocadas e busca local (não global completa), com early stop ao encontrar primeira solução válida.

Resultado esperado para seu exemplo

- O sistema passará a fazer exatamente a lógica que você descreveu: realocar sábado quando isso for necessário para cobrir domingo, em vez de exigir correção manual.