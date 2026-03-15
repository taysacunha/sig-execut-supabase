## Concluído: Status granular automático + anos dinâmicos

### Implementado

1. **Status granular** — `aprovada → em_gozo_q1 → q1_concluida → em_gozo_q2 → concluida`
2. **Utilitário `dateUtils.ts`** — `getYearOptions()`, constantes de status compartilhadas
3. **Anos dinâmicos** em 7 arquivos (range flexível ao invés de hardcoded)
4. **Queries atualizadas** em FeriasDialog, FormularioAnualDialog, CalendarioFeriasTab, GeradorFolgasDialog, FeriasDashboard
5. **Migration SQL** em `.lovable/granular_status_migration.sql` — precisa ser executada no Supabase SQL Editor
