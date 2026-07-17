## Revisão das Fases 2, 3 e 4 após os ajustes da Fase 1

Correções já aplicadas que impactam as próximas fases:

- `audit_module_changes()` agora insere `record_id` como `uuid` puro (sem cast para text) e usa `changed_by`/`changed_by_email`.
- `useSystemAccess.ts` reconhece `super_admin` sem depender de linha em `system_access`.
- Helpers `despesas_nivel_aba` já retornam `delete` para admin/super_admin sem linhas em `despesas_aba_permissoes`; o hook `useDespesasPermissions` já espelha isso.

Com base nisso, as Fases 2/3/4 continuam válidas, mas precisam de pequenos ajustes de padronização para evitar repetir os problemas da Fase 1.

### Ajustes obrigatórios para todas as próximas migrations

1. Toda nova tabela `despesas_*` deve ter `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`. Sem exceção — é isso que mantém o `audit_module_changes()` funcionando sem cast.
2. Toda nova tabela `despesas_*` que precisa de auditoria deve ser adicionada ao bloco `DO $$ ... FOREACH t IN ARRAY [...]` que anexa `audit_module_changes`. Manter um bloco por fase, listando somente as tabelas novas daquela fase.
3. Toda nova tabela deve ter, na mesma migration e nessa ordem: `CREATE TABLE` → `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role` → `ENABLE ROW LEVEL SECURITY` → policies. Sem `GRANT` a request falha silenciosamente com "permission denied".
4. RLS deve usar os helpers `despesas_pode_ver_aba` / `despesas_pode_editar_aba` / `despesas_pode_excluir_aba`, nunca `has_role` direto (garante que super_admin/admin funcionem e que permissões granulares valham).
5. Trigger de `updated_at` (via `handle_updated_at`) deve ser adicionado no mesmo bloco `FOREACH` para as novas tabelas.

### Fase 2 — Calendário + Formulário

Ajustes específicos:

- `despesas_lancamentos` deve ter, além do `id uuid`, coluna `centro_custo_id uuid REFERENCES public.despesas_centros_custo(id)`; a policy de SELECT precisa combinar `despesas_pode_ver_aba(auth.uid(),'calendario')` **com** `centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))`. Isso já estava na Fase 1 como intenção; formalizar aqui.
- `despesas_lancamento_pagamentos.lancamento_id uuid REFERENCES public.despesas_lancamentos(id) ON DELETE CASCADE`. Não precisa de policies próprias além de espelhar as do pai.
- Anexar `audit_module_changes` só em `despesas_lancamentos` (evitar duplicidade em pagamentos filhos).
- Duplicidade (±3 dias): manter só como query no client em Fase 2; a versão SQL mais rica fica para Fase 4.

### Fase 3 — Imóveis + Repasses

Ajustes específicos:

- `despesas_imoveis`, `despesas_imoveis_situacao_historico`, `despesas_repasses`, `despesas_repasse_creditos`, `despesas_repasse_debitos`: todas com `id uuid` e trigger de auditoria (apenas nas tabelas "pai" `despesas_imoveis` e `despesas_repasses`, para não gerar ruído no log).
- Adicionar as três abas usadas por essas tabelas (`imoveis`, `repasses`) já existem no CHECK da Fase 1 — nenhum `ALTER` necessário.
- Reports PDF/Excel reaproveitam `ExportButton` já implantado.

### Fase 4 — Recorrências, Notificações, Duplicidade, Auditoria

Ajustes específicos:

- `despesas_recorrencias` (tabela de séries) e `despesas_notificacoes_preferencias`, `despesas_notificacoes`: id uuid, trigger de auditoria apenas em `despesas_recorrencias` e `despesas_notificacoes_preferencias`. `despesas_notificacoes` não precisa auditoria (é log operacional).
- Edge function para expansão de recorrências e job diário de `a_vencer→vencido` continuam válidas, sem impacto pelos fixes.
- Painel `/despesas/auditoria` já existe (placeholder na Fase 1) e deve consumir `module_audit_logs WHERE module_name='despesas'` — que agora está correto graças ao fix do `record_id`.

### Checagem final antes de partir para Fase 2

- Aplicar mentalmente cada tabela nova aos 5 pontos acima antes de gerar SQL.
- Após rodar a migration da Fase 2, testar um INSERT em `despesas_lancamentos` para validar que o trigger de auditoria não estoura mais o erro `42804`.
- Se algum SELECT vier vazio para o próprio admin, primeira suspeita é `GRANT` faltando (não RLS).

Se você aprovar essa revisão, posso seguir para a Fase 2 já aplicando essas regras.
