-- Garantir search_path explícito em todas as funções candidatas ao warning
-- "Function Search Path Mutable" do linter do Supabase.

ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_module_changes() SET search_path = public;
ALTER FUNCTION public.atualizar_status_ferias() SET search_path = public;
ALTER FUNCTION public.ferias_premiacoes_check_atesto() SET search_path = public;
