-- RPC: confirmar_recebimento_solicitacao (SECURITY DEFINER)
-- + Backfill de solicitante_nome quando estiver salvo como e-mail.

CREATE OR REPLACE FUNCTION public.confirmar_recebimento_solicitacao(
  p_solicitacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_solicitante uuid;
  v_status text;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT solicitante_user_id, status
    INTO v_solicitante, v_status
    FROM public.estoque_solicitacoes
   WHERE id = p_solicitacao_id;

  IF v_solicitante IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_solicitante <> v_uid THEN
    RAISE EXCEPTION 'Apenas o solicitante pode confirmar o recebimento';
  END IF;

  IF v_status <> 'entregue' THEN
    RAISE EXCEPTION 'A solicitação precisa estar como entregue para confirmar o recebimento (status atual: %)', v_status;
  END IF;

  UPDATE public.estoque_movimentacoes
     SET recebido_por_user_id = v_uid,
         recebido_em = now()
   WHERE solicitacao_id = p_solicitacao_id
     AND recebido_em IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'solicitacao_id', p_solicitacao_id,
    'updated_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_recebimento_solicitacao(uuid) TO authenticated;

-- Backfill solicitante_nome (quando estiver com e-mail)
UPDATE public.estoque_solicitacoes s
   SET solicitante_nome = up.name
  FROM public.user_profiles up
 WHERE up.user_id = s.solicitante_user_id
   AND up.name IS NOT NULL
   AND length(trim(up.name)) > 0
   AND s.solicitante_nome LIKE '%@%';
