# Hugo e Taciana sem alocação na quarta (05/08/2026)

## O que os dados mostram

Os dois **foram alocados** na semana de 03 a 09/08 (Bessa, Artsy, Nammos, Orla). O que falta é exatamente **quarta-feira, 05/08/2026**: nenhum dos dois tem registro nesse dia, em nenhum turno.

Ou seja, o problema não é "não foi alocado nada", e sim que **a quarta-feira inteira ficou vazia para eles**. Antes de mexer no gerador é preciso confirmar se a quarta está habilitada nos períodos vigentes dessa semana — isso não dá para afirmar sem consultar o banco (esta sessão não tem acesso de leitura ao banco).

## Etapa 1 — Diagnóstico (rodar no SQL Editor)

```sql
-- A) A quarta 05/08 recebeu QUALQUER alocação (de qualquer corretor)?
select l.name as local, sa.shift_type, count(*)
from schedule_assignments sa
join locations l on l.id = sa.location_id
where sa.assignment_date = '2026-08-05'
group by 1,2 order by 1,2;

-- B) Períodos vigentes em 05/08 e config da quarta
select l.name as local, lp.id as period_id, lp.start_date, lp.end_date,
       pdc.weekday, pdc.has_morning, pdc.has_afternoon
from location_periods lp
join locations l on l.id = lp.location_id
left join period_day_configs pdc on pdc.period_id = lp.id and pdc.weekday = 'wednesday'
where lp.start_date <= '2026-08-05' and lp.end_date >= '2026-08-05'
order by l.name;

-- C) Datas/turnos excluídos em 05/08
select l.name as local, ped.*
from period_excluded_dates ped
join location_periods lp on lp.id = ped.period_id
join locations l on l.id = lp.location_id
where ped.excluded_date = '2026-08-05';

-- D) Disponibilidade dos dois (global e por local)
select b.name, b.available_weekdays,
       l.name as local, lb.available_morning, lb.available_afternoon,
       lb.weekday_shift_availability
from brokers b
left join location_brokers lb on lb.broker_id = b.id
left join locations l on l.id = lb.location_id
where b.name ilike '%hugo%' or b.name ilike '%tacian%'
order by b.name, l.name;
```

## Etapa 2 — Correção conforme o resultado

- **A vazio e B sem quarta habilitada** (`has_morning`/`has_afternoon` falsos ou sem linha): é configuração de período, não bug. Correção nos cadastros de período dos locais.
- **C com exclusão de 05/08**: comportamento correto do gerador; nada a corrigir no código.
- **A com alocações de outros corretores e D com quarta disponível para os dois**: aí sim é bug de seleção. Investigar em `src/lib/scheduleGenerator.ts` as regras que podem descartá-los na quarta (limite semanal de plantões, rodízio/fila do local, folga, conflito interno/externo) e ajustar a regra que os elimina indevidamente.

## Etapa 3 — Prevenção

Adicionar ao relatório de validação (`ValidationReportPanel.tsx`) uma seção **"Corretores sem alocação por dia"**: para cada dia da escala, listar os corretores com disponibilidade naquele dia que não receberam nenhum turno, com o motivo registrado pelo gerador. Assim esse tipo de dúvida se resolve na tela, sem SQL.

## Observação

Também ficaram sem alocação Hugo em 09/08 (domingo) e Taciana em 08/08 (sábado). Se era esperado terem plantão nesses dias, as mesmas queries A–D (trocando data e weekday) apontam a causa.