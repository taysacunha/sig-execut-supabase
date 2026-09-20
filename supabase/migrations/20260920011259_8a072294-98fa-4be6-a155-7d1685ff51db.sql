REVOKE ALL ON FUNCTION public.despesas_gerar_ocorrencias(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.despesas_gerar_ocorrencias(uuid, date) TO authenticated, service_role;