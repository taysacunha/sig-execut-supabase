

## Bug: Observação não aparece no PDF

### Causa raiz

Dois problemas:

1. **Query key mismatch**: O `ScheduleCalendarView` salva e invalida o cache com key `["schedule-observation", scheduleId]`, mas o `SchedulePDFGenerator` usa key `["schedule-observation-pdf", scheduleId]`. Após salvar, o PDF nunca refaz a query — continua com o cache vazio.

2. **Invalidação incompleta**: Mesmo corrigindo a key, o save no CalendarView não invalida a key do PDF.

### Correção

**`src/components/ScheduleCalendarView.tsx`** (linha 76):
- Adicionar invalidação da query do PDF também: `queryClient.invalidateQueries({ queryKey: ["schedule-observation-pdf", scheduleId] });`

**Alternativa mais limpa**: Unificar as query keys — usar `["schedule-observation", scheduleId]` em ambos os componentes (CalendarView e PDFGenerator). Assim qualquer invalidação atualiza ambos automaticamente.

| Arquivo | Alteração |
|---------|-----------|
| `src/components/SchedulePDFGenerator.tsx` (linha 40) | Mudar queryKey de `["schedule-observation-pdf", scheduleId]` para `["schedule-observation", scheduleId]` |

Uma única linha resolve o problema.

