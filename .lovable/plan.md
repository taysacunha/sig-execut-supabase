# Botão "+ Entrada" ainda invisível para supervisor

## O que já está no código

`src/pages/estoque/EstoqueSaldos.tsx` (linha 171) já libera supervisor:

```text
canEditEstoque = canEdit("estoque") && (isAdminOrSuper || isSupervisor)
```

Ou seja, o gate de perfil não é mais o bloqueio. Restam três candidatos, e não consigo confirmar qual é sem olhar o banco (o acesso direto ao Postgres não está disponível nesta sessão):

1. O usuário tem acesso ao Estoque como **"Somente visualizar"** — então `canEdit("estoque")` é `false` e o botão continua oculto, independente do perfil.
2. O perfil efetivo retornado por `get_user_role` não é `supervisor` (por exemplo continua `collaborator` ou ficou sem linha em `user_roles`).
3. As permissões ficam em cache no React Query por 5 minutos com `refetchOnMount: false`; se o perfil/permissão foi alterado com a sessão aberta, a tela só reflete depois de recarregar.

## Passo 1 — Diagnóstico (rodar no SQL Editor do Supabase)

```sql
select p.name, ur.role, sa.system_name, sa.permission_type
from public.user_profiles p
left join public.user_roles ur on ur.user_id = p.user_id
left join public.system_access sa on sa.user_id = p.user_id and sa.system_name = 'estoque'
where p.name ilike '%ruan%';
```

(A tabela `user_profiles` usa `user_id` e `name` — não `id`/`full_name`; era isso que gerava o erro `column p.full_name does not exist`.)

O resultado diz qual dos três casos é. Se vier `view_only`, basta trocar para "Ver e editar" na página de Usuários — sem mudança de código.

## Passo 2 — Correções de código (independentes do diagnóstico)

- **Invalidar o cache de permissões ao trocar perfil/acesso:** em `src/pages/UserManagement.tsx`, após salvar perfil ou acessos, invalidar a query `["system-access", userId]`; e em `src/hooks/useSystemAccess.ts` reduzir o efeito do cache trocando `refetchOnMount: false` por `refetchOnMount: "always"`, mantendo `staleTime`. Assim a mudança aparece sem precisar sair e entrar de novo.
- **Feedback em vez de sumiço silencioso:** quando o usuário tem acesso ao Estoque mas sem edição (ou sem perfil suficiente), exibir na página de Saldos um aviso curto explicando por que as ações não estão disponíveis, em vez de simplesmente esconder os botões.

## Passo 3 — Confirmar o lado do banco

A migration `db/migrations/20260815120000_estoque_saldos_supervisor.sql` precisa ter sido executada. Verificação:

```sql
select polname, polcmd from pg_policy
where polrelid = 'public.estoque_saldos'::regclass;
```

Devem aparecer as políticas "Gestao estoque can insert/update/delete estoque_saldos". Se não aparecerem, o botão até apareceria, mas o INSERT falharia por RLS — então rode a migration.

## Arquivos afetados

- `src/hooks/useSystemAccess.ts`
- `src/pages/UserManagement.tsx`
- `src/pages/estoque/EstoqueSaldos.tsx`
