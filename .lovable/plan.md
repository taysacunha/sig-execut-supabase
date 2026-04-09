

## Plano: Alertas de elegibilidade nos fluxos manuais + indicador visual + filtro de inativos

### Resumo

As alocacoes manuais continuam livres (sem bloqueio), mas o sistema passara a alertar quando o corretor nao esta vinculado/disponivel para o local escolhido. Alem disso, alocacoes feitas manualmente terao um indicador visual discreto. Corretores inativos serao filtrados de todos os fluxos manuais.

### 1. Coluna `is_manual` na tabela `schedule_assignments`

**Migration SQL**: adicionar coluna booleana `is_manual` com default `false`.

```sql
ALTER TABLE schedule_assignments ADD COLUMN is_manual boolean NOT NULL DEFAULT false;
```

Isso permite distinguir alocacoes do gerador automatico (false) de edicoes manuais (true).

### 2. Marcar alocacoes manuais nas mutations

Em `src/pages/Schedules.tsx`, adicionar `is_manual: true` nos seguintes pontos:

- `addAssignmentMutation` (insert) — linha 619
- `editLocationMutation` (update) — linhas 547, 554, 563
- `swapShiftsMutation` (update) — linhas 659, 667
- `updateBrokerMutation` (update) — linha 310
- `swapBrokersMutation` (update) — linha 268

### 3. Indicador visual na tabela de alocacoes

Em `src/pages/Schedules.tsx`, na renderizacao da tabela de alocacoes, exibir um pequeno icone ou badge discreto (ex: icone de "mao" ou "M") ao lado do nome do corretor quando `assignment.is_manual === true`. Tooltip: "Alocacao manual".

### 4. Alerta de elegibilidade no EditAssignmentDialog

Em `src/components/EditAssignmentDialog.tsx`:

- Buscar `location_brokers` para o corretor da alocacao atual
- Ao selecionar um local, verificar se o corretor esta vinculado a esse local via `location_brokers`
- Se NAO estiver vinculado: abrir AlertDialog de aviso ("O corretor X nao esta configurado como disponivel para o local Y. Deseja continuar?") com opcoes Cancelar/Prosseguir
- Se estiver vinculado mas nao tiver o turno/dia disponivel: alertar tambem
- Prosseguir salva normalmente

### 5. Alerta de elegibilidade no ScheduleSwapDialog

Em `src/components/ScheduleSwapDialog.tsx`:

- Buscar `location_brokers` dos dois corretores envolvidos
- Antes de confirmar a troca, verificar se:
  - Corretor A esta vinculado ao local do Corretor B
  - Corretor B esta vinculado ao local do Corretor A
- Se algum nao estiver: mostrar aviso no dialog de confirmacao (texto amarelo, ex: "⚠ Corretor X nao esta disponivel para o local Y")
- O usuario pode prosseguir mesmo assim

### 6. Alerta no ScheduleReplacementDialog

Em `src/components/ScheduleReplacementDialog.tsx`:

- No dialog de confirmacao, verificar elegibilidade do corretor selecionado para o local externo
- Se nao elegivel: adicionar aviso visual antes dos botoes

### 7. Filtrar inativos em todos os fluxos manuais

- `getAvailableBrokersForShift` (`src/lib/scheduleGenerator.ts` linha 5201): adicionar `.eq("brokers.is_active", true)` ou filtrar no JS
- `getBrokersFromInternalShift`: ja filtra por assignments existentes, mas adicionar filtro `broker.is_active`
- `ScheduleSwapDialog`: a query ja busca de assignments, mas filtrar `broker.is_active` no resultado
- `EditAssignmentDialog`: nao lista corretores, lista locais — OK
- `AddAssignmentDialog`: ja busca brokers ativos (verificar)

### 8. Atualizar types.ts

Regenerar ou adicionar manualmente `is_manual` ao tipo `schedule_assignments` em `src/integrations/supabase/types.ts`.

### Arquivos alterados

1. **Migration SQL** — nova coluna `is_manual`
2. **`src/integrations/supabase/types.ts`** — adicionar campo
3. **`src/pages/Schedules.tsx`** — marcar `is_manual: true` nas mutations + indicador visual na tabela
4. **`src/components/EditAssignmentDialog.tsx`** — buscar `location_brokers`, alertar se nao elegivel
5. **`src/components/ScheduleSwapDialog.tsx`** — buscar `location_brokers` dos dois corretores, alertar na confirmacao
6. **`src/components/ScheduleReplacementDialog.tsx`** — alertar elegibilidade na confirmacao
7. **`src/lib/scheduleGenerator.ts`** — filtrar `is_active` em `getAvailableBrokersForShift` e `getBrokersFromInternalShift`

