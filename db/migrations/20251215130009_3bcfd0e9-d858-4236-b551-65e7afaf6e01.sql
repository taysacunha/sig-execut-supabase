-- Corrigir função sync_saturday_queue para usar formato de array
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
  -- 1. Desativar na fila corretores que não têm mais disponibilidade no sábado
  -- CORRIGIDO: Usar formato de ARRAY ao invés de objeto booleano
  UPDATE saturday_rotation_queue srq
  SET is_active = false, updated_at = now()
  WHERE srq.location_id = p_location_id
    AND srq.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM brokers b
      WHERE b.id = srq.broker_id
        AND b.is_active = true
        AND b.weekday_shift_availability IS NOT NULL
        AND (b.weekday_shift_availability->>'saturday') IS NOT NULL
        AND jsonb_array_length(COALESCE(b.weekday_shift_availability->'saturday', '[]'::jsonb)) > 0
    );
  GET DIAGNOSTICS v_deactivated = ROW_COUNT;

  -- 2. Reativar corretores que voltaram a ter disponibilidade
  UPDATE saturday_rotation_queue srq
  SET is_active = true, updated_at = now()
  WHERE srq.location_id = p_location_id
    AND srq.is_active = false
    AND EXISTS (
      SELECT 1 FROM brokers b
      WHERE b.id = srq.broker_id
        AND b.is_active = true
        AND b.weekday_shift_availability IS NOT NULL
        AND (b.weekday_shift_availability->>'saturday') IS NOT NULL
        AND jsonb_array_length(COALESCE(b.weekday_shift_availability->'saturday', '[]'::jsonb)) > 0
    );

  -- 3. Obter posição máxima atual
  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM saturday_rotation_queue
  WHERE location_id = p_location_id;

  -- 4. Adicionar novos corretores com disponibilidade no sábado (formato ARRAY)
  INSERT INTO saturday_rotation_queue (location_id, broker_id, queue_position, is_active)
  SELECT 
    p_location_id,
    b.id,
    v_max_position + ROW_NUMBER() OVER (ORDER BY b.name),
    true
  FROM brokers b
  WHERE b.is_active = true
    AND b.weekday_shift_availability IS NOT NULL
    AND (b.weekday_shift_availability->>'saturday') IS NOT NULL
    AND jsonb_array_length(COALESCE(b.weekday_shift_availability->'saturday', '[]'::jsonb)) > 0
    AND NOT EXISTS (
      SELECT 1 FROM saturday_rotation_queue srq
      WHERE srq.broker_id = b.id AND srq.location_id = p_location_id
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