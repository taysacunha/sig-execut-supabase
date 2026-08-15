# "+ Entrada" invisível para supervisor — o que o diagnóstico mostrou

O SQL confirmou o cenário ideal para a Taysa: `role = supervisor` e `system_access.estoque = view_edit`.
E o código já libera esse caso em `src/pages/estoque/EstoqueSaldos.tsx` (linha 171):

```text
canEditEstoque = canEdit("estoque") && (isAdminOrSuper || isSupervisor)
```

Logo, nem o perfil nem a permissão são o bloqueio. Sobram duas explicações, e não consigo separá-las daqui
(este projeto usa Supabase próprio, então não tenho como abrir a página autenticada em teste):

1. **A versão testada é a publicada.** A liberação do supervisor entrou no código mas o app em
   `sig-execut.lovable.app` só passa a ter essa regra depois de publicar de novo. No preview ela já vale.
2. **Cache de permissões no navegador.** `useSystemAccess` guarda as permissões por 5 minutos com
   `refetchOnMount: false` e `refetchOnWindowFocus: false`. Se a permissão do Estoque foi alterada com a
   sessão aberta, a tela continua usando o valor antigo até um recarregamento completo.

## Verificação rápida (sem código)

Abrir `/estoque/saldos` **no preview**, com Ctrl+Shift+R (recarga forte). Se o botão aparecer ali, a causa é
a nº 1 e basta publicar. Se não aparecer nem no preview, seguimos para as correções abaixo.

## Correções propostas

1. **Permissões sempre frescas ao entrar na página**
   `src/hooks/useSystemAccess.ts`: trocar `refetchOnMount: false` por `refetchOnMount: "always"` e manter um
   `staleTime` curto (30s). Assim, mudança de perfil/permissão reflete ao navegar, sem precisar sair e entrar.

2. **Invalidar o cache quando o admin muda perfil ou acessos**
   `src/pages/UserManagement.tsx`: após salvar perfil (`set_user_role`) ou acessos de sistema, invalidar as
   queries `["system-access"]` para que a alteração valha imediatamente para quem está logado no mesmo browser.

3. **Explicar em vez de esconder**
   `src/pages/estoque/EstoqueSaldos.tsx`: quando o usuário tem acesso ao Estoque mas `canEditEstoque` é falso,
   mostrar uma faixa curta ("Seu acesso ao Estoque é somente leitura" / "Perfil sem permissão de movimentação")
   em vez de simplesmente omitir os botões. Isso evita esse tipo de investigação no futuro.

4. **Painel de diagnóstico do próprio usuário (opcional)**
   Em `src/pages/Profile.tsx`, listar perfil efetivo e permissão por sistema, direto das mesmas fontes que a UI
   usa. Fica fácil comparar com o banco em 5 segundos.

## Lado do banco

Confirmar que `db/migrations/20260815120000_estoque_saldos_supervisor.sql` foi executada — senão o botão
aparece, mas a gravação falha por RLS:

```sql
select polname, polcmd from pg_policy
where polrelid = 'public.estoque_saldos'::regclass;
```

Devem constar "Gestao estoque can insert/update/delete estoque_saldos".

## Arquivos afetados

- `src/hooks/useSystemAccess.ts`
- `src/pages/UserManagement.tsx`
- `src/pages/estoque/EstoqueSaldos.tsx`
- `src/pages/Profile.tsx` (item opcional)
