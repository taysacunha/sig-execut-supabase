-- Remover função e VIEW com CASCADE
DROP FUNCTION IF EXISTS public.get_brokers_for_manager() CASCADE;
DROP VIEW IF EXISTS public.brokers_safe CASCADE;

-- Recriar a função para retornar os dados diretamente (sem VIEW)
CREATE OR REPLACE FUNCTION public.get_brokers_for_manager()
RETURNS TABLE (
  id uuid,
  name text,
  creci text,
  is_active boolean,
  available_weekdays text[],
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.id,
    b.name,
    b.creci,
    b.is_active,
    b.available_weekdays,
    b.created_at,
    b.updated_at
  FROM public.brokers b
  WHERE has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'manager'::app_role)
$$;