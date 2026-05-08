## Diagnóstico

Os logs mostram quase só ações do Bruno porque **as tabelas do módulo Férias não têm gatilhos de auditoria anexados no banco**.

O que encontrei:

1. A função `audit_module_changes()` foi atualizada para reconhecer tabelas `ferias_*` (em `.lovable/ferias_audit_triggers_migration.sql`).
2. Mas essa migration **nunca foi movida para `supabase/migrations/`**, então o `CREATE TRIGGER ... ON ferias_*` provavelmente nunca rodou em produção.
3. As migrations efetivamente aplicadas (`20260114175221_*.sql`) só anexam triggers em tabelas de **Escalas, Vendas e Sistema** (`brokers`, `locations`, `schedule_assignments`, `generated_schedules`, `sales`, `sales_brokers`, `sales_teams`, `broker_evaluations`, `monthly_leads`, `proposals`, `user_roles`, `system_access`).
4. Resultado: quando a Germana edita colaboradores, folgas, férias, afastamentos, setores substitutos etc. → **nenhum log é inserido**. Os únicos logs do dia são os do Bruno em outros módulos (Escalas/Vendas/Sistema), por isso parece que "só o Bruno" aparece.

A política de SELECT (`Users can view own module audit_logs`) está correta — quem tem acesso a `ferias` enxerga **todos** os logs do módulo, então o problema não é visibilidade, é **ausência de inserção**.

## Correção

Criar uma nova migration timestamped em `supabase/migrations/` que:

1. **Atualiza `public.audit_module_changes()`** com a versão que classifica tabelas `ferias_*` no módulo `ferias` (mesmo conteúdo do arquivo `.lovable/ferias_audit_triggers_migration.sql`, idempotente via `CREATE OR REPLACE`).

2. **Anexa triggers `AFTER INSERT/UPDATE/DELETE`** em todas as tabelas relevantes do módulo Férias, com `DROP TRIGGER IF EXISTS` antes de cada `CREATE TRIGGER` para ser idempotente:
   - `ferias_colaboradores`
   - `ferias_ferias`
   - `ferias_folgas`
   - `ferias_folgas_escala`
   - `ferias_folgas_creditos`
   - `ferias_folgas_perdas`
   - `ferias_afastamentos`
   - `ferias_setores`
   - `ferias_equipes`
   - `ferias_cargos`
   - `ferias_unidades`
   - `ferias_feriados`
   - `ferias_formulario_anual`
   - `ferias_gozo_periodos`
   - `ferias_periodos_quitados`
   - `ferias_setor_chefes`
   - `ferias_colaborador_setores_substitutos`
   - `ferias_configuracoes`
   - `ferias_quinzenas`
   - `ferias_conflitos` (se existir)

3. Não altera nenhuma policy nem dado existente — apenas garante que toda edição futura seja registrada com o `changed_by` / `changed_by_email` correto do usuário autenticado.

## Observação importante

- Os logs **anteriores** das alterações da Germana **não podem ser recuperados** — eles nunca foram gravados. A correção vale a partir da aplicação da migration.
- Se a Germana edita algo via Edge Function que usa `service_role`, o log aparecerá como `sistema@interno` (sem `auth.uid()`). Se isso acontecer, será necessário ajuste adicional para propagar o usuário.

## Arquivo a criar

- `supabase/migrations/{timestamp}_ferias_audit_triggers.sql` — conteúdo derivado de `.lovable/ferias_audit_triggers_migration.sql`, com a lista de tabelas acima.

Nenhuma alteração de frontend é necessária.
