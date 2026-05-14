-- Corrigir função sync_saturday_queue para usar location_brokers
-- Isso garante que apenas corretores do local específico com disponibilidade no sábado entrem na fila
CREATE OR REPLACE FUNCTION public.sync_saturday_queue(p_location_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_added INTEGER := 0;
  v_deactivated INTEGER := 0;
  v_max_position INTEGER;
BEGIN
  -- 1. Desativar na fila corretores que não têm mais disponibilidade no sábado PARA ESTE LOCAL
  UPDATE saturday_rotation_queue srq
  SET is_active = false, updated_at = now()
  WHERE srq.location_id = p_location_id
    AND srq.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM location_brokers lb
      JOIN brokers b ON b.id = lb.broker_id
      WHERE lb.broker_id = srq.broker_id
        AND lb.location_id = p_location_id
        AND b.is_active = true
        AND lb.weekday_shift_availability IS NOT NULL
        AND (lb.weekday_shift_availability->>'saturday') IS NOT NULL
        AND jsonb_array_length(COALESCE(lb.weekday_shift_availability->'saturday', '[]'::jsonb)) > 0
    );
  GET DIAGNOSTICS v_deactivated = ROW_COUNT;

  -- 2. Reativar corretores que voltaram a ter disponibilidade PARA ESTE LOCAL
  UPDATE saturday_rotation_queue srq
  SET is_active = true, updated_at = now()
  WHERE srq.location_id = p_location_id
    AND srq.is_active = false
    AND EXISTS (
      SELECT 1 FROM location_brokers lb
      JOIN brokers b ON b.id = lb.broker_id
      WHERE lb.broker_id = srq.broker_id
        AND lb.location_id = p_location_id
        AND b.is_active = true
        AND lb.weekday_shift_availability IS NOT NULL
        AND (lb.weekday_shift_availability->>'saturday') IS NOT NULL
        AND jsonb_array_length(COALESCE(lb.weekday_shift_availability->'saturday', '[]'::jsonb)) > 0
    );

  -- 3. Obter posição máxima atual
  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM saturday_rotation_queue
  WHERE location_id = p_location_id;

  -- 4. Adicionar novos corretores com disponibilidade no sábado PARA ESTE LOCAL
  INSERT INTO saturday_rotation_queue (location_id, broker_id, queue_position, is_active)
  SELECT 
    p_location_id,
    lb.broker_id,
    v_max_position + ROW_NUMBER() OVER (ORDER BY b.name),
    true
  FROM location_brokers lb
  JOIN brokers b ON b.id = lb.broker_id
  WHERE lb.location_id = p_location_id
    AND b.is_active = true
    AND lb.weekday_shift_availability IS NOT NULL
    AND (lb.weekday_shift_availability->>'saturday') IS NOT NULL
    AND jsonb_array_length(COALESCE(lb.weekday_shift_availability->'saturday', '[]'::jsonb)) > 0
    AND NOT EXISTS (
      SELECT 1 FROM saturday_rotation_queue srq
      WHERE srq.broker_id = lb.broker_id AND srq.location_id = p_location_id
    );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'added', v_added, 
    'deactivated', v_deactivated,
    'location_id', p_location_id
  );
END;
$function$;