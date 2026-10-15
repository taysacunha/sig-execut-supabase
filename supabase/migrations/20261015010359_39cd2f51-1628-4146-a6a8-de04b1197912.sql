CREATE OR REPLACE FUNCTION public.despesas_centros_lookup()
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.nome
  FROM public.despesas_centros_custo c
  WHERE c.is_active = true
    AND c.id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
    AND (
      public.despesas_pode_ver_aba(auth.uid(), 'cadastros')
      OR public.despesas_pode_ver_aba(auth.uid(), 'calendario')
      OR public.despesas_pode_ver_aba(auth.uid(), 'repasses')
      OR public.despesas_pode_ver_aba(auth.uid(), 'imoveis')
      OR public.despesas_pode_ver_aba(auth.uid(), 'veiculos')
      OR public.despesas_pode_ver_aba(auth.uid(), 'bens')
      OR public.despesas_pode_ver_aba(auth.uid(), 'linhas')
    )
  ORDER BY c.nome;
$function$;