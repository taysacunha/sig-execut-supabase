-- 1. Criar enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'broker');

-- 2. Criar tabela user_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Criar função SECURITY DEFINER para verificar roles (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Função para obter role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 6. Função para definir role (apenas admin pode chamar)
CREATE OR REPLACE FUNCTION public.set_user_role(
  _target_user_id UUID,
  _new_role app_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admins podem alterar roles';
  END IF;
  
  -- Deletar role existente
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  -- Inserir nova role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _new_role);
  
  RETURN true;
END;
$$;

-- 7. Função para criar primeiro admin (pode ser chamada uma vez)
CREATE OR REPLACE FUNCTION public.make_first_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se já existe algum admin
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Já existe um admin no sistema';
  END IF;
  
  -- Criar primeiro admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin');
  
  RETURN true;
END;
$$;

-- 8. Policies para user_roles
-- Admins podem gerenciar todas as roles
CREATE POLICY "Admins can manage user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Usuários podem ver sua própria role
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 9. Atualizar RLS para tabela brokers
DROP POLICY IF EXISTS "Authenticated users can view brokers" ON brokers;
DROP POLICY IF EXISTS "Authenticated users can insert brokers" ON brokers;
DROP POLICY IF EXISTS "Authenticated users can update brokers" ON brokers;
DROP POLICY IF EXISTS "Authenticated users can delete brokers" ON brokers;

-- Admin e Manager podem ver todos os corretores
CREATE POLICY "Admin/Manager can view all brokers" ON brokers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Admin e Manager podem inserir corretores
CREATE POLICY "Admin/Manager can insert brokers" ON brokers
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Admin e Manager podem atualizar corretores
CREATE POLICY "Admin/Manager can update brokers" ON brokers
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Apenas Admin pode deletar corretores
CREATE POLICY "Admin can delete brokers" ON brokers
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 10. Atualizar RLS para assignment_history_monthly
DROP POLICY IF EXISTS "Authenticated users can view assignment_history_monthly" ON assignment_history_monthly;
DROP POLICY IF EXISTS "Authenticated users can insert assignment_history_monthly" ON assignment_history_monthly;
DROP POLICY IF EXISTS "Authenticated users can update assignment_history_monthly" ON assignment_history_monthly;
DROP POLICY IF EXISTS "Authenticated users can delete assignment_history_monthly" ON assignment_history_monthly;

-- Admin e Manager podem ver histórico
CREATE POLICY "Admin/Manager can view assignment_history" ON assignment_history_monthly
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Admin e Manager podem inserir histórico (via função aggregate)
CREATE POLICY "Admin/Manager can insert assignment_history" ON assignment_history_monthly
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Admin e Manager podem atualizar histórico
CREATE POLICY "Admin/Manager can update assignment_history" ON assignment_history_monthly
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Apenas Admin pode deletar histórico
CREATE POLICY "Admin can delete assignment_history" ON assignment_history_monthly
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));