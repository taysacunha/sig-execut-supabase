ALTER TABLE public.despesas_aba_permissoes DROP CONSTRAINT IF EXISTS despesas_aba_permissoes_aba_check;
ALTER TABLE public.despesas_aba_permissoes ADD CONSTRAINT despesas_aba_permissoes_aba_check
  CHECK (aba IN ('calendario','imoveis','repasses','cadastros','bens','veiculos','linhas'));

CREATE TABLE IF NOT EXISTS public.despesas_operadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_operadoras TO authenticated;
GRANT ALL ON public.despesas_operadoras TO service_role;
ALTER TABLE public.despesas_operadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY desp_operadoras_select ON public.despesas_operadoras FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'linhas'));
CREATE POLICY desp_operadoras_insert ON public.despesas_operadoras FOR INSERT TO authenticated
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));
CREATE POLICY desp_operadoras_update ON public.despesas_operadoras FOR UPDATE TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));
CREATE TRIGGER trg_desp_operadoras_updated BEFORE UPDATE ON public.despesas_operadoras
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.despesas_linhas_telefonicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('celular','fixo')),
  numero text NOT NULL,
  operadora_id uuid NOT NULL REFERENCES public.despesas_operadoras(id) ON DELETE RESTRICT,
  empresa_contratada text,
  unidade_id uuid NOT NULL REFERENCES public.ferias_unidades(id) ON DELETE RESTRICT,
  setor_id uuid REFERENCES public.ferias_setores(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.ferias_colaboradores(id) ON DELETE SET NULL,
  valor_contratado numeric(12,2),
  tipo_valor text CHECK (tipo_valor IN ('individual','global')),
  capacidade_internet text,
  modelo_aparelho text,
  observacoes text,
  centro_custo_id uuid REFERENCES public.despesas_centros_custo(id) ON DELETE RESTRICT,
  situacao text NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa','inativa','cancelada')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_desp_linhas_numero_ativa
  ON public.despesas_linhas_telefonicas (regexp_replace(numero,'\D','','g')) WHERE situacao = 'ativa';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_linhas_telefonicas TO authenticated;
GRANT ALL ON public.despesas_linhas_telefonicas TO service_role;
ALTER TABLE public.despesas_linhas_telefonicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY desp_linhas_select ON public.despesas_linhas_telefonicas FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'linhas')
    AND (centro_custo_id IS NULL OR centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))));
CREATE POLICY desp_linhas_insert ON public.despesas_linhas_telefonicas FOR INSERT TO authenticated
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'linhas')
    AND (centro_custo_id IS NULL OR centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))));
CREATE POLICY desp_linhas_update ON public.despesas_linhas_telefonicas FOR UPDATE TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'linhas')
    AND (centro_custo_id IS NULL OR centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'linhas')
    AND (centro_custo_id IS NULL OR centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))));
CREATE POLICY desp_linhas_delete ON public.despesas_linhas_telefonicas FOR DELETE TO authenticated
  USING (public.despesas_pode_excluir_aba(auth.uid(),'linhas')
    AND (centro_custo_id IS NULL OR centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))));
CREATE TRIGGER trg_desp_linhas_updated BEFORE UPDATE ON public.despesas_linhas_telefonicas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Lookup de unidades/setores/colaboradores (somente nomes) para quem vê a aba Linhas
CREATE OR REPLACE FUNCTION public.despesas_linhas_lookup()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.despesas_pode_ver_aba(auth.uid(),'linhas') THEN
    RETURN jsonb_build_object('unidades','[]'::jsonb,'setores','[]'::jsonb,'colaboradores','[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'unidades', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome) ORDER BY nome) FROM ferias_unidades WHERE is_active), '[]'::jsonb),
    'setores', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'unidade_id',unidade_id) ORDER BY nome) FROM ferias_setores WHERE is_active), '[]'::jsonb),
    'colaboradores', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'setor_id',setor_titular_id) ORDER BY nome) FROM ferias_colaboradores WHERE status = 'ativo'), '[]'::jsonb)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.despesas_linhas_lookup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.despesas_linhas_lookup() TO authenticated, service_role;