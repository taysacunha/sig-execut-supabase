-- 1. CORRIGIR user_roles: Substituir policy ALL por policies explícitas
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

CREATE POLICY "Admin can insert user_roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update user_roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete user_roles" ON public.user_roles
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can view all user_roles" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. CORRIGIR brokers: Restringir acesso ao telefone
-- Remover policy que permite managers verem tudo
DROP POLICY IF EXISTS "Admin/Manager can view all brokers" ON public.brokers;

-- Criar policy que permite APENAS admins verem a tabela brokers completa
CREATE POLICY "Admin can view all brokers" ON public.brokers
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Criar VIEW segura para managers (sem telefone)
CREATE OR REPLACE VIEW public.brokers_safe AS
SELECT 
  id,
  name,
  creci,
  is_active,
  available_weekdays,
  created_at,
  updated_at
FROM public.brokers;

-- 4. Criar função para managers acessarem a view
CREATE OR REPLACE FUNCTION public.get_brokers_for_manager()
RETURNS SETOF public.brokers_safe
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.brokers_safe
  WHERE has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'manager'::app_role)
$$;