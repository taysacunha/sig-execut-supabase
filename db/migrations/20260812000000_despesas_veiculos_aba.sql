-- =====================================================================
-- Veículos como aba própria de permissão no módulo Despesas
--   • nova aba de permissão: 'veiculos'
--   • RLS de despesas_veiculos / despesas_veiculo_documentos passa a
--     usar a aba 'veiculos' (antes usava 'cadastros')
--   • migra o nível atual de 'cadastros' para 'veiculos' por usuário
-- =====================================================================

-- 1) Nova aba aceita
ALTER TABLE public.despesas_aba_permissoes
  DROP CONSTRAINT IF EXISTS despesas_aba_permissoes_aba_check;
ALTER TABLE public.despesas_aba_permissoes
  ADD CONSTRAINT despesas_aba_permissoes_aba_check
  CHECK (aba IN ('calendario','imoveis','repasses','cadastros','bens','veiculos'));

-- 2) Preserva o acesso atual: quem tinha nível em 'cadastros' ganha o
--    mesmo nível em 'veiculos' (sem sobrescrever linhas já existentes).
INSERT INTO public.despesas_aba_permissoes (user_id, aba, nivel)
SELECT p.user_id, 'veiculos', p.nivel
FROM public.despesas_aba_permissoes p
WHERE p.aba = 'cadastros'
  AND NOT EXISTS (
    SELECT 1 FROM public.despesas_aba_permissoes q
    WHERE q.user_id = p.user_id AND q.aba = 'veiculos'
  );

-- 3) RLS: recria políticas apontando para a aba 'veiculos'
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('despesas_veiculos','despesas_veiculo_documentos')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.despesas_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas_veiculo_documentos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_veiculos TO authenticated;
GRANT ALL ON public.despesas_veiculos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_veiculo_documentos TO authenticated;
GRANT ALL ON public.despesas_veiculo_documentos TO service_role;

CREATE POLICY "veiculos_select" ON public.despesas_veiculos
  FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(), 'veiculos'));

CREATE POLICY "veiculos_insert" ON public.despesas_veiculos
  FOR INSERT TO authenticated
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(), 'veiculos'));

CREATE POLICY "veiculos_update" ON public.despesas_veiculos
  FOR UPDATE TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(), 'veiculos'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(), 'veiculos'));

CREATE POLICY "veiculos_delete" ON public.despesas_veiculos
  FOR DELETE TO authenticated
  USING (public.despesas_pode_excluir_aba(auth.uid(), 'veiculos'));

CREATE POLICY "veiculo_docs_select" ON public.despesas_veiculo_documentos
  FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(), 'veiculos'));

CREATE POLICY "veiculo_docs_insert" ON public.despesas_veiculo_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(), 'veiculos'));

CREATE POLICY "veiculo_docs_update" ON public.despesas_veiculo_documentos
  FOR UPDATE TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(), 'veiculos'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(), 'veiculos'));

CREATE POLICY "veiculo_docs_delete" ON public.despesas_veiculo_documentos
  FOR DELETE TO authenticated
  USING (public.despesas_pode_excluir_aba(auth.uid(), 'veiculos'));
