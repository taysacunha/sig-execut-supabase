-- =============================================
-- Policy de confirmação de recebimento por solicitante
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE OR REPLACE FUNCTION public.is_solicitante_estoque(_user_id uuid, _solicitacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.estoque_solicitacoes
    WHERE id = _solicitacao_id
      AND solicitante_user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Solicitante can confirm receipt" ON public.estoque_movimentacoes;

CREATE POLICY "Solicitante can confirm receipt"
  ON public.estoque_movimentacoes
  FOR UPDATE
  TO authenticated
  USING (
    solicitacao_id IS NOT NULL
    AND public.is_solicitante_estoque(auth.uid(), solicitacao_id)
  )
  WITH CHECK (
    solicitacao_id IS NOT NULL
    AND public.is_solicitante_estoque(auth.uid(), solicitacao_id)
  );

-- Permite que o próprio solicitante cancele sua solicitação pendente
DROP POLICY IF EXISTS "Solicitante can cancel own request" ON public.estoque_solicitacoes;

CREATE POLICY "Solicitante can cancel own request"
  ON public.estoque_solicitacoes
  FOR UPDATE
  TO authenticated
  USING (solicitante_user_id = auth.uid())
  WITH CHECK (solicitante_user_id = auth.uid());
