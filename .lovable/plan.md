
Plano: corrigir o card "Próximas Férias" para considerar também o 2º período

Diagnóstico
- O problema está isolado no card de "Próximas Férias" em `src/pages/ferias/FeriasDashboard.tsx`.
- Hoje a query desse card busca apenas dados do 1º período (`quinzena1_inicio` / `gozo_quinzena1_inicio`) e a lógica só verifica esse início.
- Se a Taysa estiver com início em `24/04` no 2º período (`quinzena2_inicio` ou `gozo_quinzena2_inicio`), ela nunca entra no filtro.
- Isso explica por que ela pode existir no sistema e ainda assim não aparecer especificamente nesse card.

O que vou ajustar
1. Expandir a query de `proximasFerias`
- Incluir também:
  - `quinzena2_inicio`
  - `gozo_quinzena2_inicio`
  - opcionalmente os `*_fim` para manter a estrutura consistente

2. Trocar a lógica de "pegar só um início" por "pegar o próximo início válido"
- Para cada registro de férias:
  - se `gozo_flexivel = true`: usar os períodos de `ferias_gozo_periodos`
  - se `gozo_diferente = true`: considerar `gozo_quinzena1_inicio` e `gozo_quinzena2_inicio`
  - senão: considerar `quinzena1_inicio` e `quinzena2_inicio`
- Filtrar todas as datas de início entre hoje e +30 dias
- Escolher a menor delas como `inicio` exibido no card

3. Manter 1 item por férias no card
- Mesmo que existam dois períodos, o card continua mostrando apenas a próxima data relevante daquele registro
- Exemplo: se o 1º período já passou e o 2º começa em 24/04, o card deve mostrar 24/04

4. Evitar nova divergência
- Extrair uma pequena função helper dentro do próprio `FeriasDashboard.tsx` para resolver os inícios possíveis
- Assim a regra fica mais clara e reduz chance de voltar a quebrar

Arquivo a alterar
- `src/pages/ferias/FeriasDashboard.tsx`

Validação após implementar
- Confirmar que aparece:
  1. férias com início no 1º período
  2. férias com início no 2º período
  3. férias com `gozo_diferente`
  4. férias com `gozo_flexivel`
- Verificar especificamente o caso da Taysa com início em 24/04 no card "Próximas Férias"
