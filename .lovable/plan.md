## Problema

No diálogo de Férias, quando a colaboradora tem o 1º período aquisitivo já gozado (ex.: Maria de Lourdes), o sistema força automaticamente `distribuicaoTipo = "2"`. Porém, os campos "Data de início" e "Data de fim" do 2º período não aparecem renderizados — só aparecem após o usuário clicar em "Livre" e voltar para "2º Período".

## Causa

Em `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`, o useEffect que inicializa o array `periodos` (linhas 212–245) só dispara quando `distribuicaoTipo` muda. No fluxo afetado:

1. A hidratação termina já com `distribuicaoTipo = "2"` (forçado por `q1JaGozada` ou herdado do registro), mas `periodos = []` (não havia registros prévios em `ferias_gozo_periodos`).
2. Como `distribuicaoTipo` não muda mais de valor, o useEffect de inicialização nunca executa.
3. O bloco de renderização `(distribuicaoTipo === "2") && periodos.length === 1` permanece falso, ocultando os campos de data.
4. Ao alternar para "Livre" → "2º Período", `distribuicaoTipo` muda duas vezes, o useEffect dispara e cria o item com `referencia_periodo: 2`.

## Correção

Adicionar um useEffect de **reconciliação pós-hidratação** em `ExcecaoPeriodosSection.tsx`, logo após o useEffect de inicialização existente. Esse novo efeito:

- Roda apenas após `isHydrating === false`.
- Detecta inconsistência entre `distribuicaoTipo` e `periodos`:
  - `distribuicaoTipo === "1" | "2" | "livre"` mas não há item com a `referencia_periodo` esperada (1, 2 ou 0).
  - `distribuicaoTipo === "ambos"` mas faltam itens com referência 1 e/ou 2.
- Quando inconsistente, gera a estrutura inicial usando exatamente a mesma lógica do useEffect de inicialização (mesmos valores de `dias`, `referencia_periodo`, etc.) — para "vender" usa `diasGozo`; para "gozo_diferente" usa 15.
- Não interfere na edição normal: se já existe pelo menos um item com a referência esperada, não faz nada.

Isso cobre tanto o cenário de Q1 já gozada (forçando "2") quanto qualquer outro caso em que a hidratação deixe `distribuicaoTipo` definido sem `periodos` correspondentes.

## Arquivo modificado

- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx` — adicionar o useEffect de reconciliação.
