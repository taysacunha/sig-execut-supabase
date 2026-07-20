
# Restringir poderes do perfil "Admin" no Gerenciamento de Usuários

Hoje `admin` tem praticamente os mesmos poderes de `super_admin`: enxerga todos os usuários, pode desativar/excluir, mudar role e conceder acesso a qualquer sistema. O plano abaixo cria um escopo por sistema para o perfil `admin`, mantendo `super_admin` intocado.

## Regras de negócio (perfil `admin`)

Escopo do admin = conjunto de `system_name` em que ele possui `system_access` com `permission_type = 'view_edit'` (ou seja, os sistemas onde ele é "editor/admin do módulo").

1. **Listagem**: só enxerga usuários que possuem acesso a pelo menos um sistema dentro do seu escopo. Não vê `super_admin`s nem usuários sem nenhum sistema em comum. Ele próprio continua visível (linha "Você").
2. **Ações destrutivas removidas**: sem desativar, reativar, excluir ou reenviar convite; sem alteração de e-mail de terceiros; sem alteração de role de terceiros.
3. **Permissões por sistema**: pode alternar habilitar/desabilitar e trocar `view_only`/`view_edit` **somente** para sistemas dentro do seu escopo. Sistemas fora do escopo aparecem como badges somente-leitura (para dar contexto), sem permitir edição.
4. **Convite de novo usuário**: só pode selecionar sistemas dentro do seu escopo, e o convidado precisa receber pelo menos um sistema. Role fixada em `collaborator` (admin não cria admin/manager/etc.).
5. **Auto-edição**: continua podendo editar o próprio nome e senha (fluxo atual `update_password` / `auth.updateUser`).

`super_admin` mantém comportamento atual: vê tudo, faz tudo.

## Backend (Supabase)

### Migration `db/migrations/20260725120000_admin_scope_restrictions.sql`
- Função `public.admin_scoped_systems(_user_id uuid) returns setof text` (SECURITY DEFINER): retorna os `system_name` em que o usuário tem `permission_type = 'view_edit'`.
- Função `public.admin_can_see_user(_admin uuid, _target uuid) returns boolean` (SECURITY DEFINER): `true` se `_admin = _target`, se `is_super_admin(_admin)`, ou se existe interseção não-vazia entre `admin_scoped_systems(_admin)` e os `system_access.system_name` de `_target` — desde que `_target` **não** seja `super_admin`.
- Atualizar policies de `system_access`:
  - Substituir policies amplas de INSERT/UPDATE/DELETE por versão que exige:
    `is_super_admin(auth.uid()) OR (has_role(auth.uid(),'admin') AND system_name = ANY(SELECT admin_scoped_systems(auth.uid())) AND NOT is_super_admin(user_id))`.
  - Manter SELECT já existente.
- Ajustar policies de `user_profiles` e `user_roles` de leitura para retornar apenas linhas de usuários que `admin_can_see_user(auth.uid(), user_id)` retorna `true` (sem quebrar `super_admin`, que continua vendo tudo).
- Bloquear `set_user_role` para admin: acrescentar guard `RAISE EXCEPTION` quando `caller` for `admin` (permanece liberado para `super_admin`).
- Grants padrão para as novas funções (`GRANT EXECUTE ... TO authenticated`).

### Edge functions
- `list-users/index.ts`: quando `callerRole = 'admin'`, filtrar `usersData.users` para incluir apenas ids retornados por consulta em `system_access` cujo `system_name` esteja no escopo do admin (query auxiliar após o listUsers). Excluir `super_admin`s.
- `manage-user/index.ts`: rejeitar (`403`) qualquer ação diferente de `update_password`/`update_email` quando `isSelfAction=false` e `callerRole = 'admin'`. `update_email` de terceiros também bloqueado para admin.
- `invite-user/index.ts`: se `callerRole = 'admin'`, exigir `role === 'collaborator'` e validar que todos `systems[].system_name` pertencem ao escopo do admin (retornar 403 caso contrário). Bloquear `resend` para usuários fora do escopo.

## Frontend (`src/pages/UserManagement.tsx`)

- Novo hook local (ou uso direto de `useSystemAccess`): derivar `adminScope = Set<SystemName>` a partir dos sistemas com `canEdit(sys) === true` do usuário logado. Só aplicável quando `role === 'admin'` (não super_admin).
- `availableRoles` para admin: `['collaborator']`.
- Botões desativar (`Ban`), excluir (`Trash2`) e "reenviar convite" ocultados quando `!isSuperAdmin`.
- Diálogo "Editar usuário":
  - Admin: campos `role` e `email` desabilitados para terceiros; lista de sistemas mostra todos, porém checkbox e select de permissão só editáveis para sistemas dentro do `adminScope` (demais aparecem em cinza com tooltip "Fora do seu escopo").
  - Salvamento: enviar apenas mutações de `system_access` referentes ao escopo, ignorando o resto (proteção redundante ao RLS).
- Diálogo "Adicionar usuário": para admin, ocultar select de perfil (fixar `collaborator`) e listar apenas sistemas do escopo.
- Filtro por módulo: continuar existindo, mas para admin restringir o `Select` de módulo ao escopo.
- `canManageUser`: passar a considerar `adminScope`; admin só devolve `true` para usuários com interseção não vazia.
- Coluna Ações: quando não houver nenhuma ação disponível (admin vendo um usuário editável só via sistemas), mostrar apenas o botão "Editar" (que abrirá o dialog limitado).

## Verificação

1. Login como `super_admin`: fluxo atual permanece igual (lista completa, todas as ações).
2. Login como Ruan (`admin` com acesso a Estoque): lista deve conter apenas usuários com Estoque + ele próprio; sem botões de desativar/excluir; ao editar outro usuário só consegue alterar sistemas de Estoque; ao convidar, só pode marcar Estoque e o novo perfil é Collaborator.
3. Tentar chamar diretamente `manage-user` com `action=delete` como admin → resposta 403.
4. Tentar `upsert` em `system_access` para sistema fora do escopo como admin → bloqueado pela RLS.

## Fora do escopo

- Nenhuma mudança em módulos além de Gerenciamento de Usuários.
- Sem mudanças nos poderes de `manager`, `supervisor` ou `collaborator`.
- Sem mudanças no fluxo de autoedição (nome/senha do próprio admin).
