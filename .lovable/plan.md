
Objetivo: corrigir a regressão do PDF de plantões para que corretoras com agenda livre, como a Lisandra, apareçam no PDF mesmo sem nenhuma alocação na semana.

1. Origem real do problema
- O erro voltou porque o PDF ainda depende de `scheduleAssignments`.
- Em `src/pages/Schedules.tsx`, o componente `<SchedulePDFGenerator />` só é renderizado quando `scheduleAssignments.length > 0`.
- Em `src/components/SchedulePDFGenerator.tsx`, a lista `sortedBrokers` também é montada apenas a partir das alocações:
  - `assignments.map(a => a.broker.id)`
- Resultado:
  - se a corretora está na escala, mas sem plantões por estar com agenda livre, ela some do PDF
  - a tela normal não sofre tanto porque `ScheduleCalendarView` já busca corretores ativos do banco

2. Ajuste principal
- Fazer o PDF receber a lista de corretores da escala, não apenas as alocações.
- A fonte correta para isso é a relação da escala com os corretores, via `schedule_brokers` + `brokers`.

3. Alterações planejadas
- `src/pages/Schedules.tsx`
  - adicionar uma query para buscar os corretores vinculados à escala selecionada em `schedule_brokers`
  - renderizar o `<SchedulePDFGenerator />` mesmo quando não houver alocações, desde que exista uma escala selecionada
  - passar a nova prop com a lista de corretores da escala para o PDF
- `src/components/SchedulePDFGenerator.tsx`
  - adicionar prop para receber os corretores da escala
  - mudar a construção de `sortedBrokers` para priorizar:
    1. corretores vindos de `schedule_brokers`
    2. fallback para corretores presentes em `assignments`
  - manter a lógica que já desenha uma linha vazia com “-” quando o corretor não tem nenhum turno
- `src/components/ScheduleCalendarView.tsx`
  - revisar a consistência com o PDF
  - se necessário, alinhar a origem dos corretores para evitar divergência entre tela e impressão

4. Regra funcional esperada
- Se a Lisandra estiver vinculada à escala e não tiver nenhuma alocação:
  - ela deve aparecer no PDF
  - com a linha do nome e células vazias/“-”
- Se houver alocações:
  - continua aparecendo normalmente com Manhã/Tarde
- Se a pessoa não estiver vinculada à escala:
  - não deve aparecer

5. Observação importante
- O problema não parece ser “agenda livre” em si.
- O problema é que o PDF está usando “quem teve alocação” como critério para decidir “quem existe na escala”.
- A correção precisa trocar esse critério para “quem está vinculado à escala”.

6. Validação após implementar
- Selecionar uma escala com uma corretora em agenda livre e zero alocações
- Confirmar que:
  - o nome aparece na visualização impressa/PDF
  - o nome aparece com linha vazia
  - o restante dos corretores com alocação continua correto
- Testar também uma escala totalmente sem alocações para verificar se o PDF ainda consegue abrir com a lista de corretores da escala

Detalhes técnicos
- Arquivos principais:
  - `src/pages/Schedules.tsx`
  - `src/components/SchedulePDFGenerator.tsx`
  - possivelmente `src/components/ScheduleCalendarView.tsx`
- Ponto exato da regressão:
  - `src/pages/Schedules.tsx` bloqueia o PDF com `scheduleAssignments.length > 0`
  - `src/components/SchedulePDFGenerator.tsx` monta `sortedBrokers` só com base em `assignments`
- Direção da correção:
  - usar `schedule_brokers` como fonte oficial de pessoas da escala
  - usar `schedule_assignments` apenas para preencher os turnos
