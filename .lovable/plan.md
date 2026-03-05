

## Plano de Ajustes - 6 Correções

### 1. Relatório Corretores mostrando dados de meses sem cadastro

**Problema:** A aba "Corretores" nos relatórios de escalas mostra corretores (Cleane, Adjane) para períodos sem dados cadastrados. A RPC `get_broker_performance_hybrid` provavelmente retorna todos os corretores ativos, mesmo sem assignments no período.

**Solução:** Em `BrokerPerformanceTab.tsx`, filtrar o resultado da query para remover corretores com `total_assignments === 0`. Isso evita mostrar corretores sem dados no período selecionado.

**Arquivo:** `src/components/reports/BrokerPerformanceTab.tsx`

---

### 2. Relatório Corretores Vendas - remover divs de vendas/observações da página

**Problema:** Em `BrokerIndividualReport.tsx`, os cards "Detalhes das Vendas" (linha 711-749) e `EvaluationDetailsPDF` (linha 753) estão visíveis na tela. Devem aparecer apenas no PDF (quando exporta), não na visualização normal.

**Solução:** Envolver essas divs com uma classe CSS que as esconde na tela mas mostra no print/PDF capture. Usar `className="hidden print:block"` ou esconder condicionalmente (mostrar somente durante captura de PDF).

**Arquivo:** `src/components/vendas/BrokerIndividualReport.tsx` (linhas 711-753)

---

### 3. Adicionar campo CRECI ao formulário de corretores de vendas + cruzar por CRECI

**Problema:** O cruzamento de aniversariantes entre `brokers` e `sales_brokers` é feito por nome, que falha quando os nomes não são exatamente iguais. A tabela `sales_brokers` não tem campo `creci` atualmente.

**Solução:**
- **Migração SQL:** `ALTER TABLE sales_brokers ADD COLUMN creci text;`
- **Formulário:** Em `SalesBrokers.tsx`, adicionar campo CRECI no form (input com máscara, opcional)
- **Dashboard Escalas:** Em `Dashboard.tsx`, alterar a query de aniversariantes para cruzar por CRECI (`brokers.creci = sales_brokers.creci`) em vez de por nome
- **Dashboard Vendas:** Sem alteração (query direta em `sales_brokers`)

**Arquivos:** Migração SQL, `src/pages/vendas/SalesBrokers.tsx`, `src/pages/Dashboard.tsx`

---

### 4. Aniversariantes não atualizam em tempo real

**Problema:** A query de aniversariantes usa `staleTime: 5min` e `refetchOnWindowFocus: false`, então não atualiza ao editar um corretor.

**Solução:** Na mutation de update do corretor em `SalesBrokers.tsx`, adicionar `queryClient.invalidateQueries({ queryKey: ["dashboard-birthdays"] })`. Também no `Dashboard.tsx`, remover ou reduzir o `staleTime` da query de aniversariantes para que revalide mais frequentemente.

**Arquivos:** `src/pages/vendas/SalesBrokers.tsx`, `src/pages/Dashboard.tsx`

---

### 5. Banner de horários herdados - mostrar data e dia da semana

**Problema:** O banner mostra apenas "Fevereiro/2026", mas o usuário quer ver a data específica e o dia da semana de onde veio o horário, ex: "25/02/2026, Terça-feira".

**Solução:** Em `LocationPeriodTree.tsx`, na função `getPreviousPeriodConfigs`, em vez de gerar label como `format(periodDate, "MMMM/yyyy")`, gerar labels por tipo de dia com a data específica e o dia da semana do config encontrado. Ex: se o weekdayConfig veio de `specific_date = "2026-02-25"`, mostrar `"25/02/2026, Terça-feira"`. Se veio de `period_day_configs`, usar a data do período + dia da semana do config.

No `SpecificDateShiftDialog.tsx`, o banner já exibe `suggestedFromLabel`, então basta alterar o label gerado.

**Arquivos:** `src/components/LocationPeriodTree.tsx`

---

### 6. Observações não aparecem no PDF

**Problema:** O `SchedulePDFGenerator.tsx` consulta `schedule_observations` com `as any` cast. Se a tabela `schedule_observations` não foi criada no banco (migração SQL pendente do plano anterior), a query falha silenciosamente e `observationContent` fica vazio.

**Solução:** Verificar se a tabela existe. Se não existe, criar via migração. Se existe, verificar se o `scheduleId` está sendo passado corretamente (já confirmado que sim nas linhas 2098-2106 do `Schedules.tsx`). Também verificar se o `as any` cast está causando problemas de tipo - pode ser necessário regenerar os tipos do Supabase após a migração.

**Ação:** Confirmar com o usuário se a migração SQL de `schedule_observations` já foi executada. Se não, incluir na migração deste plano.

---

### Resumo de alterações

| Arquivo | Alteração |
|---------|-----------|
| `BrokerPerformanceTab.tsx` | Filtrar corretores com 0 assignments |
| `BrokerIndividualReport.tsx` | Esconder divs de vendas/avaliação na tela, manter no PDF |
| `SalesBrokers.tsx` | Adicionar campo CRECI + invalidar query de birthdays |
| `Dashboard.tsx` | Cruzar por CRECI, ajustar staleTime dos birthdays |
| `LocationPeriodTree.tsx` | Label com data específica e dia da semana |
| **Migração SQL** | `ALTER TABLE sales_brokers ADD COLUMN creci text` |
| **Migração SQL** | Criar `schedule_observations` se não existir |

