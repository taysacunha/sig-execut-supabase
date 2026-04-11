

## Plano: Corrigir dashboard de férias para exibir todas as férias do mês

### Problema

O dashboard consulta `ferias_ferias` e filtra pelo mês atual, mas:

1. **Férias flexíveis ignoradas**: quando `gozo_flexivel = true`, as datas reais de gozo estão em `ferias_gozo_periodos`, não nas colunas `quinzena*` ou `gozo_quinzena*`. O dashboard nunca consulta essa tabela.

2. **Status `concluida` excluído**: o filtro `.in("status", ["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_gozo"])` exclui férias que já foram marcadas como concluídas pela função automática, mesmo que o período de gozo inclua o mês atual.

3. **"Próximas Férias"** tem os mesmos problemas.

### Correções em `src/pages/ferias/FeriasDashboard.tsx`

#### 1. Adicionar `concluida` ao filtro de status
Em ambas as queries ("férias este mês" e "próximas férias"), incluir `"concluida"` na lista de status.

#### 2. Buscar `ferias_gozo_periodos` para férias flexíveis
Após buscar `ferias_ferias`, fazer uma segunda query em `ferias_gozo_periodos` para os registros com `gozo_flexivel = true`. Na filtragem por mês, usar os períodos reais de `ferias_gozo_periodos` quando disponíveis.

#### 3. Lógica de overlap atualizada
Na função de filtro do mês:
- Se `gozo_flexivel = true` e existem registros em `ferias_gozo_periodos`: verificar se algum sub-período faz overlap com o mês
- Se `gozo_diferente = true`: usar `gozo_quinzena*` (como já faz)
- Senão: usar `quinzena*` (como já faz)

Mesma lógica para "Próximas Férias" — verificar datas de início dos sub-períodos flexíveis.

### Arquivo alterado

1. **`src/pages/ferias/FeriasDashboard.tsx`** — corrigir filtro de status + adicionar suporte a `gozo_flexivel` via `ferias_gozo_periodos`

