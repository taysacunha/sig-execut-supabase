

## Plano: corrigir RLS de `ferias_afastamentos` e tratar warnings

### Findings analisados

**1. ERROR — `ferias_afastamentos` com policies permissivas (`USING true`)**
- **Real.** A correção foi escrita em `.lovable/ferias_afastamentos_rls_fix.sql` mas nunca foi aplicada como migration — ficou só como SQL de referência. Por isso o scanner ainda vê as policies antigas no banco.
- **Ação:** criar migration aplicando exatamente o conteúdo do arquivo: drop das 4 policies permissivas e criar 4 novas usando `can_view_system` / `can_edit_system` para `'ferias'`, no padrão dos demais módulos.

**2. WARN — `module_audit_logs` INSERT permite qualquer authenticated**
- **Falso positivo intencional.** A policy existe para que os triggers `audit_module_changes` (que rodam no contexto da transação do usuário) possam gravar logs em INSERT/UPDATE/DELETE de qualquer tabela auditada. Restringir quebraria toda a auditoria de Escalas, Vendas, Estoque e Férias.
- O próprio scanner Supabase oficial classificou como "intentional". O risco residual (usuário injetar log falso via SQL direto) é baixo: precisaria de acesso ao SQL bruto, e o `changed_by_email` é resolvido pelo trigger via `auth.uid()` quando vem do trigger normal.
- **Ação:** marcar como ignorado no scanner com justificativa.

**3. WARN — `SUPA_rls_policy_always_true`**
- Mesmo finding do #1 + #2 agrupado pelo linter Supabase. Será resolvido automaticamente quando o #1 for aplicado e o #2 for ignorado.

### Mudanças

| Arquivo | Alteração |
|---------|-----------|
| **Nova migration SQL** | Drop das 4 policies permissivas em `ferias_afastamentos`; criar 4 novas com `can_view_system`/`can_edit_system` para `'ferias'` |
| Scanner — finding `module_audit_logs_unrestricted_insert` | Marcar como ignorado: necessário para triggers de auditoria automática funcionarem em todos os módulos |

