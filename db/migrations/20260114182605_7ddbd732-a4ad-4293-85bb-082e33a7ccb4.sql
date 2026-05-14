
-- 1. Create helper function to check admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- 2. Fix set_user_role function to recognize super_admin
CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _new_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se quem está chamando é super_admin OU admin
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas Super Administradores ou Administradores podem alterar roles';
  END IF;
  
  -- Deletar role existente
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  -- Inserir nova role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _new_role);
  
  RETURN true;
END;
$$;

-- 3. Fix user_roles RLS policies to include super_admin
DROP POLICY IF EXISTS "Admin can view all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admin can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admin can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
CREATE POLICY "Admins can update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admin can delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
CREATE POLICY "Admins can delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- 4. Fix system_access RLS policies to include super_admin
DROP POLICY IF EXISTS "Admin can view all system_access" ON public.system_access;
DROP POLICY IF EXISTS "Admins can view all system_access" ON public.system_access;
CREATE POLICY "Admins can view all system_access" ON public.system_access
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can insert system_access" ON public.system_access;
DROP POLICY IF EXISTS "Admins can insert system_access" ON public.system_access;
CREATE POLICY "Admins can insert system_access" ON public.system_access
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admin can update system_access" ON public.system_access;
DROP POLICY IF EXISTS "Admins can update system_access" ON public.system_access;
CREATE POLICY "Admins can update system_access" ON public.system_access
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admin can delete system_access" ON public.system_access;
DROP POLICY IF EXISTS "Admins can delete system_access" ON public.system_access;
CREATE POLICY "Admins can delete system_access" ON public.system_access
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- 5. Fix user_profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Admins can update any profile
CREATE POLICY "Admins can update all profiles" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- 6. Fix proposals RLS - restrict to authenticated users with vendas access
DROP POLICY IF EXISTS "Public can view proposals" ON public.proposals;
DROP POLICY IF EXISTS "Proposals are viewable by sales users" ON public.proposals;
DROP POLICY IF EXISTS "Users can view proposals" ON public.proposals;

CREATE POLICY "Authenticated users with vendas access can view proposals" ON public.proposals
  FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'vendas') OR public.is_admin_or_super(auth.uid()));

-- 7. Fix schedule_assignments RLS - restrict to authenticated users with escalas access
DROP POLICY IF EXISTS "Public can view schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Anyone can view schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Users can view schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Authenticated users can view schedule_assignments" ON public.schedule_assignments;

CREATE POLICY "Authenticated users with escalas access can view assignments" ON public.schedule_assignments
  FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'escalas') OR public.is_admin_or_super(auth.uid()));
