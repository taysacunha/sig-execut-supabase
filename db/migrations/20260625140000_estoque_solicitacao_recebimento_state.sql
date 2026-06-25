-- Confirmação de recebimento como estado da própria solicitação.
-- Torna o botão "Confirmar Recebimento" independente de estoque_movimentacoes.

ALTER TABLE public.estoque_solicitacoes
  ADD COLUMN IF NOT EXISTS recebimento_confirmado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS recebimento_confirmado_por_user_id uuid NULL;

-- Backfill: solicitações já confirmadas via movimentações
UPDATE public.estoque_solicitacoes s
   SET recebimento_confirmado_em = sub.recebido_em,
       recebimento_confirmado_por_user_id = sub.recebido_por_user_id
  FROM (
    SELECT solicitacao_id,
           MIN(recebido_em) AS recebido_em,
           MIN(recebido_por_user_id) AS recebido_por_user_id
      FROM public.estoque_movimentacoes
     WHERE recebido_em IS NOT NULL
       AND solicitacao_id IS NOT NULL
     GROUP BY solicitacao_id
  ) sub
 WHERE sub.solicitacao_id = s.id
   AND s.recebimento_confirmado_em IS NULL;

-- RPC: passa a marcar a própria solicitação e tenta carimbar as movimentações
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
  v_ja_confirmado timestamptz;
  v_mov_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT solicitante_user_id, status, recebimento_confirmado_em
    INTO v_solicitante, v_status, v_ja_confirmado
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

  IF v_ja_confirmado IS NOT NULL THEN
    RETURN jsonb_build_object(
      'solicitacao_id', p_solicitacao_id,
      'solicitacao_updated', false,
      'movimentacoes_updated', 0,
      'already_confirmed', true
    );
  END IF;

  UPDATE public.estoque_solicitacoes
     SET recebimento_confirmado_em = now(),
         recebimento_confirmado_por_user_id = v_uid
   WHERE id = p_solicitacao_id;

  UPDATE public.estoque_movimentacoes
     SET recebido_por_user_id = v_uid,
         recebido_em = now()
   WHERE solicitacao_id = p_solicitacao_id
     AND recebido_em IS NULL;

  GET DIAGNOSTICS v_mov_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'solicitacao_id', p_solicitacao_id,
    'solicitacao_updated', true,
    'movimentacoes_updated', v_mov_count,
    'already_confirmed', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_recebimento_solicitacao(uuid) TO authenticated;