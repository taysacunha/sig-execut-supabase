## Diagnóstico

### Caso 1 — Rejane (10 vendidos no 1º + 5 vendidos no 2º)

**Causa: limitação do modelo de dados, não bug de cálculo.**

A tabela `ferias_ferias` só guarda **um único** par `dias_vendidos` + `quinzena_venda`. Não existe campo para "vendeu X dias na Q1 e Y dias na Q2 ao mesmo tempo". O `FeriasDialog.tsx` reflete isso: o usuário escolhe **uma** quinzena de venda e **um** total de dias vendidos.

O que provavelmente foi cadastrado para a Rejane: `dias_vendidos = 15` com `quinzena_venda = 1` (ou 2). Quando isso chega no `PremiacaoDialog`, a função `diasVendidosRealPorPeriodo` decide assim:

- `total = 15` → coloca os 15 inteiros na quinzena marcada como venda; a outra fica com 0 vendidos e 15 usufruídos.

Por isso ao abrir a premiação do 1º período aparece "15 usufruídos": o sistema acredita que a venda inteira foi do outro período. Não há como, no estado atual, dizer "10 vendidos aqui, 5 vendidos lá" — só "15 num lado só".

### Caso 2 — Diego (vendeu 20 dias, mas a tela mostra dois períodos)

**Causa: ao salvar venda > 15 dias, o sistema mantém as datas oficiais da Q2 no registro, mesmo que toda a Q2 esteja vendida.**

No `FeriasDialog.tsx` (linhas 1218-1240) o payload sempre grava `quinzena2_inicio`/`quinzena2_fim` com as datas oficiais do 2º período, independente da venda. Quando a venda é > 15:

- `gozo_venda_periodos` é forçado para `"1"` (única faixa de gozo, na Q1).
- `gozo_quinzena1_*` recebe os 10 dias de gozo real.
- `gozo_quinzena2_*` fica `null`.
- Mas `quinzena2_inicio/fim` continua preenchido.

A listagem da página de férias (`FeriasFerias.tsx`) usa `quinzena2_inicio` para renderizar a coluna do 2º período. Resultado: aparecem dois períodos visuais, sendo que o 2º já foi 100% vendido.

---

## Resolução proposta

### Ajuste 1 — Suportar venda dividida entre Q1 e Q2 (caso Rejane)

Estender o modelo para permitir venda em **ambas** as quinzenas simultaneamente.

Opções (escolher 1 — preciso da sua decisão antes de implementar):

**A. Campos adicionais (mais simples)**

- Adicionar `dias_vendidos_q1` e `dias_vendidos_q2` em `ferias_ferias`.
- Manter `dias_vendidos`/`quinzena_venda` como derivados/legados.
- Ajustar `FeriasDialog` para, quando "vender", permitir distribuir os dias entre Q1 e Q2 (ex.: dois inputs com soma ≤ 20 e respeitando a regra do "exceção" se > 10).
- `PremiacaoDialog` passa a ler diretamente o valor por quinzena, sem inferência.

**B. Tabela auxiliar `ferias_vendas_periodos**` (mais flexível, mais trabalho)

- Cada linha = (ferias_id, quinzena, dias_vendidos).
- Útil se no futuro vierem outros desdobramentos.

Recomendação: **A** — resolve o caso real com mudança mínima.

### Ajuste 2 — Diego (vendeu 20)

Na hora de salvar venda > 15 em `FeriasDialog.tsx`:

- Se `gozo_venda_periodos === "1"` (todo o gozo na Q1), zerar `quinzena2_inicio/fim` no payload (ou marcá-los como "vendidos").
- Se `gozo_venda_periodos === "2"` (todo o gozo na Q2), zerar `quinzena1_inicio/fim`.

Na listagem de `FeriasFerias.tsx`:

- Ao montar a linha, se a quinzena correspondente tiver 0 dias de gozo real (toda vendida), exibir "—" ou um badge "Vendida" em vez do período.

Também rodar um pequeno backfill para registros existentes onde `dias_vendidos > 15` e o lado não-vendido continua com datas oficiais sem `gozo_*`.

### Arquivos impactados

- `db/migrations/` — nova migration para colunas `dias_vendidos_q1`/`dias_vendidos_q2` (caso opção A).
- `src/components/ferias/ferias/FeriasDialog.tsx` — UI de venda dividida + correção do payload para venda > 15.
- `src/components/ferias/ferias/PremiacaoDialog.tsx` — ler dias vendidos por quinzena direto dos novos campos.
- `src/pages/ferias/FeriasFerias.tsx` — render correto da quinzena totalmente vendida.
- `src/integrations/supabase/types.ts` — regenerado após migration.

### O que preciso de você

1. Confirmar a **opção A** (campos `dias_vendidos_q1`/`dias_vendidos_q2`) ou pedir B. Siga com A.
2. Confirmar que, para o caso Diego, a quinzena 100% vendida deve sumir do display (em vez de aparecer como "Vendida"). Acho interessante aparecer os dias e de que períodos foram vendidos. No caso de Diego, ele vendeu 5 dias do primeiro período e os 15 dias do segundo período, porém isso não fica claro e acaba confundido. Então quero que mostre isso. Os dois período devem aparecer, mas que fique claro os dias de cada período que foram vendidos.