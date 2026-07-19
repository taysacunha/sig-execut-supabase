-- =====================================================================
-- Segurança: mover `credenciais` de despesas_lancamentos para tabela
-- separada com RLS restrita a editores/admin do módulo Despesas.
--
-- Motivo: o campo `credenciais` (jsonb) podia armazenar login/senha de
-- portais e informações de contato. A policy de SELECT em
-- despesas_lancamentos permite acesso amplo (qualquer usuário com
-- visualização do calendário para o centro de custo), o que viola o
-- princípio de menor privilégio. Padrão análogo a
-- ferias_colaboradores_dados_sensiveis.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.despesas_lancamentos_credenciais (
  lancamento_id uuid PRIMARY KEY REFERENCES public.despesas_lancamentos(id) ON DELETE CASCADE,
  credenciais jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_lancamentos_credenciais TO authenticated;
GRANT ALL ON public.despesas_lancamentos_credenciais TO service_role;

ALTER TABLE public.despesas_lancamentos_credenciais ENABLE ROW LEVEL SECURITY;

-- Backfill antes de remover a coluna original.
INSERT INTO public.despesas_lancamentos_credenciais (lancamento_id, credenciais)
SELECT id, credenciais
FROM public.despesas_lancamentos
WHERE credenciais IS NOT NULL AND credenciais <> '{}'::jsonb
ON CONFLICT (lancamento_id) DO UPDATE SET credenciais = EXCLUDED.credenciais;

ALTER TABLE public.despesas_lancamentos DROP COLUMN IF EXISTS credenciais;

-- Policies: apenas editores do módulo despesas ou admins podem ler/gravar.
DROP POLICY IF EXISTS "desp_cred_select" ON public.despesas_lancamentos_credenciais;
CREATE POLICY "desp_cred_select"
  ON public.despesas_lancamentos_credenciais FOR SELECT TO authenticated
  USING (
    public.can_edit_system(auth.uid(), 'despesas')
    OR public.is_admin_or_super(auth.uid())
  );

DROP POLICY IF EXISTS "desp_cred_insert" ON public.despesas_lancamentos_credenciais;
CREATE POLICY "desp_cred_insert"
  ON public.despesas_lancamentos_credenciais FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_system(auth.uid(), 'despesas')
    OR public.is_admin_or_super(auth.uid())
  );

DROP POLICY IF EXISTS "desp_cred_update" ON public.despesas_lancamentos_credenciais;
CREATE POLICY "desp_cred_update"
  ON public.despesas_lancamentos_credenciais FOR UPDATE TO authenticated
  USING (
    public.can_edit_system(auth.uid(), 'despesas')
    OR public.is_admin_or_super(auth.uid())
  )
  WITH CHECK (
    public.can_edit_system(auth.uid(), 'despesas')
    OR public.is_admin_or_super(auth.uid())
  );

DROP POLICY IF EXISTS "desp_cred_delete" ON public.despesas_lancamentos_credenciais;
CREATE POLICY "desp_cred_delete"
  ON public.despesas_lancamentos_credenciais FOR DELETE TO authenticated
  USING (
    public.can_edit_system(auth.uid(), 'despesas')
    OR public.is_admin_or_super(auth.uid())
  );