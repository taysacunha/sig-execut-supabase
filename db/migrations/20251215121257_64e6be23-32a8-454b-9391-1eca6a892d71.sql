-- 1. Criar tabela de fila de rotação de sábado
CREATE TABLE public.saturday_rotation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL,
  last_saturday_date DATE,
  times_worked INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, broker_id)
);

-- 2. Criar tabela de estatísticas semanais por corretor
CREATE TABLE public.broker_weekly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  external_count INTEGER DEFAULT 0,
  internal_count INTEGER DEFAULT 0,
  saturday_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(broker_id, week_start)
);

-- 3. Habilitar RLS nas tabelas
ALTER TABLE public.saturday_rotation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_weekly_stats ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para saturday_rotation_queue
CREATE POLICY "Admin can manage saturday_rotation_queue" ON public.saturday_rotation_queue
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can view saturday_rotation_queue" ON public.saturday_rotation_queue
FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));

-- 5. Políticas RLS para broker_weekly_stats
CREATE POLICY "Admin can manage broker_weekly_stats" ON public.broker_weekly_stats
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can view broker_weekly_stats" ON public.broker_weekly_stats
FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));

-- 6. Trigger para sincronizar status do corretor com a fila
CREATE OR REPLACE FUNCTION public.sync_broker_saturday_queue_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se corretor foi desativado, marcar na fila
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE saturday_rotation_queue 
    SET is_active = false, updated_at = now()
    WHERE broker_id = NEW.id;
  END IF;
  
  -- Se corretor foi reativado, reativar na fila
  IF OLD.is_active = false AND NEW.is_active = true THEN
    UPDATE saturday_rotation_queue 
    SET is_active = true, updated_at = now()
    WHERE broker_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER broker_status_sync_saturday_queue
AFTER UPDATE OF is_active ON public.brokers
FOR EACH ROW
EXECUTE FUNCTION public.sync_broker_saturday_queue_status();

-- 7. Função para sincronizar/inicializar fila de sábado
CREATE OR REPLACE FUNCTION public.sync_saturday_queue(p_location_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added INTEGER := 0;
  v_deactivated INTEGER := 0;
  v_max_position INTEGER;
BEGIN
  -- 1. Desativar na fila corretores que não têm mais disponibilidade no sábado
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
        AND (
          (b.weekday_shift_availability->'saturday'->>'morning') = 'true'
          OR (b.weekday_shift_availability->'saturday'->>'afternoon') = 'true'
        )
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
        AND (
          (b.weekday_shift_availability->'saturday'->>'morning') = 'true'
          OR (b.weekday_shift_availability->'saturday'->>'afternoon') = 'true'
        )
    );

  -- 3. Obter posição máxima atual
  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM saturday_rotation_queue
  WHERE location_id = p_location_id;

  -- 4. Adicionar novos corretores com disponibilidade no sábado
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
    AND (
      (b.weekday_shift_availability->'saturday'->>'morning') = 'true'
      OR (b.weekday_shift_availability->'saturday'->>'afternoon') = 'true'
    )
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
$$;

-- 8. Função para atualizar posições na fila após alocar sábado
CREATE OR REPLACE FUNCTION public.update_saturday_queue_after_allocation(
  p_location_id UUID,
  p_broker_ids UUID[],
  p_saturday_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_broker_id UUID;
  v_max_position INTEGER;
BEGIN
  -- Obter posição máxima atual
  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM saturday_rotation_queue
  WHERE location_id = p_location_id AND is_active = true;

  -- Para cada corretor alocado, mover para o final da fila
  FOREACH v_broker_id IN ARRAY p_broker_ids
  LOOP
    UPDATE saturday_rotation_queue
    SET 
      queue_position = v_max_position + 1,
      last_saturday_date = p_saturday_date,
      times_worked = times_worked + 1,
      updated_at = now()
    WHERE location_id = p_location_id AND broker_id = v_broker_id;
    
    v_max_position := v_max_position + 1;
  END LOOP;

  -- Reordenar posições para evitar gaps
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) as new_pos
    FROM saturday_rotation_queue
    WHERE location_id = p_location_id AND is_active = true
  )
  UPDATE saturday_rotation_queue srq
  SET queue_position = ranked.new_pos
  FROM ranked
  WHERE srq.id = ranked.id;

  RETURN json_build_object('success', true, 'updated_count', array_length(p_broker_ids, 1));
END;
$$;

-- 9. Função para obter fila de sábado ordenada
CREATE OR REPLACE FUNCTION public.get_saturday_queue(p_location_id UUID)
RETURNS TABLE(
  broker_id UUID,
  broker_name TEXT,
  queue_position INTEGER,
  last_saturday_date DATE,
  times_worked INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    srq.broker_id,
    b.name as broker_name,
    srq.queue_position,
    srq.last_saturday_date,
    srq.times_worked
  FROM saturday_rotation_queue srq
  INNER JOIN brokers b ON b.id = srq.broker_id
  WHERE srq.location_id = p_location_id
    AND srq.is_active = true
  ORDER BY srq.queue_position ASC;
END;
$$;

-- 10. Função para salvar estatísticas semanais
CREATE OR REPLACE FUNCTION public.save_broker_weekly_stats(
  p_broker_id UUID,
  p_week_start DATE,
  p_week_end DATE,
  p_external_count INTEGER,
  p_internal_count INTEGER,
  p_saturday_count INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO broker_weekly_stats (broker_id, week_start, week_end, external_count, internal_count, saturday_count)
  VALUES (p_broker_id, p_week_start, p_week_end, p_external_count, p_internal_count, p_saturday_count)
  ON CONFLICT (broker_id, week_start) 
  DO UPDATE SET 
    external_count = EXCLUDED.external_count,
    internal_count = EXCLUDED.internal_count,
    saturday_count = EXCLUDED.saturday_count,
    week_end = EXCLUDED.week_end,
    updated_at = now();
  
  RETURN json_build_object('success', true);
END;
$$;

-- 11. Função para obter estatísticas da semana anterior
CREATE OR REPLACE FUNCTION public.get_previous_week_stats(p_week_start DATE)
RETURNS TABLE(
  broker_id UUID,
  broker_name TEXT,
  external_count INTEGER,
  internal_count INTEGER,
  saturday_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_week_start DATE;
BEGIN
  v_previous_week_start := p_week_start - INTERVAL '7 days';
  
  RETURN QUERY
  SELECT 
    bws.broker_id,
    b.name as broker_name,
    bws.external_count,
    bws.internal_count,
    bws.saturday_count
  FROM broker_weekly_stats bws
  INNER JOIN brokers b ON b.id = bws.broker_id
  WHERE bws.week_start = v_previous_week_start;
END;
$$;

-- 12. Função para limpar stats de semanas específicas (para substituição)
CREATE OR REPLACE FUNCTION public.delete_weekly_stats_for_period(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM broker_weekly_stats
  WHERE week_start >= p_start_date AND week_start <= p_end_date;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN json_build_object('success', true, 'deleted', v_deleted);
END;
$$;