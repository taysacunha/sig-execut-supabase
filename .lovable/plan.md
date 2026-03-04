

## Plano Completo - 5 Funcionalidades (Revisão Final)

---

### Funcionalidade 1: Calendário abre no mês selecionado

**Problema:** Ao criar um período (ex: maio/2026), o dialog do calendário abre em março/2026 (mês atual).

**Solução:** Em `LocationPeriodTree.tsx`, no `onSuccess` do `createPeriodMutation` (linha 248), antes de abrir o dialog, definir `setCalendarMonth(new Date(data.year, data.month - 1, 1))`. Atualmente isso só é feito no `handleEditPeriod` (linha 459-460) e `handleOpenCalendar` (linha 534-535), mas falta no create.

**Arquivo:** `LocationPeriodTree.tsx` (linha ~248-256)

---

### Funcionalidade 2: Bloquear períodos duplicados

**Problema:** É possível adicionar o mesmo mês/ano duas vezes para o mesmo local.

**Solução:** Em `LocationPeriodTree.tsx`, antes de chamar `createPeriodMutation.mutate()`, verificar se já existe um período com o mesmo mês/ano na lista `periods` carregada pela query. Se existir, exibir `toast.error("Já existe um período para este mês/ano neste local!")` e não prosseguir.

**Arquivo:** `LocationPeriodTree.tsx` (no handler de submit do form de período)

---

### Funcionalidade 3: Auto-preenchimento de horários + banner informativo

**Problema:** Ao configurar turnos de um novo mês, os horários vêm com valores padrão em vez de herdar do período anterior.

**Solução:**
- Ao criar um novo período, buscar o período mais recente do mesmo local (por `start_date` descendente) que já tenha configurações de turno
- Separar por tipo de dia: weekday (seg-sex), sábado, domingo
- Preencher os campos de horário com os valores do período anterior
- Exibir um **banner informativo** no dialog, ex: `ℹ️ Horários carregados do período de Fevereiro/2026`
- No `SpecificDateShiftDialog`, quando `initialConfig` é null (novo dia), passar os horários sugeridos como prop `suggestedConfig` com a referência do mês de origem
- O banner desaparece se o usuário alterar os horários manualmente

**Arquivos:** `LocationPeriodTree.tsx`, `SpecificDateShiftDialog.tsx`

---

### Funcionalidade 4: Campo "Observações" na escala e no PDF

**Problema:** Não existe campo para observações na visualização da escala.

**Solução:**

**4a. Migração SQL** - Criar tabela `schedule_observations`:
```sql
CREATE TABLE schedule_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES generated_schedules(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(schedule_id)
);
ALTER TABLE schedule_observations ENABLE ROW LEVEL SECURITY;
-- Policies para escalas viewers/editors (SELECT/INSERT/UPDATE/DELETE)
```

**4b. UI** - Em `ScheduleCalendarView.tsx`, abaixo da legenda de horários (final do componente, antes do `</div>` final), adicionar:
- Um `Textarea` editável com label "Observações"
- Auto-save com debounce (upsert na tabela `schedule_observations`)
- Query para carregar observações existentes pelo `schedule_id`
- Será necessário receber `scheduleId` como nova prop

**4c. PDF** - Em `SchedulePDFGenerator.tsx`, abaixo da legenda, renderizar o conteúdo das observações se existir. Também receberá `scheduleId` como nova prop para carregar dados.

**4d. Schedules.tsx** - Passar o `selectedScheduleId` como prop para `ScheduleCalendarView` e `SchedulePDFGenerator`.

**Arquivos:** Migração SQL, `ScheduleCalendarView.tsx`, `SchedulePDFGenerator.tsx`, `Schedules.tsx`

---

### Funcionalidade 5: Aniversariantes nos dashboards de Escalas e Vendas

**Problema:** Aniversariantes só aparecem no sistema de Férias. Quer ver nos dashboards de Escalas e Vendas também.

**Estratégia de dados:** Reutilizar `birth_date` da tabela `sales_brokers` (fonte única). Sem criar campo novo em `brokers`.

**5a. Dashboard Escalas** (`Dashboard.tsx`):
- Nova query: buscar `brokers` ativos (nomes) + buscar `sales_brokers` ativos com `birth_date` no mês selecionado
- Cruzar por nome para identificar quais corretores de escalas fazem aniversário
- Renderizar Card "Aniversariantes do Mês" com icone de bolo, nome e dia
- Se for hoje, badge "Hoje!" em destaque

**5b. Dashboard Vendas** (`VendasDashboard.tsx`):
- Nova query direta: `sales_brokers` ativos com `birth_date` no mês/ano selecionado
- Mesmo visual: Card com lista de aniversariantes

**Arquivos:** `Dashboard.tsx`, `VendasDashboard.tsx`

---

### Resumo de alterações

| Arquivo | Alterações |
|---------|-----------|
| `LocationPeriodTree.tsx` | setCalendarMonth no create, validação duplicata, auto-fill horários + banner |
| `SpecificDateShiftDialog.tsx` | Nova prop `suggestedConfig` com mês de origem |
| `ScheduleCalendarView.tsx` | Campo Observações com auto-save, nova prop `scheduleId` |
| `SchedulePDFGenerator.tsx` | Renderizar observações no PDF, nova prop `scheduleId` |
| `Schedules.tsx` | Passar `scheduleId` para CalendarView e PDFGenerator |
| `Dashboard.tsx` | Card aniversariantes cruzando brokers + sales_brokers |
| `VendasDashboard.tsx` | Card aniversariantes de sales_brokers |
| **Migração SQL** | Tabela `schedule_observations` com RLS |

