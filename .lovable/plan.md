## Objetivo

Tornar claro, em telas e no PDF do contador, o que é informação enviada ao **contador** (períodos oficiais e dias vendidos) e o que é o **gozo interno real** (datas que o colaborador efetivamente goza). Hoje os dois ficam misturados nos dialogs de exceção e o PDF do contador exibe os dias vendidos sem indicar o período correto.

---

## Mudanças

### 1. FeriasDialog — divisor visual Contador x Interno (apenas em exceção)

Arquivos: `src/components/ferias/ferias/FeriasDialog.tsx`, `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`.

- Quando **não é exceção**, manter o layout atual (não há divisão — o que vai ao contador é o que será gozado).
- Quando **é exceção** (`is_excecao = true`):
  - Envolver a SEÇÃO 2 (Cards "1º Período" e "2º Período" — `quinzena1/quinzena2`) em um bloco com cabeçalho destacado:
    - Título: **"Enviado ao contador"** + ícone `FileCheck` + descrição curta ("Períodos oficiais que constarão no relatório do contador").
    - Borda/fundo sutil (ex.: `border-primary/30 bg-primary/5`) para identidade visual.
  - Envolver a SEÇÃO 3 de exceção (`ExcecaoPeriodosSection`) em outro bloco com cabeçalho:
    - Título: **"Gozo interno (real)"** + ícone `CalendarClock` + descrição ("Datas que o colaborador efetivamente vai gozar — não vão ao contador").
    - Borda/fundo distinto (ex.: `border-amber-500/30 bg-amber-500/5`) para contraste claro.
  - Adicionar um separador visual entre os dois blocos (linha + chip "Sistema interno").

### 2. Seleção de qual período recebe os dias vendidos no modo exceção

Hoje, no modo padrão (`isVendaPadrao`), o gestor já escolhe `quinzena_venda` (1º ou 2º). No modo **exceção tipo "vender"**, o `quinzena_venda` é definido implicitamente pelo `distribuicaoTipo` ("1", "2", "ambos", "livre"), mas quando é `"ambos"` ou `"livre"` o sistema não registra a qual período oficial os 10 dias vendidos pertencem — por isso o PDF do contador fica ambíguo.

Em `ExcecaoPeriodosSection.tsx`, quando `excecaoTipo === "vender"` e `diasVendidos > 0`:

- Adicionar um seletor obrigatório **"Período da venda (para o contador)"** com opções `1º Período` / `2º Período` (ocultar 1º quando `q1JaGozada`).
- Persistir essa escolha no campo `quinzena_venda` da tabela `ferias_ferias` (campo já existe). A lógica de submit em `FeriasDialog.tsx` (linhas ~1158-1205) deve passar a usar esse valor ao invés de derivar do `distribuicaoTipo` quando a distribuição for "ambos" ou "livre".
- Para `distribuicaoTipo === "1"` ou `"2"`, pré-preencher e travar o seletor com o período correspondente (mantendo consistência).

### 3. ContadorPDFGenerator — exibir período da venda corretamente

Arquivo: `src/components/ferias/relatorios/ContadorPDFGenerator.tsx`.

A função `getDiasVendidosSelecionado` já filtra por `quinzena_venda`, mas faltam dois ajustes:

- **Modo "Ambos" (PDF e preview)**: na coluna "Dias Vend.", quando `dias_vendidos > 0`, exibir o valor com sufixo do período: ex. `10 (1º)` ou `10 (2º)`. Aplicar o mesmo no Badge da tabela de preview (linhas 442-446).
- **Modo "1ª Quinzena" / "2ª Quinzena"**: a função já zera os dias vendidos quando o período da venda é o outro — confirmar que a query/filtro não inclui registros sem férias relevantes ao período. Corrigir o cálculo em `getDiasGozoSelecionado` para que, no modo single-period, **não desconte** dias vendidos do outro período (já está correto, mas adicionar teste manual com registro `quinzena_venda=2` filtrado em "1ª Quinzena": deve mostrar 15 dias gozo e 0 dias vendidos).
- Atualizar o rodapé/legenda do PDF: trocar "Dias vendidos limitados a 10..." por "Dias vendidos: o sufixo (1º/2º) indica em qual período aquisitivo a venda foi alocada."

### 4. Migration / dados legados

Não é necessária migration — campo `quinzena_venda` já existe. Para registros existentes em modo exceção com `distribuicaoTipo` "ambos"/"livre" o valor pode estar como `1` por default; o gestor poderá ajustar reabrindo o dialog e selecionando o período correto. Adicionar uma nota no AlertDescription do bloco "Enviado ao contador" para registros antigos: "Verifique o período da venda antes de enviar ao contador."

---

## Detalhes técnicos

- Reaproveitar `Card`/`CardHeader`/`CardTitle` já importados em `FeriasDialog.tsx` para os blocos "Enviado ao contador" e "Gozo interno (real)".
- O seletor novo em `ExcecaoPeriodosSection` usa `Select` do shadcn (já importado no projeto). Adicionar prop `quinzenaVenda: number` + `onQuinzenaVendaChange` na interface, controlado pelo `FeriasDialog` via novo `useState` espelhando `form.watch("quinzena_venda")`.
- Ajustar `onSubmit` (linhas ~1158-1205 em `FeriasDialog.tsx`) para sempre enviar `quinzena_venda` quando `vender_dias = true`, inclusive no caminho de exceção.
- No PDF (`generatePDF`), formatar a célula "Dias Vend." como `${dias}${dias > 0 ? ` (${quinzena_venda}º)` : ""}` somente em `showingAmbos`.
- Sem alterações de schema/RLS.

---

## Arquivos afetados

- `src/components/ferias/ferias/FeriasDialog.tsx`
- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`
- `src/components/ferias/relatorios/ContadorPDFGenerator.tsx`
