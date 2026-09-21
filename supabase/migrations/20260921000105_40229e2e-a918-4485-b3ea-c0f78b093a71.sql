CREATE OR REPLACE FUNCTION public.despesas_veiculos_lookup()
RETURNS TABLE (
  id uuid,
  modelo text,
  placa text,
  motorista_id uuid,
  proprietario_id uuid,
  comprador_id uuid,
  nota_fiscal text,
  observacao text,
  centro_custo_id uuid,
  data_aquisicao date,
  data_venda date,
  is_active boolean,
  motorista_nome text,
  proprietario_nome text,
  centro_custo_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.modelo,
    v.placa,
    v.motorista_id,
    v.proprietario_id,
    v.comprador_id,
    v.nota_fiscal,
    v.observacao,
    v.centro_custo_id,
    v.data_aquisicao,
    v.data_venda,
    v.is_active,
    motorista.nome AS motorista_nome,
    proprietario.nome AS proprietario_nome,
    centro.nome AS centro_custo_nome
  FROM public.despesas_veiculos v
  LEFT JOIN public.despesas_pessoas motorista ON motorista.id = v.motorista_id
  LEFT JOIN public.despesas_pessoas proprietario ON proprietario.id = v.proprietario_id
  LEFT JOIN public.despesas_centros_custo centro ON centro.id = v.centro_custo_id
  WHERE auth.uid() IS NOT NULL
    AND v.is_active = true
    AND (
      public.is_admin_or_super(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.despesas_aba_permissoes ap
        WHERE ap.user_id = auth.uid()
          AND ap.aba = 'veiculos'
          AND ap.nivel IN ('view', 'edit', 'delete')
      )
    )
    AND (
      v.centro_custo_id IS NULL
      OR v.centro_custo_id IN (
        SELECT public.despesas_centros_permitidos(auth.uid())
      )
    )
  ORDER BY v.modelo;
$$;

REVOKE ALL ON FUNCTION public.despesas_veiculos_lookup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.despesas_veiculos_lookup() TO authenticated, service_role;