# Prevenção: "Corretores sem alocação por dia" no relatório de validação

Objetivo: quando um corretor não recebe plantão em um dia em que ele teria disponibilidade, o relatório passa a explicar o motivo (feriado/data excluída, turno não configurado, sem vínculo com local, bloqueado por regra), evitando dúvidas como a do dia 05/08.

## O que será feito

1. Nova aba **"Sem alocação"** no painel de validação (ao lado de Por corretor / Por regra / Diagnóstico / Elegibilidade).
2. A aba mostra uma grade por **dia da semana gerada**, e dentro de cada dia a lista de corretores que ficaram sem nenhum plantão naquele dia, com um selo de motivo:
   - **Feriado / data excluída** — a data está em `period_excluded_dates` para os períodos vigentes (motivo com maior prioridade; se o dia todo está excluído, mostra um aviso único no topo do dia em vez de listar corretor por corretor).
   - **Sem turno configurado** — nenhum local tem turno configurado para aquele dia (`period_day_configs` / `period_specific_day_configs`).
   - **Fora da disponibilidade** — o corretor não tem o dia/turno em `available_weekdays` / `weekday_shift_availability` (global ou por local).
   - **Bloqueado por regra** — há disponibilidade, mas o gerador rejeitou; mostra as regras vindas do trace de geração (`brokerDiagnostics` / `eligibilityExclusions`) daquele dia.
   - **Sem motivo identificado** — fallback, destacado como aviso para investigação.
3. Filtro por corretor (campo de busca) e opção de ocultar dias totalmente excluídos.
4. Resumo no topo: nº de dias com exclusão, nº de corretores sem alocação no período, nº de casos "sem motivo identificado".

## Detalhes técnicos

- Novo módulo `src/lib/unallocatedBrokersReport.ts` com uma função pura `buildUnallocatedBrokerReport(input)` que recebe: assignments da escala, brokers com disponibilidade, `location_brokers`, `period_excluded_dates`, `period_day_configs` / `period_specific_day_configs`, intervalo de datas e o trace de geração; devolve `{ days: [{ date, fullyExcluded, excludedReason, brokers: [{ id, name, reason, details }] }], summary }`.
- Novo componente `src/components/validation/UnallocatedBrokersTab.tsx` (usa Collapsible/Badge/ScrollArea, no padrão atual do painel) e um hook `useUnallocatedBrokersData(scheduleId)` que busca os dados de apoio no Supabase (somente leitura).
- `src/components/ValidationReportPanel.tsx`: adicionar `"unallocated"` ao tipo `ViewMode`, o botão da aba e o render da nova aba; receber via props `scheduleId`, `weekStart`, `weekEnd`.
- `src/pages/Schedules.tsx`: passar `scheduleId` e as datas da escala selecionada para o `ValidationReportPanel`.
- Sem alterações de banco de dados nem de escrita — a aba é puramente informativa.
