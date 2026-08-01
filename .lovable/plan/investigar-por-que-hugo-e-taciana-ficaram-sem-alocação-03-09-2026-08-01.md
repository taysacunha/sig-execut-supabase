# Investigar por que Hugo e Taciana ficaram sem alocação (03–09/08)

## Situação

Ainda não dá para afirmar a causa: não tenho acesso de leitura ao banco nesta sessão, e cada motivo de exclusão deixa um rastro diferente. A decisão de elegibilidade está em `src/lib/scheduleGenerator.ts` (`isBrokerAvailableForShiftWithReason`, ~linha 3119, e `isBrokerAvailableForInternalShift`, ~linha 4689) e já calcula o motivo. Então o primeiro passo é obter o motivo real, não mudar regra.

Hipóteses possíveis (todas verificáveis):

1. `brokers.weekday_shift_availability` da quarta sem o turno, mesmo com `wednesday` em `available_weekdays` — a regra global bloqueia mesmo que o vínculo permita.
2. `location_brokers.weekday_shift_availability` com array vazio em `wednesday` — hoje o código trata array vazio como "nenhum turno" e bloqueia.
3. Nenhum `location_periods` vigente cobrindo 03–09/08 nos locais deles, ou config do dia ausente / modo `specific_date` sem data cadastrada.
4. Corretor inativo, vínculo removido ou local inativo.
5. Regras de escala (meta de 2 externos, não-consecutivo, proteção de cobertura do Bessa) bloquearam e não sobrou demanda.

## Etapa 1 — Diagnóstico (rodar no SQL Editor e me enviar o retorno)

```sql
-- A) dados dos corretores
select id, name, is_active, available_weekdays,
       weekday_shift_availability->'wednesday' as qua_global
from brokers
where name ilike '%hugo%' or name ilike '%tacian%';

-- B) vínculos e disponibilidade por local
select b.name, l.name as local, l.location_type, l.is_active,
       lb.available_morning, lb.available_afternoon,
       lb.weekday_shift_availability->'wednesday' as qua_local
from location_brokers lb
join brokers b on b.id = lb.broker_id
join locations l on l.id = lb.location_id
where b.name ilike '%hugo%' or b.name ilike '%tacian%'
order by b.name, l.name;

-- C) períodos e configs vigentes na semana
select l.name as local, lp.start_date, lp.end_date, l.shift_config_mode,
       pdc.weekday, pdc.has_morning, pdc.has_afternoon, pdc.max_brokers_count
from location_periods lp
join locations l on l.id = lp.location_id
left join period_day_configs pdc on pdc.period_id = lp.id
where lp.start_date <= '2026-08-09' and lp.end_date >= '2026-08-03'
  and l.id in (select lb.location_id from location_brokers lb
               join brokers b on b.id = lb.broker_id
               where b.name ilike '%hugo%' or b.name ilike '%tacian%')
order by l.name, pdc.weekday;

-- D) o que a escala gerada tem para eles na semana
select b.name, sa.assignment_date, sa.shift, l.name as local
from schedule_assignments sa
join brokers b on b.id = sa.broker_id
join locations l on l.id = sa.location_id
where sa.assignment_date between '2026-08-03' and '2026-08-09'
  and (b.name ilike '%hugo%' or b.name ilike '%tacian%');
```

## Etapa 2 — Correção conforme o resultado

- Se for dado (disponibilidade vazia/errada, período faltando): ajuste pontual de cadastro, sem mexer no gerador.
- Se for o tratamento de array vazio no vínculo (hipótese 2): alinhar `isBrokerAvailableForShiftWithReason` para cair no fallback da disponibilidade global quando o array do dia no vínculo estiver vazio, em vez de bloquear.
- Se for regra de escala: manter a regra e expor o motivo na tela.

## Etapa 3 — Prevenção

Adicionar ao Relatório de Validação uma seção "Corretores sem nenhuma alocação na semana", com o motivo dominante por corretor (o gerador já coleta esses motivos), para não depender mais de SQL manual em casos assim.

## Notas técnicas

Nenhuma alteração de regra de negócio antes do retorno da Etapa 1.

&nbsp;

Executei a SQL e retornou isso: Failed to run sql query: ERROR:  42703: column sa.shift does not exist

```
LINE 30: select b.name, sa.assignment_date, sa.shift, l.name as local
```