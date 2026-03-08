-- Tabela para registro de desenvolvimento (funcionalidades, horas, custos)
-- Sem RLS - acesso controlado por código no frontend

CREATE TABLE IF NOT EXISTS public.dev_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL,
  feature_name text NOT NULL,
  description text,
  hours numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER handle_dev_tracker_updated_at
  BEFORE UPDATE ON public.dev_tracker
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Sem RLS - página protegida por código secreto no frontend
ALTER TABLE public.dev_tracker DISABLE ROW LEVEL SECURITY;
