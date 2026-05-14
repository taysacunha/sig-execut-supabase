-- FASE 1B: Criar tabela user_profiles e modificar system_access

-- 1. Criar tabela user_profiles para armazenar nome dos usuários
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS na tabela user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para user_profiles
-- Super admin e admin podem ver todos os perfis
CREATE POLICY "Super admin and admin can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Super admin pode inserir perfis
CREATE POLICY "Super admin can insert profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Admin pode inserir perfis
CREATE POLICY "Admin can insert profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Super admin pode atualizar todos os perfis
CREATE POLICY "Super admin can update all profiles"
  ON public.user_profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Admin pode atualizar perfis (exceto super_admin)
CREATE POLICY "Admin can update non-super-admin profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) AND
    NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = public.user_profiles.user_id
      AND ur.role = 'super_admin'::app_role
    )
  );

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Super admin pode deletar perfis
CREATE POLICY "Super admin can delete profiles"
  ON public.user_profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Admin pode deletar perfis (exceto super_admin)
CREATE POLICY "Admin can delete non-super-admin profiles"
  ON public.user_profiles FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) AND
    NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = public.user_profiles.user_id
      AND ur.role = 'super_admin'::app_role
    )
  );

-- 4. Adicionar coluna permission_type à tabela system_access
ALTER TABLE public.system_access 
ADD COLUMN IF NOT EXISTS permission_type TEXT NOT NULL DEFAULT 'view_edit';

-- 5. Adicionar constraint de validação para permission_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_access_permission_type_check'
  ) THEN
    ALTER TABLE public.system_access 
    ADD CONSTRAINT system_access_permission_type_check 
    CHECK (permission_type IN ('view_only', 'view_edit'));
  END IF;
END $$;

-- 6. Criar função para obter nível hierárquico do role
CREATE OR REPLACE FUNCTION public.get_role_level(_role app_role)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'supervisor' THEN 4
    WHEN 'collaborator' THEN 5
    WHEN 'broker' THEN 5
    ELSE 99
  END;
$$;

-- 7. Criar função para verificar se pode gerenciar outro role
CREATE OR REPLACE FUNCTION public.can_manage_role(_caller_role app_role, _target_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Super admin pode tudo
    _caller_role = 'super_admin' 
    OR 
    -- Admin pode gerenciar roles de nível igual ou inferior (exceto super_admin)
    (_caller_role = 'admin' AND _target_role != 'super_admin' AND public.get_role_level(_caller_role) <= public.get_role_level(_target_role));
$$;

-- 8. Criar função para obter nome do usuário
CREATE OR REPLACE FUNCTION public.get_user_name(_user_id uuid)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT name FROM public.user_profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- 9. Trigger para atualizar updated_at em user_profiles
CREATE OR REPLACE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();