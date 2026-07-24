-- RPC SECURITY DEFINER para registrar eventos customizados de auditoria
-- do módulo Férias em module_audit_logs (reversão de envio ao contador
-- e correção de período histórico da venda).

CREATE OR REPLACE FUNCTION public.registrar_evento_ferias(
  p_record_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  IF p_action NOT IN ('REVERSAO_ENVIO_CONTADOR', 'CORRECAO_QUINZENA_VENDA') THEN
    RAISE EXCEPTION 'Ação não permitida: %', p_action;
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.module_audit_logs (
    module_name, table_name, record_id, action,
    old_data, new_data, changed_fields, changed_by, changed_by_email
  ) VALUES (
    'ferias', 'ferias_ferias', p_record_id, p_action,
    NULL, p_payload, NULL, v_user_id, COALESCE(v_email, 'sistema@interno')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_evento_ferias(uuid, text, jsonb) TO authenticated;