## Plano: incluir todas as férias (não só "aprovada") no bloqueio do gerador de folgas

### Causa raiz

Em `src/components/ferias/folgas/GeradorFolgasDialog.tsx`, a query `feriasAtivas` (linhas 194–209) busca férias do mês mas filtra por uma lista fechada de status:

```ts
.in("status", ["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_andamento", "em_gozo"])
```

Qualquer férias com status fora dessa lista — em especial **`"pendente"`** (usado em vários pontos do sistema, como `ConsultaGeralTab`, `ContadorPDFGenerator`, `PeriodosAquisitivosTab`) — é simplesmente ignorada pelo gerador de folgas. Resultado:

- Lidianne tem férias em maio, mas a férias dela está com status `"pendente"` (ou outro status fora da lista) → o gerador não vê e a inclui na escala de folgas.
- Luccian tem férias **com `is_excecao = true`** em maio. O `is_excecao` é uma flag separada e independente do `status`. Se o status dela for `"pendente"` (ou qualquer um fora da whitelist), o filtro também a descarta — exatamente o comportamento descrito ("está pegando o período de férias do contador e não verificando o período de exceção").

Importante: o campo `is_excecao` NÃO é considerado em lugar nenhum dessa query. As férias-exceção só "valem" para o gerador de folgas se o status delas estiver dentro da whitelist — o que não acontece quando ficam `"pendente"`.

### Correção

**Arquivo único alterado**: `src/components/ferias/folgas/GeradorFolgasDialog.tsx`

#### 1. Remover o filtro de status restritivo (linhas 194–209)

Trocar o `.in("status", [...])` por uma lista que inclua **todos** os status que representam férias agendadas/em curso, e excluir apenas os terminais que realmente liberam o colaborador:

- Manter: `aprovada`, `pendente`, `em_gozo_q1`, `q1_concluida`, `em_gozo_q2`, `em_andamento`, `em_gozo`
- Excluir explicitamente os terminais via `.not("status", "in", "(cancelada,reprovada,concluida)")` em vez de whitelist.

Critério: se existe um registro em `ferias_ferias` cobrindo o mês e o status NÃO é cancelado/reprovado/concluído, ele BLOQUEIA folga. É a regra mais segura e cobre exatamente o cenário relatado (status `"pendente"`).

#### 2. Adicionar `is_excecao` e `status` ao SELECT (para diagnóstico)

Incluir `id, is_excecao, status, excecao_motivo` no `.select(...)` da query e expandir a interface `FeriasAtivas` para refletir isso. Não muda a lógica de bloqueio (qualquer férias do mês bloqueia, exceção ou não — exatamente o que o usuário quer), mas permite mostrar no diagnóstico "Férias no mês (exceção)" quando aplicável, ajudando a entender o motivo da exclusão.

#### 3. Ajuste cosmético no diagnóstico

Em `exclusionReasons` (linha ~434), quando o motivo é "Férias no mês", anexar "(exceção)" se a férias correspondente tiver `is_excecao = true`. Pequeno, mas evita confusão futura.

### Verificações que NÃO precisam mudar

- `countVacationDaysInMonth`, `shouldSkipDueToTwoMonthVacation`, `hasFullMonthVacation`, `isColabOnVacation` — todas iteram sobre o array `feriasAtivas`. Uma vez que a query traga os registros corretos, todas elas funcionam automaticamente, incluindo para férias-exceção.
- Outras queries do arquivo (afastamentos, perdas, etc.) — não têm relação com este bug.
- `vacationGenerator.ts` e `FeriasDialog.tsx` — não precisam ser tocados. A criação de férias continua igual.

### Resultado esperado após o deploy

- Lidianne (férias `"pendente"` em maio) → detectada → excluída da escala de folgas com motivo "Férias no mês".
- Luccian (férias-exceção em maio, qualquer status não-terminal) → detectada → excluída com motivo "Férias no mês (exceção)".
- Comportamento idêntico para qualquer outro colaborador com férias agendadas, independente do status (exceto cancelada/reprovada/concluída).

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ferias/folgas/GeradorFolgasDialog.tsx` | Trocar whitelist de status por blacklist (excluir só cancelada/reprovada/concluída); incluir `is_excecao` e `status` no SELECT; rotular diagnóstico de exceção |
