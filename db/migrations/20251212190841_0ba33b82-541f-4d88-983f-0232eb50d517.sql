-- Tabela para controlar acesso aos sistemas
CREATE TABLE public.system_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  system_name text NOT NULL, -- 'escalas', 'vendas'
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, system_name)
);

-- Habilitar RLS
ALTER TABLE public.system_access ENABLE ROW LEVEL SECURITY;

-- Policies para system_access
CREATE POLICY "Admin can view all system_access"
ON public.system_access
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own system_access"
ON public.system_access
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin can insert system_access"
ON public.system_access
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update system_access"
ON public.system_access
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete system_access"
ON public.system_access
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Função para verificar acesso a sistema
CREATE OR REPLACE FUNCTION public.has_system_access(_user_id uuid, _system text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_access
    WHERE user_id = _user_id
      AND system_name = _system
  )
$$;

-- Função para obter sistemas acessíveis do usuário
CREATE OR REPLACE FUNCTION public.get_user_systems(_user_id uuid)
RETURNS TABLE(system_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.system_name
  FROM public.system_access sa
  WHERE sa.user_id = _user_id
  ORDER BY sa.system_name
$$;

-- Dar acesso ao sistema de escalas para todos os usuários existentes com role
INSERT INTO public.system_access (user_id, system_name)
SELECT ur.user_id, 'escalas'
FROM public.user_roles ur
ON CONFLICT (user_id, system_name) DO NOTHING;