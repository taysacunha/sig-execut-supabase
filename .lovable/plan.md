
## Problema

Pedro tem férias cadastradas com 30 dias vendidos (15 no 1º período 06–20/04 e 15 no 2º período 21/04–05/05), tudo já enviado ao contador. Agora ele quer **manter o 1º período vendido** (intocável no contador) e **converter o 2º período em gozado**, com o gozo interno em julho.

Hoje isso não funciona porque:

1. O modelo de "venda" é **único por registro** (`vender_dias`, `dias_vendidos`, `quinzena_venda` apontando 1 OU 2). Não dá para dizer "P1 vendido, P2 gozado".
2. Como ele tem 30 dias vendidos (>10), ao editar entra no fluxo de exceção (`ExcecaoPeriodosSection`) — e nesse fluxo não aparece o seletor "1º/2º Período" da venda padrão (`isVendaPadrao` exige `dias_vendidos ≤ 10`), nem um interruptor para converter um único período em gozo.
3. Não há trava por período: nada impede mudar as datas do contador já enviadas, e nada permite editar só o gozo interno.

## O que vai mudar

### 1. Modelo por período (P1 e P2 independentes)

No diálogo de edição (e no de cadastro), trocar o radio único por **dois blocos**, um por período. Cada bloco tem:

- **Datas para o contador** (`quinzenaN_inicio/fim`) — 15 dias.
- **Tipo do período**: `Gozar` ou `Vender` (com nº de dias 1–15).
- **Datas reais de gozo** (`gozo_quinzenaN_inicio/fim`) — opcional quando `Gozar` e o gozo coincide com o contador; obrigatório quando o gozo for em mês diferente do contador, ou quando parte do período for vendida.

O caso "vender 30 dias" passa a ser P1=Vender 15 + P2=Vender 15. O caso do Pedro vira P1=Vender 15 (travado) + P2=Gozar 15 com gozo em julho.

### 2. Trava por "enviado ao contador"

Para cada período N, se `enviado_contador_qN = true`:

- `quinzenaN_inicio/fim` ficam **read-only**.
- Tipo do período (Gozar/Vender) e dias vendidos do período N ficam **read-only**.
- Apenas as **datas reais de gozo interno** (`gozo_quinzenaN_inicio/fim`) continuam editáveis.

### 3. Regra das datas de gozo interno vs. contador

Validação no submit e inline:

- `gozo_quinzenaN_inicio` deve ser **estritamente posterior** a `quinzenaN_fim` (gozo interno não pode ser anterior nem igual ao período enviado ao contador).
- Duração do gozo interno = (15 − dias vendidos do período).
- Continua valendo a regra de bloqueio de folgas: blocos de gozo interno consecutivos ≥15 dias bloqueiam folgas no mês.

### 4. Persistência

Manter compatibilidade com colunas existentes em `ferias_ferias`:

- Nova migration adiciona: `vender_q1 boolean default false`, `vender_q2 boolean default false`, `dias_vendidos_q1 integer`, `dias_vendidos_q2 integer`. Backfill a partir de `vender_dias` + `quinzena_venda` + `dias_vendidos`.
- Campos legados (`vender_dias`, `dias_vendidos`, `quinzena_venda`) continuam preenchidos derivados (`vender_dias = vender_q1 OR vender_q2`, `dias_vendidos = q1+q2`, `quinzena_venda = 1 só q1, 2 só q2, NULL se ambos`) para não quebrar relatórios atuais.
- `gozo_quinzena1_*` e `gozo_quinzena2_*` continuam guardando o gozo interno por período.

Migration vai em `supabase/migrations/` e em `db/migrations/` (mesmo timestamp e nome) conforme padrão definido.

### 5. Hidratação e UI

- Ao abrir um registro existente, derivar P1/P2 (tipo, dias vendidos, datas contador, datas gozo interno) das colunas novas; se nulas, derivar das antigas.
- Cards "P1" e "P2" empilhados; cada um mostra um badge "Enviado ao contador em dd/MM/aaaa" quando travado, e um aviso curto "Datas do contador travadas — só o gozo interno pode ser ajustado".
- O fluxo de "exceção/distribuição flexível" (`ExcecaoPeriodosSection`) só aparece quando o usuário marcar "Distribuição livre / múltiplos sub-períodos" — para os casos comuns (Pedro inclusive) basta o modelo P1/P2.

### 6. Validação

- Teste manual com o cenário do Pedro: P1 travado vendido, P2 alterado para Gozar com `gozo_quinzena2_inicio = 2026-07-01`, `gozo_quinzena2_fim = 2026-07-15`. Conferir que `quinzena2_inicio/fim` permanecem 21/04–05/05 no banco.
- Teste: tentar mover `gozo_quinzena2_inicio` para 2026-04-30 → erro "deve ser posterior ao período enviado ao contador (05/05/2026)".
- Teste: tentar mudar `quinzena1_inicio` com `enviado_contador_q1=true` → campo desabilitado, sem submit.

## Arquivos afetados

- `src/components/ferias/ferias/FeriasDialog.tsx` — refatorar Seção 3 (venda/gozo) para dois blocos por período + travas + validação.
- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx` — passa a ser opcional, acionado por toggle "Distribuição livre".
- `src/lib/vacationGenerator.ts` — gravar `vender_q1/q2` e `dias_vendidos_q1/q2` ao criar; manter campos legados derivados.
- `supabase/migrations/<timestamp>_ferias_venda_por_periodo.sql` (+ cópia em `db/migrations/`).
- Sem mudanças no PDF do contador (continua lendo `quinzenaN_inicio/fim`).
