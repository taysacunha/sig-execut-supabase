## Bug confirmado

No `PremiacaoDialog`, a função `diasVendidosPorPeriodo` calcula errado quando há venda concentrada em uma única quinzena. Ela assume "máximo 10 vendidos por quinzena, excedente vai para a outra" — mas esse não é o modelo real do sistema.

**Modelo real (visto em `FeriasDialog.tsx` linhas 1184-1204):**
- `dias_vendidos` ≤ 15 → **todos** os dias vendidos ficam na quinzena indicada por `quinzena_venda`. A outra quinzena tem 0 vendidos e 15 dias de gozo cheios.
- `dias_vendidos` > 15 (exceção) → venda atravessa as duas quinzenas e os dias de gozo de cada uma ficam em `gozo_venda_q1_*` / `gozo_venda_q2_*` (controlado por `gozo_venda_periodos`).

**Caso Pedro:** `dias_vendidos = 15`, `quinzena_venda = 1`.
- Esperado Q1: 15 vendidos / 0 gozados; Q2: 0 vendidos / 15 gozados.
- Atual (errado): Q1: 5 vendidos / 10 gozados; Q2: 10 vendidos / 5 gozados.

Além disso, `periodoGozoReal` devolve as datas da `quinzena1` (que, quando vendida integralmente, são datas de venda, não de gozo). Precisa diferenciar o que é gozo e o que é venda por período.

## Correções no `PremiacaoDialog.tsx`

### 1) `diasVendidosPorPeriodo(f, periodo)` — usar `quinzena_venda` corretamente

```ts
function diasVendidosPorPeriodo(f, periodo) {
  if (!f.vender_dias || !f.dias_vendidos) return 0;
  const total = f.dias_vendidos;
  const qVenda = f.quinzena_venda ?? 1;

  // Caso normal: até 15 dias, tudo na quinzena_venda.
  if (total <= 15) {
    return (periodo === qVenda ? total : 0) as CenarioVenda;
  }
  // Exceção (> 15 dias): venda atravessa quinzenas.
  // Q da venda recebe 15; restante na outra.
  if (periodo === qVenda) return 15;
  return Math.min(15, total - 15) as CenarioVenda;
}
```

Normalizar o retorno para um `CenarioVenda` válido (0|5|10|15) apenas para o `calcularPremiacao`; o número exato (ex.: 7) deve aparecer no badge "X dias vendidos · Y dias usufruídos".

### 2) `periodoGozoReal(f, gozoPeriodos, periodo)` — devolver as datas certas

Regras:
- Se `gozo_periodos` flexíveis existirem para o `periodo` → usar min/max desses (mantém o comportamento atual).
- Senão, se a quinzena foi **totalmente vendida** (`vendidosNoPeriodo === 15`) → não há "gozo" naquela quinzena: usar as datas da própria `quinzenaN` como referência do período do recibo (mostrar como o período da venda) e marcar visualmente que não há gozo (badge "venda integral, sem gozo").
- Caso contrário (gozo parcial após venda ou gozo padrão):
  - Se `gozo_diferente` e há `gozo_quinzenaN_*` → usar.
  - Senão → `quinzenaN_inicio/fim`.

### 3) Texto do resumo
Substituir "X dias vendidos · Y dias usufruídos" para refletir o resultado real:
- 15 vendidos → "15 dias vendidos · 0 dias usufruídos".
- 0 vendidos → "0 dias vendidos · 15 dias usufruídos".

### 4) Botões/UX
- Se `vendidosNoPeriodo === 0` e `vender_dias = false` (ou periodo sem venda), o cálculo entra no "cenário 0" já existente — sem mudanças.
- Se `vendidosNoPeriodo === 15`, o `calcularPremiacao` cai no ramo "vende 15" (omite linha "1/3 dos dias usufruídos"). Já suportado.

## Sem migração

Mudança puramente de frontend (`src/components/ferias/ferias/PremiacaoDialog.tsx`). Nada no banco, nada nas outras telas. Não afeta cadastro de férias nem geração de PDF (o PDF lê dos mesmos valores; ficará correto automaticamente).

## Validação manual após implementação

1. Pedro (15 vendidos em Q1, 15 gozados em Q2):
   - Premiação Q1: badge "15 dias vendidos · 0 usufruídos", datas = quinzena1 (venda).
   - Premiação Q2: badge "0 vendidos · 15 usufruídos", datas = quinzena2.
2. Caso 10 vendidos em Q2 (padrão): Q1 0/15, Q2 10/5 nas datas certas (`quinzena2_inicio/fim` venda; `gozo_quinzena2_*` ou `quinzena2_*` para os 5 de gozo).
3. Caso sem venda: ambos 0/15 (cenário 0 mantém recibo "PREMIAÇÃO + COMISSÃO 15 DIAS").