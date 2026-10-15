CREATE UNIQUE INDEX IF NOT EXISTS ux_desp_operadoras_nome ON public.despesas_operadoras (lower(btrim(nome)));
CREATE POLICY desp_operadoras_delete ON public.despesas_operadoras FOR DELETE TO authenticated
  USING (public.despesas_pode_excluir_aba(auth.uid(),'cadastros'));

DROP INDEX IF EXISTS public.ux_desp_linhas_numero_ativa;
CREATE UNIQUE INDEX IF NOT EXISTS ux_desp_linhas_numero ON public.despesas_linhas_telefonicas (regexp_replace(numero,'\D','','g'));

ALTER TABLE public.despesas_linhas_telefonicas
  ADD COLUMN IF NOT EXISTS empresa_pessoa_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.despesas_linhas_lookup()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.despesas_pode_ver_aba(auth.uid(),'linhas') THEN
    RETURN jsonb_build_object('unidades','[]'::jsonb,'setores','[]'::jsonb,'colaboradores','[]'::jsonb,'empresas','[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'unidades', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome) ORDER BY nome) FROM ferias_unidades WHERE is_active), '[]'::jsonb),
    'setores', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'unidade_id',unidade_id) ORDER BY nome) FROM ferias_setores WHERE is_active), '[]'::jsonb),
    'colaboradores', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'setor_id',setor_titular_id) ORDER BY nome) FROM ferias_colaboradores WHERE status = 'ativo'), '[]'::jsonb),
    'empresas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'cpf_cnpj',cpf_cnpj) ORDER BY nome) FROM despesas_pessoas WHERE is_active AND tipo_pessoa = 'juridica'), '[]'::jsonb)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.despesas_linhas_lookup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.despesas_linhas_lookup() TO authenticated, service_role;

INSERT INTO public.dev_tracker_log (occurred_on, system_name, title, description, change_type, hours, source)
VALUES ('2026-10-14','despesas','Linhas e Operadoras: duplicidade, ações e empresa por Pessoas',
'Diálogos menores; operadora sem nome repetido com ativar/desativar/excluir; empresa contratada vinda de Pessoas jurídicas; situação removida do diálogo e tratada por ações na tabela; número único (DDD+número).',
'melhoria', 1.5, 'lovable');