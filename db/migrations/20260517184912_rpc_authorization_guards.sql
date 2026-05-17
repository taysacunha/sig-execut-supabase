-- Adiciona guards de autorização (can_view_system / can_edit_system)
-- nas RPCs SECURITY DEFINER de Escalas e Vendas que estavam expostas
-- a qualquer usuário autenticado via PostgREST.

-- ============================================================
-- ESCALAS - MUTATIONS (can_edit_system 'escalas')
-- ============================================================

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
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

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

  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM saturday_rotation_queue
  WHERE location_id = p_location_id;

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

  RETURN json_build_object('success', true, 'added', v_added, 'deactivated', v_deactivated, 'location_id', p_location_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_saturday_queue_after_allocation(p_location_id uuid, p_broker_ids uuid[], p_saturday_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_broker_id UUID;
  v_max_position INTEGER;
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM saturday_rotation_queue
  WHERE location_id = p_location_id AND is_active = true;

  FOREACH v_broker_id IN ARRAY p_broker_ids
  LOOP
    UPDATE saturday_rotation_queue
    SET queue_position = v_max_position + 1,
        last_saturday_date = p_saturday_date,
        times_worked = times_worked + 1,
        updated_at = now()
    WHERE location_id = p_location_id AND broker_id = v_broker_id;
    v_max_position := v_max_position + 1;
  END LOOP;

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
$function$;

CREATE OR REPLACE FUNCTION public.save_broker_weekly_stats(p_broker_id uuid, p_week_start date, p_week_end date, p_external_count integer, p_internal_count integer, p_saturday_count integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.delete_weekly_stats_for_period(p_start_date date, p_end_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

  DELETE FROM broker_weekly_stats
  WHERE week_start >= p_start_date AND week_start <= p_end_date;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN json_build_object('success', true, 'deleted', v_deleted);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_location_rotation_queue(p_location_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_added INTEGER := 0;
  v_max_position INTEGER;
  v_location_type TEXT;
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

  SELECT location_type INTO v_location_type FROM locations WHERE id = p_location_id;

  IF v_location_type != 'external' THEN
    RETURN json_build_object('success', false, 'reason', 'Local não é externo');
  END IF;

  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM location_rotation_queue WHERE location_id = p_location_id;

  INSERT INTO location_rotation_queue (location_id, broker_id, queue_position)
  SELECT p_location_id, lb.broker_id, v_max_position + ROW_NUMBER() OVER (ORDER BY b.name)
  FROM location_brokers lb
  JOIN brokers b ON b.id = lb.broker_id
  WHERE lb.location_id = p_location_id
    AND b.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM location_rotation_queue lrq
      WHERE lrq.broker_id = lb.broker_id AND lrq.location_id = p_location_id
    );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  DELETE FROM location_rotation_queue lrq
  WHERE lrq.location_id = p_location_id
    AND NOT EXISTS (
      SELECT 1 FROM location_brokers lb
      JOIN brokers b ON b.id = lb.broker_id
      WHERE lb.broker_id = lrq.broker_id
        AND lb.location_id = p_location_id
        AND b.is_active = true
    );

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) as new_pos
    FROM location_rotation_queue WHERE location_id = p_location_id
  )
  UPDATE location_rotation_queue lrq
  SET queue_position = ranked.new_pos
  FROM ranked
  WHERE lrq.id = ranked.id;

  RETURN json_build_object('success', true, 'added', v_added, 'location_id', p_location_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_location_queue_after_allocation(p_location_id uuid, p_broker_id uuid, p_assignment_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max_position INTEGER;
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

  SELECT COALESCE(MAX(queue_position), 0) INTO v_max_position
  FROM location_rotation_queue WHERE location_id = p_location_id;

  UPDATE location_rotation_queue
  SET queue_position = v_max_position + 1,
      last_assignment_date = p_assignment_date,
      times_assigned = times_assigned + 1,
      updated_at = now()
  WHERE location_id = p_location_id AND broker_id = p_broker_id;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) as new_pos
    FROM location_rotation_queue WHERE location_id = p_location_id
  )
  UPDATE location_rotation_queue lrq
  SET queue_position = ranked.new_pos
  FROM ranked
  WHERE lrq.id = ranked.id;

  RETURN json_build_object('success', true, 'broker_id', p_broker_id, 'location_id', p_location_id, 'new_position', v_max_position + 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_update_location_queues_after_allocation(p_allocations jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allocation jsonb;
  v_updated INTEGER := 0;
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.aggregate_month_data(p_year_month text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_result JSON;
BEGIN
  IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
  END IF;

  DELETE FROM assignment_history_monthly WHERE year_month = p_year_month;

  INSERT INTO assignment_history_monthly (
    year_month, broker_id, broker_name, location_id, location_name,
    location_type, city, total_assignments, morning_count, afternoon_count
  )
  SELECT
    p_year_month, sa.broker_id, b.name, sa.location_id, l.name,
    l.location_type, l.city, COUNT(sa.id),
    SUM(CASE WHEN sa.shift_type = 'morning' THEN 1 ELSE 0 END),
    SUM(CASE WHEN sa.shift_type = 'afternoon' THEN 1 ELSE 0 END)
  FROM schedule_assignments sa
  INNER JOIN brokers b ON b.id = sa.broker_id
  INNER JOIN locations l ON l.id = sa.location_id
  WHERE TO_CHAR(sa.assignment_date, 'YYYY-MM') = p_year_month
  GROUP BY sa.broker_id, b.name, sa.location_id, l.name, l.location_type, l.city;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  v_result := json_build_object('success', true, 'year_month', p_year_month, 'records_aggregated', v_count);
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ============================================================
-- ESCALAS - READS (can_view_system 'escalas')
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_saturday_queue(p_location_id uuid)
 RETURNS TABLE(broker_id uuid, broker_name text, queue_position integer, last_saturday_date date, times_worked integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: acesso ao módulo Escalas necessário';
  END IF;

  RETURN QUERY
  SELECT srq.broker_id, b.name, srq.queue_position, srq.last_saturday_date, srq.times_worked
  FROM saturday_rotation_queue srq
  INNER JOIN brokers b ON b.id = srq.broker_id
  WHERE srq.location_id = p_location_id AND srq.is_active = true
  ORDER BY srq.queue_position ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_previous_week_stats(p_week_start date)
 RETURNS TABLE(broker_id uuid, broker_name text, external_count integer, internal_count integer, saturday_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_previous_week_start DATE;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: acesso ao módulo Escalas necessário';
  END IF;

  v_previous_week_start := p_week_start - INTERVAL '7 days';

  RETURN QUERY
  SELECT bws.broker_id, b.name, bws.external_count, bws.internal_count, bws.saturday_count
  FROM broker_weekly_stats bws
  INNER JOIN brokers b ON b.id = bws.broker_id
  WHERE bws.week_start = v_previous_week_start;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_location_rotation_queue(p_location_id uuid)
 RETURNS TABLE(broker_id uuid, broker_name text, queue_position integer, last_assignment_date date, times_assigned integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: acesso ao módulo Escalas necessário';
  END IF;

  RETURN QUERY
  SELECT lrq.broker_id, b.name, lrq.queue_position, lrq.last_assignment_date, lrq.times_assigned
  FROM location_rotation_queue lrq
  INNER JOIN brokers b ON b.id = lrq.broker_id
  WHERE lrq.location_id = p_location_id
  ORDER BY lrq.queue_position ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_weekday_distribution_hybrid(start_date date, end_date date)
 RETURNS TABLE(weekday integer, weekday_name text, total_assignments bigint, morning_count bigint, afternoon_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  has_live_data BOOLEAN;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Acesso negado: acesso ao módulo Escalas necessário';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN start_date AND end_date
    LIMIT 1
  ) INTO has_live_data;

  IF has_live_data THEN
    RETURN QUERY
    SELECT
      EXTRACT(DOW FROM sa.assignment_date)::INT,
      CASE EXTRACT(DOW FROM sa.assignment_date)::INT
        WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta' WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
      END,
      COUNT(sa.id),
      SUM(CASE WHEN sa.shift_type = 'morning' THEN 1 ELSE 0 END),
      SUM(CASE WHEN sa.shift_type = 'afternoon' THEN 1 ELSE 0 END)
    FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN start_date AND end_date
    GROUP BY EXTRACT(DOW FROM sa.assignment_date)
    ORDER BY 1;
  ELSE
    RETURN QUERY
    SELECT
      day_num,
      CASE day_num
        WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta' WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
      END,
      0::BIGINT, 0::BIGINT, 0::BIGINT
    FROM generate_series(0, 6) as day_num
    ORDER BY day_num;
  END IF;
END;
$function$;

-- ============================================================
-- VENDAS - READS (can_view_system 'vendas')
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_sales_dashboard_summary_flexible(p_year text, p_month text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  year_month_pattern text;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'vendas') THEN
    RAISE EXCEPTION 'Acesso negado: acesso ao módulo Vendas necessário';
  END IF;

  IF p_month IS NULL THEN
    year_month_pattern := p_year || '-%';
  ELSE
    year_month_pattern := p_year || '-' || p_month;
  END IF;

  SELECT json_build_object(
    'total_vgv', COALESCE((
      SELECT SUM(sale_value) FROM sales
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
    ), 0),
    'total_sales', (
      SELECT COUNT(*) FROM sales
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
    ),
    'total_proposals', COALESCE((
      SELECT SUM(proposals_count) FROM broker_monthly_proposals
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
    ), 0),
    'pending_proposals', COALESCE((
      SELECT SUM(proposals_count) - SUM(proposals_converted) FROM broker_monthly_proposals
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
    ), 0),
    'converted_proposals', COALESCE((
      SELECT SUM(proposals_converted) FROM broker_monthly_proposals
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
    ), 0),
    'active_brokers', (SELECT COUNT(*) FROM sales_brokers WHERE is_active = true),
    'active_teams', (SELECT COUNT(*) FROM sales_teams WHERE is_active = true)
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_team_vgv_ranking_flexible(p_year text, p_month text DEFAULT NULL::text)
 RETURNS TABLE(team_id uuid, team_name text, total_vgv numeric, total_sales bigint, broker_count bigint, rank bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  year_month_pattern text;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'vendas') THEN
    RAISE EXCEPTION 'Acesso negado: acesso ao módulo Vendas necessário';
  END IF;

  IF p_month IS NULL THEN
    year_month_pattern := p_year || '-%';
  ELSE
    year_month_pattern := p_year || '-' || p_month;
  END IF;

  RETURN QUERY
  SELECT
    st.id, st.name,
    COALESCE(SUM(s.sale_value), 0)::numeric,
    COUNT(DISTINCT s.id)::bigint,
    COUNT(DISTINCT s.broker_id)::bigint,
    RANK() OVER (ORDER BY COALESCE(SUM(s.sale_value), 0) DESC)::bigint
  FROM sales_teams st
  LEFT JOIN sales s ON s.team_id = st.id
    AND CASE
      WHEN p_month IS NULL THEN s.year_month LIKE year_month_pattern
      ELSE s.year_month = year_month_pattern
    END
  WHERE st.is_active = true
  GROUP BY st.id, st.name
  ORDER BY 3 DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_broker_vgv_ranking_flexible(p_year text, p_month text DEFAULT NULL::text)
 RETURNS TABLE(broker_id uuid, broker_name text, team_name text, total_vgv numeric, total_sales bigint, rank bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  year_month_pattern text;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'vendas') THEN
    RAISE EXCEPTION 'Acesso negado: acesso ao módulo Vendas necessário';
  END IF;

  IF p_month IS NULL THEN
    year_month_pattern := p_year || '-%';
  ELSE
    year_month_pattern := p_year || '-' || p_month;
  END IF;

  RETURN QUERY
  SELECT
    sb.id, sb.name,
    COALESCE(st.name, 'Sem equipe')::text,
    COALESCE(SUM(bsp.proportional_value), 0)::numeric,
    COUNT(DISTINCT bsp.sale_id)::bigint,
    RANK() OVER (ORDER BY COALESCE(SUM(bsp.proportional_value), 0) DESC)::bigint
  FROM public.broker_sales_proportional bsp
  INNER JOIN public.sales_brokers sb ON sb.id = bsp.broker_id
  LEFT JOIN public.sales_teams st ON st.id = bsp.team_id
  WHERE CASE
      WHEN p_month IS NULL THEN bsp.year_month LIKE year_month_pattern
      ELSE bsp.year_month = year_month_pattern
    END
  GROUP BY sb.id, sb.name, st.name
  ORDER BY 4 DESC;
END;
$function$;