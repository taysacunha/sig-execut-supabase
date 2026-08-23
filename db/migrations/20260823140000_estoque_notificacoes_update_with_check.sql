-- Impede que um usuário transfira suas notificações de estoque para outro usuário
-- (a policy de UPDATE possuía apenas USING, sem WITH CHECK).

DROP POLICY IF EXISTS "Users can update own notifications" ON public.estoque_notificacoes;

CREATE POLICY "Users can update own notifications"
ON public.estoque_notificacoes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
