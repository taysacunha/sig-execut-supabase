## Revisão: "60 dias" no dialog Gerenciar Períodos — Nammos (local externo)

Meu plano anterior estava errado: descrevi o ramo interno, mas Nammos é **externo** e usa `period_specific_day_configs` (com UNIQUE em `period_id, specific_date`), então o cenário "linhas duplicadas por weekday" não se aplica aqui.

### O que sabemos do código (externo, linhas 1273–1296 de `LocationPeriodTree.tsx`)

```ts
if (specificConfigs.length > 0) {
  configCount = specificConfigs.length;          // caminho A
} else if (dayConfigs.length > 0) {
  for (const dayConfig of dayConfigs) {
    configCount += countWeekdayOccurrences(      // caminho B
      period.start_date, period.end_date, dayConfig.weekday
    );
  }
}
```

Julho tem 31 dias. "60" ≈ 2 × 31. Três hipóteses viáveis (ainda não consigo saber qual sem olhar o dado real do Nammos, pois não tenho ferramenta de read query nesta sessão):

- **H1 — caminho A duplicado por período errado no map:** `specificDateConfigsByPeriod[period.id]` está agrupando por `config.period_id`; se existirem **dois `location_periods` de julho** para Nammos (ex.: um vazio + um preenchido, ou duplicata antiga), cada card mostraria seu próprio N — mas se apenas 1 card apareceu com 60, essa hipótese cai.
- **H2 — caminho A com `specific_date` duplicado semanticamente por timezone:** UNIQUE(period_id, specific_date) impede dupes exatos, mas se algum fluxo antigo gravou o mesmo dia com "2026-07-15" **e também com "2026-07-14"** por shift UTC, viraria 2 registros distintos. Cada dia contaria duas vezes → ~62. Precisa confirmar em dado real.
- **H3 — caminho B (fallback weekday) com `period.end_date` estendido:** se `end_date` ficou salvo como "2026-08-31" (ex.: erro em edição/mudança de modo), 7 weekdays × ocorrências em 2 meses ≈ 62.

### Como quero prosseguir

**Passo 1 — coletar evidência antes de mudar código.** Peço que rode no SQL Editor (só leitura) e me traga o retorno:

```sql
-- Ajuste o nome se for outro
WITH loc AS (SELECT id FROM public.locations WHERE name ILIKE '%nammos%')
SELECT lp.id AS period_id, lp.start_date, lp.end_date,
       (SELECT count(*) FROM public.period_specific_day_configs s WHERE s.period_id = lp.id) AS n_specific,
       (SELECT count(*) FROM public.period_day_configs d WHERE d.period_id = lp.id) AS n_weekday
FROM public.location_periods lp
WHERE lp.location_id IN (SELECT id FROM loc)
  AND lp.start_date <= '2026-07-31' AND lp.end_date >= '2026-07-01';

SELECT specific_date, count(*) 
FROM public.period_specific_day_configs
WHERE period_id IN (
  SELECT lp.id FROM public.location_periods lp
  JOIN public.locations l ON l.id = lp.location_id
  WHERE l.name ILIKE '%nammos%' AND lp.start_date <= '2026-07-31' AND lp.end_date >= '2026-07-01'
)
GROUP BY specific_date ORDER BY specific_date;
```

Isso identifica em segundos qual hipótese é a verdadeira (n_specific=60? Duas linhas de period? end_date estranho? Datas repetidas?).

**Passo 2 — corrigir de acordo com o resultado.** Já com a causa confirmada, alteração cirúrgica:

- Se **H1** (dois period rows): consolidar/remover o período órfão e adicionar `UNIQUE (location_id, start_date, end_date)` em `location_periods` para evitar recorrência.
- Se **H2** (specific_date "vizinhos" duplicados por TZ): normalizar as duplicatas existentes e revisar toda leitura/gravação de datas para usar parsing explícito local (evitar `new Date("YYYY-MM-DD")` sem sufixo).
- Se **H3** (`end_date` fora do mês): corrigir a linha `location_periods` afetada e adicionar validação no `createPeriodMutation` garantindo que `end_date = último dia do mês do start_date`.

**Passo 3 — reforço defensivo no display** (independente da causa, barato):
- Em `LocationPeriodTree.tsx`, no caminho A, contar `new Set(specificConfigs.map(c => c.specific_date)).size` em vez de `.length` bruto.
- No caminho B, deduplicar `dayConfigs` por `weekday` antes do `for`.
- No caminho B, clamp de `start_date`/`end_date` ao mês/ano do período (rejeitar intervalos maiores que ~31 dias com aviso no console).

### Fora do escopo
- Não vou mexer no ramo interno nem em geração de escalas antes de confirmar a causa.
- Nenhum `DELETE` em massa sem revisar o retorno das queries acima.

Me responda com o retorno das duas queries (ou apenas o print) para eu partir para a correção certa.
