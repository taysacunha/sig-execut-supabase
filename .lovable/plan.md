## Diagnóstico

**1. Erro do UUID:** `<seu-uuid>` é apenas um placeholder — o Postgres tentou converter esse texto literal em UUID e falhou. Você precisa substituir por seu UUID real.

Seu UUID (identificado pelos logs de autenticação do usuário `sti@execut.com.br`):
```
11ab4056-0346-492e-9d45-6da0a5291f9b
```

**2. Botão "editar" não mostra acessos:** Isso é o comportamento correto e intencional. Por segurança, o sistema bloqueia qualquer usuário de alterar a própria `role` ou os próprios acessos ao sistema pelo dialog de edição — por isso aparece só nome/e‑mail/senha e a mensagem "Por segurança, você não pode alterar…". Essa proteção existe para impedir escalada de privilégios.

Portanto, para o **primeiro acesso ao módulo Despesas do próprio admin**, o caminho é mesmo o SQL. Depois disso, você pode habilitar Despesas para qualquer **outro** usuário normalmente pela tela `/usuarios` (o dialog de edição de outro usuário mostra o quadro de sistemas com a opção Despesas).

## Ação

Rode no SQL Editor do Supabase:

```sql
INSERT INTO public.system_access (user_id, system_name, permission_type)
VALUES ('11ab4056-0346-492e-9d45-6da0a5291f9b', 'despesas', 'view_edit')
ON CONFLICT (user_id, system_name) DO UPDATE SET permission_type = EXCLUDED.permission_type;
```

Depois:
1. Faça **logout** e **login** novamente (para o hook `useSystemAccess` recarregar o cache de permissões).
2. Na tela de seleção de sistemas, o card **Despesas** deve aparecer.
3. Para conceder acesso a outros usuários, use normalmente a página `/usuarios` → botão de ações → marcar Despesas na matriz de sistemas.

## Nenhuma alteração de código nesta etapa

Não há bug a corrigir — é comportamento esperado. Se depois de rodar o SQL e relogar o card Despesas não aparecer, aí sim investigamos (provavelmente cache do React Query ou a coluna `permission_type` não existe em `system_access` na sua base).
