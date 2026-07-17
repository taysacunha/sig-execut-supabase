Plano para resolver o módulo Despesas não aparecer:

1. Validar o usuário correto
   - Usar o ID do usuário logado que aparece nos logs atuais: `c5c345c1-47fe-402b-a740-dfffaf9923f5`.
   - O SQL anterior foi para outro usuário (`11ab4056-0346-492e-9d45-6da0a5291f9b`), por isso o portal não liberou o módulo para você.

2. Aplicar acesso ao sistema
   - Rodar um SQL para inserir/atualizar `public.system_access` com:
     - `user_id = 'c5c345c1-47fe-402b-a740-dfffaf9923f5'`
     - `system_name = 'despesas'`
     - `permission_type = 'view_edit'`

3. Aplicar permissões internas do módulo Despesas
   - Rodar `UPSERT` em `public.despesas_aba_permissoes` para liberar as abas:
     - `calendario`
     - `imoveis`
     - `repasses`
     - `cadastros`
   - Nível recomendado para você/admin: `delete`, que inclui visualizar, editar e excluir.

4. Recarregar o cache do app
   - Depois do SQL, sair e entrar novamente no sistema, ou aguardar o cache de permissões expirar.
   - O hook `useSystemAccess` usa cache de 5 minutos, então o logout/login é o caminho mais rápido.

SQL que vou te orientar a rodar:

```sql
-- Libera o módulo Despesas no Portal para o usuário logado atual
INSERT INTO public.system_access (user_id, system_name, permission_type)
VALUES ('c5c345c1-47fe-402b-a740-dfffaf9923f5', 'despesas', 'view_edit')
ON CONFLICT (user_id, system_name)
DO UPDATE SET permission_type = EXCLUDED.permission_type;

-- Libera todas as abas internas do módulo Despesas para o mesmo usuário
INSERT INTO public.despesas_aba_permissoes (user_id, aba, nivel)
VALUES
  ('c5c345c1-47fe-402b-a740-dfffaf9923f5', 'calendario', 'delete'),
  ('c5c345c1-47fe-402b-a740-dfffaf9923f5', 'imoveis', 'delete'),
  ('c5c345c1-47fe-402b-a740-dfffaf9923f5', 'repasses', 'delete'),
  ('c5c345c1-47fe-402b-a740-dfffaf9923f5', 'cadastros', 'delete')
ON CONFLICT (user_id, aba)
DO UPDATE SET nivel = EXCLUDED.nivel, updated_at = now();
```

Depois de executar, faça logout e login novamente. Se ainda não aparecer, o próximo passo será verificar a política RLS da tabela `system_access` e se o registro está sendo visível para o próprio usuário autenticado.