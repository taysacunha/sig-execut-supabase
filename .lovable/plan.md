## Causa

No filtro que implementei, incluí a regra "super_admin aparece em qualquer módulo" porque tecnicamente têm acesso a tudo. Bruno tem linha explícita em `system_access` para `despesas`; Fabia, Germana e Marcia são super_admins (sem linha em `system_access` para despesas), por isso aparecem também.

Isso não corresponde à sua expectativa: você quer ver só quem foi explicitamente habilitado no módulo.

## Correção

Em `src/pages/UserManagement.tsx`, no `useMemo` `usersFilteredByModule`:

- Remover a condição `if (u.role === "super_admin") return true;`.
- Passar a filtrar estritamente por presença de linha em `u.systems` com o `system_name` selecionado (e, se aplicável, `permission_type`).

Assim, ao filtrar por Despesas, aparecerá apenas Bruno (e qualquer outro usuário com registro explícito em `system_access`), independentemente do papel.

Observação: super_admins continuarão visíveis quando o filtro estiver em "Todos os módulos" e continuarão tendo acesso real ao sistema via `SystemGuard` — a mudança é apenas de exibição na lista filtrada.

Nada mais é alterado (banco, RLS, outras telas, coluna de módulos).
