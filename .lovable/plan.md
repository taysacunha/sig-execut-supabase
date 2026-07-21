## Problema confirmado

Na aba Usuários, para um admin (não super_admin):

- `availableRoles = ["collaborator"]` (src/pages/UserManagement.tsx:194-196).
- A célula "Perfil" renderiza `<Select value={user.role}>` mas só popula a opção "Colaborador". Para usuários que já são `manager` ou `supervisor`, o valor atual não bate com nenhum item e o campo aparece em branco. Se o admin selecionar "Colaborador" ali, ele rebaixa silenciosamente o perfil (a chamada `set_user_role` falha porque hoje exige super_admin, mas a UX é enganosa).
- Regra no banco (`set_user_role`, migration 20260725120000): apenas super_admin altera role — admin não consegue trocar nada.

Ou seja, o admin não deveria mediar `super_admin`/`admin`, mas faz sentido permitir troca entre os perfis operacionais (`manager`, `supervisor`, `collaborator`).

## Sugestão

Dar ao admin um "conjunto operacional" de perfis gerenciáveis (`manager`, `supervisor`, `collaborator`) e blindar tudo que estiver acima:

- Se o usuário-alvo tem perfil `super_admin` ou `admin` → mostrar somente um badge somente-leitura ("Administrador"/"Super Administrador") + tooltip "Somente Super Administrador pode alterar este perfil".
- Se o usuário-alvo tem perfil operacional ou nenhum → mostrar Select com as três opções (`manager`, `supervisor`, `collaborator`), pré-selecionado com o valor atual (não fica mais em branco).
- Super_admin continua com o conjunto completo, como hoje.

## Mudanças

### Banco (nova migration)

Atualizar `public.set_user_role(_target_user_id uuid, _new_role app_role)`:

- super_admin: qualquer alvo, qualquer role (comportamento atual).
- admin: só se
  - `_new_role IN ('manager','supervisor','collaborator')` e
  - alvo NÃO é `super_admin` nem `admin` (checar `user_roles` do alvo) e
  - alvo compartilha ao menos um sistema em que o admin tem `view_edit` (usa `admin_edits_system` para pelo menos um `system_access` do alvo).
- Erros claros ("Admin não pode alterar perfis administrativos", "Sem escopo de sistema em comum", "Perfil não permitido para Admin").

### Frontend (`src/pages/UserManagement.tsx`)

1. Trocar `availableRoles` para expor um conjunto por chamador:
   - super_admin: todos.
   - admin: `["manager","supervisor","collaborator"]`.
2. Nova função `canEditRole(user)`:
   - super_admin → true (exceto ele mesmo).
   - admin → `user.role` é null OU `user.role ∈ {manager, supervisor, collaborator}` E `canManageUser(user)`.
3. Célula "Perfil":
   - se `canEditRole` → Select com `availableRoles`; usar `user.role || undefined` para exibir placeholder "Sem perfil" quando nulo, e mostrar o valor atual quando for um dos três.
   - senão → badge somente-leitura já existente + tooltip explicativo para admin/super_admin.
4. Ajustar `useUserRole.canManageRole` (ou usar lista local) para não deixar o admin ver "Administrador" no dropdown — hoje `canManageRole('admin')` retorna `true` para admin (nível 2<=2). Restringir localmente à lista `availableRoles`.
5. Diálogo de edição (linha ~1010) usa a mesma lista; herdar a nova regra.
6. Convite (`inviteRole`) já força `collaborator` para admin; passar a permitir também `manager`/`supervisor` no dropdown quando o chamador for admin.

### Sem impacto

RLS de `system_access`, list-users e manage-user permanecem como estão — a mudança é só no `set_user_role` e na UI.

## Resumo do comportamento após o ajuste

| Chamador | Perfil do alvo | O que pode fazer no campo "Perfil" |
|---|---|---|
| super_admin | qualquer | trocar para qualquer perfil |
| admin | super_admin / admin | apenas ver (badge, tooltip) |
| admin | manager / supervisor / collaborator / null | trocar entre manager, supervisor, collaborator |
