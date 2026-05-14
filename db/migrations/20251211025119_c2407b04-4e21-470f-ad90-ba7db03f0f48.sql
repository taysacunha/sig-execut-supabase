-- Migração com rollback automático para políticas RLS da tabela brokers
DO $$
BEGIN
  -- Remover políticas antigas RESTRICTIVE
  DROP POLICY IF EXISTS "Admin can delete brokers" ON public.brokers;
  DROP POLICY IF EXISTS "Admin can insert brokers" ON public.brokers;
  DROP POLICY IF EXISTS "Admin can update brokers" ON public.brokers;
  DROP POLICY IF EXISTS "Admin can view all brokers" ON public.brokers;
  DROP POLICY IF EXISTS "Manager can view all brokers" ON public.brokers;

  -- Criar novas políticas PERMISSIVE
  CREATE POLICY "Admin can view all brokers" ON public.brokers
    FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

  CREATE POLICY "Manager can view all brokers" ON public.brokers
    FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'manager'::app_role));

  CREATE POLICY "Admin can insert brokers" ON public.brokers
    FOR INSERT
    TO authenticated
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

  CREATE POLICY "Admin can update brokers" ON public.brokers
    FOR UPDATE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

  CREATE POLICY "Admin can delete brokers" ON public.brokers
    FOR DELETE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));

  RAISE NOTICE 'Políticas RLS da tabela brokers atualizadas com sucesso!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao atualizar políticas RLS: %. Rollback automático executado.', SQLERRM;
END;
$$;