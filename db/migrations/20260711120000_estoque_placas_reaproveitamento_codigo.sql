-- =============================================
-- ESTOQUE — Reaproveitamento de código de placa roubada/perdida
-- Transfere o código de uma placa com status 'roubada'/'perdida' para uma
-- placa física já disponível que ainda está sem código.
-- Nenhum saldo é movimentado (a placa destino já foi consumida do saldo).
-- =============================================

BEGIN;

-- 1) Ampliar o CHECK do tipo de histórico
ALTER TABLE public.estoque_placas_historico
  DROP CONSTRAINT IF EXISTS estoque_placas_historico_tipo_check;

ALTER TABLE public.estoque_placas_historico
  ADD CONSTRAINT estoque_placas_historico_tipo_check
  CHECK (tipo IN (
    'criacao','reposicao','instalacao','retirada',
    'roubo','perda','baixa','reaproveitamento_codigo'
  ));

-- 2) RPC transacional
CREATE OR REPLACE FUNCTION public.reaproveitar_codigo_placa(
  p_placa_destino_id uuid,
  p_placa_origem_id  uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo         text;
  v_origem_status  text;
  v_destino_codigo text;
  v_destino_status text;
  v_user           uuid;
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'estoque') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Estoque necessária';
  END IF;

  v_user := auth.uid();

  SELECT codigo, status INTO v_codigo, v_origem_status
  FROM public.estoque_placas
  WHERE id = p_placa_origem_id
  FOR UPDATE;

  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Placa de origem não possui código para reaproveitar';
  END IF;

  IF v_origem_status NOT IN ('roubada','perdida') THEN
    RAISE EXCEPTION 'Somente códigos de placas roubadas ou perdidas podem ser reaproveitados';
  END IF;

  SELECT codigo, status INTO v_destino_codigo, v_destino_status
  FROM public.estoque_placas
  WHERE id = p_placa_destino_id
  FOR UPDATE;

  IF v_destino_codigo IS NOT NULL THEN
    RAISE EXCEPTION 'Placa de destino já possui código';
  END IF;

  IF v_destino_status <> 'disponivel' THEN
    RAISE EXCEPTION 'Placa de destino precisa estar disponível';
  END IF;

  -- Libera o código da origem
  UPDATE public.estoque_placas
  SET codigo = NULL, updated_at = now()
  WHERE id = p_placa_origem_id;

  -- Atribui à destino
  UPDATE public.estoque_placas
  SET codigo = v_codigo, updated_at = now()
  WHERE id = p_placa_destino_id;

  -- Histórico nas duas
  INSERT INTO public.estoque_placas_historico
    (placa_id, tipo, data_evento, observacoes, user_id)
  VALUES
    (p_placa_destino_id, 'reaproveitamento_codigo', CURRENT_DATE,
     'Código ' || v_codigo || ' reaproveitado da placa ' || p_placa_origem_id::text
       || ' (' || v_origem_status || ')', v_user),
    (p_placa_origem_id,  'reaproveitamento_codigo', CURRENT_DATE,
     'Código ' || v_codigo || ' transferido para placa ' || p_placa_destino_id::text,
     v_user);

  RETURN p_placa_destino_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reaproveitar_codigo_placa(uuid, uuid) TO authenticated;

COMMIT;