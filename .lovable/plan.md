
Objetivo: corrigir o gerador para respeitar exatamente as datas excluídas cadastradas pelo usuário em cada local/período, sem transformar isso em bloqueio global.

1. Confirmar a origem do problema
- Hoje o gerador lê `period_excluded_dates` e monta `excludedDatesMap` por `period_id`.
- A aplicação das exclusões já existe em `src/lib/scheduleGenerator.ts`:
  - externos: `isDayFullyExcluded(activePeriod.id, dateStr)` e `isShiftExcluded(...)`
  - internos sábado e seg-sex: mesma lógica
- Então o erro não é “falta de regra global”, e sim algum desencontro entre:
  - o período onde a data foi cadastrada
  - o período ativo encontrado na geração
  - ou o fluxo/tela onde o usuário entende que cadastrou a exclusão, mas ela não está sendo refletida no local esperado

2. Ajustar a regra para bater com o que o usuário cadastrou
- Manter a exclusão por local/período, como você pediu.
- Revisar o algoritmo para, ao gerar uma data de um local:
  - localizar o período ativo desse local
  - consultar apenas as exclusões daquele período/local
  - pular o dia inteiro quando a exclusão for total
  - desligar apenas manhã/tarde quando a exclusão for parcial
- Não adicionar nenhuma agregação global de datas.

3. Fechar a brecha provável do fluxo de configuração
- Revisar o cadastro de exclusões no fluxo de períodos internos em `src/components/InternalPeriodConfigDialog.tsx`.
- Deixar explícito no plano de implementação que a exclusão deve sempre ficar vinculada ao `period_id` correto do local que está sendo editado.
- Validar também o fluxo de `LocationPeriodTree` para garantir que o período aberto para edição é mesmo o período mensal correto do local, evitando salvar exclusão em outro contexto e depois gerar em um período diferente.

4. Melhorar rastreabilidade no gerador
- Incluir logs/trace mais claros em `src/lib/scheduleGenerator.ts` para cada data excluída respeitada:
  - local
  - período
  - data
  - tipo da exclusão: dia inteiro / manhã / tarde
- Isso facilita identificar rapidamente quando o usuário cadastrou a exclusão em um local/período e a geração consultou outro.

5. Melhorar a clareza na interface
- Em `InternalPeriodConfigDialog.tsx`, deixar o texto mais explícito para o usuário:
  - que a exclusão vale para aquele período daquele local
  - e que “Dia inteiro”, “Manhã” e “Tarde” impactam a geração exatamente nesses turnos
- Se necessário, também exibir o intervalo do período no cabeçalho do diálogo para reduzir confusão.

6. Validação esperada após implementar
- Se o usuário excluir 03/04/2026 e 04/04/2026 em um local específico:
  - esse local não deve receber plantões nesses dias/turnos excluídos
  - outros locais só devem ser afetados se também tiverem exclusão cadastrada
- Se a exclusão for só manhã:
  - tarde continua podendo gerar
- Se a exclusão for dia inteiro:
  - o local é totalmente pulado naquele dia

Detalhes técnicos
- Arquivos principais:
  - `src/lib/scheduleGenerator.ts`
  - `src/components/InternalPeriodConfigDialog.tsx`
  - possivelmente `src/components/LocationPeriodTree.tsx`
- Pontos já existentes no código:
  - `excludedDatesMap`
  - `isDayFullyExcluded(periodId, dateStr)`
  - `isShiftExcluded(periodId, dateStr, shift)`
- Direção correta:
  - reforçar a correspondência local/período/data
  - evitar qualquer solução “global”
  - melhorar diagnóstico e texto da UI para refletir exatamente o comportamento cadastrado
