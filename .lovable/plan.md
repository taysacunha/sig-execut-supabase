## Objetivo

Reforçar no banco de dados que somente usuários com role `super_admin` ou `admin` consigam **INSERT / UPDATE / DELETE** em `estoque_saldos` e `estoque_movimentacoes`, garantindo a regra mesmo se alguém chamar a API diretamente. A leitura (SELECT) continua para qualquer usuário com acesso ao módulo Estoque.

## Migration

Criar uma migration que:

1. **`estoque_saldos`** — derruba as policies atuais de INSERT/UPDATE/DELETE e recria exigindo Admin/Super Admin, mantendo a checagem de acesso ao módulo:

   ```sql
   DROP POLICY IF EXISTS "Users with edit access can insert estoque_saldos" ON public.estoque_saldos;
   DROP POLICY IF EXISTS "Users with edit access can update estoque_saldos" ON public.estoque_saldos;
   DROP POLICY IF EXISTS "Users with edit access can delete estoque_saldos" ON public.estoque_saldos;

   CREATE POLICY "Admin/Super can insert estoque_saldos"
     ON public.estoque_saldos FOR INSERT TO authenticated
     WITH CHECK (
       public.is_admin_or_super(auth.uid())
       AND public.has_system_access(auth.uid(), 'estoque')
     );

   CREATE POLICY "Admin/Super can update estoque_saldos"
     ON public.estoque_saldos FOR UPDATE TO authenticated
     USING (
       public.is_admin_or_super(auth.uid())
       AND public.has_system_access(auth.uid(), 'estoque')
     );

   CREATE POLICY "Admin/Super can delete estoque_saldos"
     ON public.estoque_saldos FOR DELETE TO authenticated
     USING (
       public.is_admin_or_super(auth.uid())
       AND public.has_system_access(auth.uid(), 'estoque')
     );
   ```

2. **`estoque_movimentacoes`** — mesmo padrão para INSERT/UPDATE/DELETE (entrada, ajuste, transferência e saída são registradas aqui):

   ```sql
   DROP POLICY IF EXISTS "Users with edit access can insert estoque_movimentacoes" ON public.estoque_movimentacoes;
   DROP POLICY IF EXISTS "Users with edit access can update estoque_movimentacoes" ON public.estoque_movimentacoes;
   DROP POLICY IF EXISTS "Users with edit access can delete estoque_movimentacoes" ON public.estoque_movimentacoes;

   CREATE POLICY "Admin/Super can insert estoque_movimentacoes" ...
   CREATE POLICY "Admin/Super can update estoque_movimentacoes" ...
   CREATE POLICY "Admin/Super can delete estoque_movimentacoes" ...
   ```

3. Policies de SELECT existentes em ambas as tabelas permanecem inalteradas — qualquer usuário com `has_system_access('estoque')` continua visualizando.

## Fora de escopo

- `estoque_solicitacoes` e `estoque_solicitacao_itens` continuam liberadas para criação por qualquer usuário com acesso ao módulo (fluxo de solicitar material não é afetado).
- Tabelas `estoque_materiais`, `estoque_locais_armazenamento`, `estoque_categorias`, `estoque_gestores`, `estoque_usuarios_unidades`, `estoque_notificacoes` ficam como estão.

## Impacto no frontend

Nenhuma mudança de código. Como a UI já esconde os botões para não-admins (implementado no passo anterior), o reforço de RLS apenas bloqueia chamadas via API direta. Usuários Admin/Super Admin continuam operando normalmente.