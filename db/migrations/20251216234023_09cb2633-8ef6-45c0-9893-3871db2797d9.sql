-- ═══════════════════════════════════════════════════════════
-- TABELA: location_rotation_queue
-- Gerencia a fila de rotação de corretores por local externo
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.location_rotation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  queue_position integer NOT NULL DEFAULT 0,
  last_assignment_date date,
  times_assigned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, broker_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_location_rotation_queue_location ON public.location_rotation_queue(location_id);
CREATE INDEX IF NOT EXISTS idx_location_rotation_queue_broker ON public.location_rotation_queue(broker_id);
CREATE INDEX IF NOT EXISTS idx_location_rotation_queue_position ON public.location_rotation_queue(location_id, queue_position);

-- Habilitar RLS
ALTER TABLE public.location_rotation_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin can manage location_rotation_queue" 
  ON public.location_rotation_queue FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can view location_rotation_queue" 
  ON public.location_rotation_queue FOR SELECT 
  USING (has_role(auth.uid(), 'manager'::app_role));

-- ═══════════════════════════════════════════════════════════
-- FUNÇÃO: sync_location_rotation_queue
-- Sincroniza a fila quando corretores são adicionados/removidos
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_location_rotation_queue(p_location_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_added INTEGER := 0;
  v_max_position INTEGER;
  v_location_type TEXT;
BEGIN
  -- Verificar se é local externo
  SELECT location_type INTO v_location_type
  FROM locations
  WHERE id = p_location_id;
  
  IF v_location_type != 'external' THEN
    RETURN json_build_object('success', false, 'reason', 'Local não é externo');
  END IF;

  -- Obter posição máxima atual
  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM location_rotation_queue
  WHERE location_id = p_location_id;

  -- Adicionar novos corretores associados ao local que não estão na fila
  INSERT INTO location_rotation_queue (location_id, broker_id, queue_position)
  SELECT 
    p_location_id,
    lb.broker_id,
    v_max_position + ROW_NUMBER() OVER (ORDER BY b.name)
  FROM location_brokers lb
  JOIN brokers b ON b.id = lb.broker_id
  WHERE lb.location_id = p_location_id
    AND b.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM location_rotation_queue lrq
      WHERE lrq.broker_id = lb.broker_id AND lrq.location_id = p_location_id
    );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- Remover da fila corretores que não estão mais associados ao local ou estão inativos
  DELETE FROM location_rotation_queue lrq
  WHERE lrq.location_id = p_location_id
    AND NOT EXISTS (
      SELECT 1 FROM location_brokers lb
      JOIN brokers b ON b.id = lb.broker_id
      WHERE lb.broker_id = lrq.broker_id 
        AND lb.location_id = p_location_id
        AND b.is_active = true
    );

  -- Reordenar posições para evitar gaps
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) as new_pos
    FROM location_rotation_queue
    WHERE location_id = p_location_id
  )
  UPDATE location_rotation_queue lrq
  SET queue_position = ranked.new_pos
  FROM ranked
  WHERE lrq.id = ranked.id;

  RETURN json_build_object(
    'success', true,
    'added', v_added,
    'location_id', p_location_id
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- FUNÇÃO: get_location_rotation_queue
-- Retorna a fila de rotação ordenada por posição
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_location_rotation_queue(p_location_id uuid)
RETURNS TABLE(
  broker_id uuid,
  broker_name text,
  queue_position integer,
  last_assignment_date date,
  times_assigned integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lrq.broker_id,
    b.name as broker_name,
    lrq.queue_position,
    lrq.last_assignment_date,
    lrq.times_assigned
  FROM location_rotation_queue lrq
  INNER JOIN brokers b ON b.id = lrq.broker_id
  WHERE lrq.location_id = p_location_id
  ORDER BY lrq.queue_position ASC;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- FUNÇÃO: update_location_queue_after_allocation
-- Move o corretor para o final da fila após alocação
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_location_queue_after_allocation(
  p_location_id uuid, 
  p_broker_id uuid, 
  p_assignment_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_position INTEGER;
BEGIN
  -- Obter posição máxima atual
  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM location_rotation_queue
  WHERE location_id = p_location_id;

  -- Atualizar o corretor: mover para o final da fila
  UPDATE location_rotation_queue
  SET 
    queue_position = v_max_position + 1,
    last_assignment_date = p_assignment_date,
    times_assigned = times_assigned + 1,
    updated_at = now()
  WHERE location_id = p_location_id AND broker_id = p_broker_id;

  -- Reordenar posições para evitar gaps
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) as new_pos
    FROM location_rotation_queue
    WHERE location_id = p_location_id
  )
  UPDATE location_rotation_queue lrq
  SET queue_position = ranked.new_pos
  FROM ranked
  WHERE lrq.id = ranked.id;

  RETURN json_build_object(
    'success', true, 
    'broker_id', p_broker_id,
    'location_id', p_location_id,
    'new_position', v_max_position + 1
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- FUNÇÃO: bulk_update_location_queues_after_allocation
-- Atualiza múltiplas filas de uma vez após geração de escala
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bulk_update_location_queues_after_allocation(
  p_allocations jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_allocation jsonb;
  v_updated INTEGER := 0;
BEGIN
  -- p_allocations deve ser um array de objetos: [{"location_id": "...", "broker_id": "...", "assignment_date": "..."}]
  FOR v_allocation IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    PERFORM update_location_queue_after_allocation(
      (v_allocation->>'location_id')::uuid,
      (v_allocation->>'broker_id')::uuid,
      (v_allocation->>'assignment_date')::date
    );
    v_updated := v_updated + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_updated);
END;
$$;