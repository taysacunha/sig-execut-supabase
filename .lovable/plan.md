## Correção: período de julho do Nammos com 29 datas de junho vazadas

### Diagnóstico confirmado

Duas linhas em `location_periods` para Nammos:

| period_id | intervalo | `n_specific` | esperado |
|---|---|---|---|
| `898a66b1…` | 2026-06-01 → 2026-06-30 | 29 | 29 (junho, faltando 24/06) |
| `0b1086b8…` | 2026-07-01 → 2026-07-31 | **60** | 31 |

O período de julho carrega, além dos 31 dias corretos (01–31/jul), **29 configs com `specific_date` em junho** (idênticas às do período de junho). O UNIQUE `(period_id, specific_date)` não bloqueia porque cada dupla é única em si — mas essas datas estão fora do intervalo `start_date`/`end_date` do período. Por isso o card exibe "60 dias".

Como isso passou: não existe validação (nem no frontend nem no banco) garantindo que `period_specific_day_configs.specific_date` caia dentro do intervalo do próprio período. Algum fluxo de edição/duplicação/recriação de período gravou linhas com o `period_id` novo mas datas do mês anterior.

### O que fazer

**1. Limpar o dado do Nammos (via insert tool):**

```sql
DELETE FROM public.period_specific_day_configs
WHERE period_id = '0b1086b8-f0b7-4653-ba53-8302bdee217c'
  AND (specific_date < '2026-07-01' OR specific_date > '2026-07-31');
```

Antes do DELETE, um SELECT com o mesmo WHERE para conferir que traz exatamente 29 linhas.

**2. Varredura global** (para descobrir se outros períodos têm o mesmo vazamento):

```sql
SELECT sc.period_id, lp.location_id, l.name, lp.start_date, lp.end_date,
       count(*) AS fora_do_intervalo
FROM public.period_specific_day_configs sc
JOIN public.location_periods lp ON lp.id = sc.period_id
JOIN public.locations l ON l.id = lp.location_id
WHERE sc.specific_date < lp.start_date OR sc.specific_date > lp.end_date
GROUP BY sc.period_id, lp.location_id, l.name, lp.start_date, lp.end_date
ORDER BY fora_do_intervalo DESC;
```

Se aparecerem outros períodos, aplicamos o mesmo DELETE parametrizado. Caso a lista seja grande, faço um único DELETE em massa que remove todas as configs fora do intervalo do respectivo período.

**3. Prevenir recorrência — banco (migration):**

Adicionar um trigger `BEFORE INSERT OR UPDATE` em `period_specific_day_configs` que:
- Busca `start_date`/`end_date` do `period_id` referenciado.
- Levanta `EXCEPTION` se `NEW.specific_date NOT BETWEEN start_date AND end_date`.

Trigger (não CHECK) porque a validação depende de outra tabela, seguindo a regra do projeto de usar validation triggers.

Também adicionar em `location_periods` um trigger `AFTER UPDATE OF start_date, end_date` que rejeita a alteração se sobrarem configs específicas fora do novo intervalo (evita "encolher" o mês deixando lixo).

**4. Prevenir recorrência — frontend:**

Em `src/components/LocationPeriodTree.tsx`:
- Nas mutations que gravam `period_specific_day_configs` (criação e edição), filtrar/validar que toda `specific_date` está dentro de `[start_date, end_date]` do período; abortar com toast caso contrário.
- Nas mutations de `location_periods` que alteram datas, validar que `start_date` e `end_date` pertencem ao mesmo `(ano, mês)` (o formulário já usa `new Date(year, month, 0)` na criação, mas confirmar que edição respeita a mesma regra).

**5. Ajuste de display já aplicado no turno anterior fica:** a contagem no card agora deduplica por `Set` e filtra datas fora do intervalo — funciona como cinto+suspensório caso um dado inconsistente reapareça no futuro.

### Fora do escopo
- Não vou mexer em geração de escalas nem em `period_day_configs` (weekday) — os `n_weekday=7` são esperados.
- Não vou remover o período de junho; ele está correto (29 dias configurados, 24/06 propositalmente vazio).

### Ordem de execução no build
1. SELECT de verificação das 29 linhas em Nammos.
2. DELETE das 29 linhas.
3. SELECT de varredura global; se houver outros casos, DELETE em massa.
4. Migration com os dois triggers de validação.
5. Patch em `LocationPeriodTree.tsx` com validações client-side + toast.
6. Confirmar visualmente no preview que o card do Nammos julho mostra "31 dias".
