-- Guard SECURITY DEFINER dashboard RPCs with escalas access check

CREATE OR REPLACE FUNCTION public.get_top_brokers(days_ago integer, limit_count integer)
 RETURNS TABLE(name text, count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  RETURN QUERY
  SELECT b.name, COUNT(sa.id)::BIGINT
  FROM schedule_assignments sa
  INNER JOIN brokers b ON b.id = sa.broker_id
  WHERE sa.assignment_date >= (CURRENT_DATE - days_ago)
  GROUP BY b.name ORDER BY COUNT(sa.id) DESC LIMIT limit_count;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_top_locations(days_ago integer, limit_count integer)
 RETURNS TABLE(name text, count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  RETURN QUERY
  SELECT l.name, COUNT(sa.id)::BIGINT
  FROM schedule_assignments sa
  INNER JOIN locations l ON l.id = sa.location_id
  WHERE sa.assignment_date >= (CURRENT_DATE - days_ago)
  GROUP BY l.name ORDER BY COUNT(sa.id) DESC LIMIT limit_count;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_shift_stats(days_ago integer)
 RETURNS TABLE(shift_type text, count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  RETURN QUERY
  SELECT sa.shift_type, COUNT(sa.id)::BIGINT
  FROM schedule_assignments sa
  WHERE sa.assignment_date >= (CURRENT_DATE - days_ago)
  GROUP BY sa.shift_type ORDER BY sa.shift_type;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_weekly_assignments(weeks_count integer)
 RETURNS TABLE(week_label text, count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  RETURN QUERY
  SELECT TO_CHAR(DATE_TRUNC('week', sa.assignment_date), 'DD/MM'), COUNT(sa.id)::BIGINT
  FROM schedule_assignments sa
  WHERE sa.assignment_date >= (CURRENT_DATE - (weeks_count * 7))
  GROUP BY DATE_TRUNC('week', sa.assignment_date)
  ORDER BY DATE_TRUNC('week', sa.assignment_date) ASC;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_dashboard_counts()
 RETURNS json
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  RETURN json_build_object(
    'brokers', (SELECT COUNT(*) FROM brokers WHERE is_active = true),
    'locations', (SELECT COUNT(*) FROM locations WHERE is_active = true),
    'schedules', (SELECT COUNT(*) FROM generated_schedules WHERE is_active = true)
  );
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_top_brokers_hybrid(target_month text, limit_count integer)
 RETURNS TABLE(name text, count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE month_start DATE; month_end DATE; has_live_data BOOLEAN;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  month_start := (target_month || '-01')::DATE;
  month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;
  SELECT EXISTS(SELECT 1 FROM schedule_assignments sa WHERE sa.assignment_date BETWEEN month_start AND month_end LIMIT 1) INTO has_live_data;
  IF has_live_data THEN
    RETURN QUERY SELECT b.name, COUNT(sa.id)::BIGINT
    FROM schedule_assignments sa INNER JOIN brokers b ON b.id = sa.broker_id
    WHERE sa.assignment_date BETWEEN month_start AND month_end
    GROUP BY b.name ORDER BY COUNT(sa.id) DESC LIMIT limit_count;
  ELSE
    RETURN QUERY SELECT ahm.broker_name, SUM(ahm.total_assignments)::BIGINT
    FROM assignment_history_monthly ahm WHERE ahm.year_month = target_month
    GROUP BY ahm.broker_name ORDER BY SUM(ahm.total_assignments) DESC LIMIT limit_count;
  END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_top_locations_hybrid(target_month text, limit_count integer)
 RETURNS TABLE(name text, count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE month_start DATE; month_end DATE; has_live_data BOOLEAN;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  month_start := (target_month || '-01')::DATE;
  month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;
  SELECT EXISTS(SELECT 1 FROM schedule_assignments sa WHERE sa.assignment_date BETWEEN month_start AND month_end LIMIT 1) INTO has_live_data;
  IF has_live_data THEN
    RETURN QUERY SELECT l.name, COUNT(sa.id)::BIGINT
    FROM schedule_assignments sa INNER JOIN locations l ON l.id = sa.location_id
    WHERE sa.assignment_date BETWEEN month_start AND month_end
    GROUP BY l.name ORDER BY COUNT(sa.id) DESC LIMIT limit_count;
  ELSE
    RETURN QUERY SELECT ahm.location_name, SUM(ahm.total_assignments)::BIGINT
    FROM assignment_history_monthly ahm WHERE ahm.year_month = target_month
    GROUP BY ahm.location_name ORDER BY SUM(ahm.total_assignments) DESC LIMIT limit_count;
  END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_broker_performance_hybrid(start_date date, end_date date)
 RETURNS TABLE(broker_id uuid, broker_name text, total_assignments bigint, morning_count bigint, afternoon_count bigint, unique_locations bigint, last_assignment date)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE has_live_data BOOLEAN;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  SELECT EXISTS(SELECT 1 FROM schedule_assignments sa WHERE sa.assignment_date BETWEEN start_date AND end_date LIMIT 1) INTO has_live_data;
  IF has_live_data THEN
    RETURN QUERY SELECT b.id, b.name, COUNT(sa.id),
      SUM(CASE WHEN sa.shift_type='morning' THEN 1 ELSE 0 END),
      SUM(CASE WHEN sa.shift_type='afternoon' THEN 1 ELSE 0 END),
      COUNT(DISTINCT sa.location_id), MAX(sa.assignment_date)
    FROM brokers b
    LEFT JOIN schedule_assignments sa ON sa.broker_id = b.id AND sa.assignment_date BETWEEN start_date AND end_date
    WHERE b.is_active = true GROUP BY b.id, b.name ORDER BY COUNT(sa.id) DESC;
  ELSE
    RETURN QUERY SELECT COALESCE(ahm.broker_id, b.id), COALESCE(ahm.broker_name, b.name),
      COALESCE(SUM(ahm.total_assignments),0)::BIGINT,
      COALESCE(SUM(ahm.morning_count),0)::BIGINT,
      COALESCE(SUM(ahm.afternoon_count),0)::BIGINT,
      COUNT(DISTINCT ahm.location_id)::BIGINT, NULL::date
    FROM brokers b
    LEFT JOIN assignment_history_monthly ahm ON ahm.broker_id = b.id
      AND ahm.year_month >= TO_CHAR(start_date,'YYYY-MM')
      AND ahm.year_month <= TO_CHAR(end_date,'YYYY-MM')
    WHERE b.is_active = true
    GROUP BY COALESCE(ahm.broker_id, b.id), COALESCE(ahm.broker_name, b.name)
    ORDER BY COALESCE(SUM(ahm.total_assignments),0) DESC;
  END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_location_performance_hybrid(start_date date, end_date date)
 RETURNS TABLE(location_id uuid, location_name text, location_type text, city text, state text, total_assignments bigint, days_covered bigint, unique_brokers bigint, morning_count bigint, afternoon_count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE has_live_data BOOLEAN;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  SELECT EXISTS(SELECT 1 FROM schedule_assignments sa WHERE sa.assignment_date BETWEEN start_date AND end_date LIMIT 1) INTO has_live_data;
  IF has_live_data THEN
    RETURN QUERY SELECT l.id, l.name, l.location_type, l.city, l.state,
      COUNT(sa.id), COUNT(DISTINCT sa.assignment_date), COUNT(DISTINCT sa.broker_id),
      SUM(CASE WHEN sa.shift_type='morning' THEN 1 ELSE 0 END),
      SUM(CASE WHEN sa.shift_type='afternoon' THEN 1 ELSE 0 END)
    FROM locations l
    LEFT JOIN schedule_assignments sa ON sa.location_id = l.id AND sa.assignment_date BETWEEN start_date AND end_date
    WHERE l.is_active = true GROUP BY l.id, l.name, l.location_type, l.city, l.state
    ORDER BY COUNT(sa.id) DESC;
  ELSE
    RETURN QUERY SELECT COALESCE(ahm.location_id, l.id), COALESCE(ahm.location_name, l.name),
      COALESCE(ahm.location_type, l.location_type), COALESCE(ahm.city, l.city), l.state,
      COALESCE(SUM(ahm.total_assignments),0)::BIGINT, 0::BIGINT,
      COUNT(DISTINCT ahm.broker_id)::BIGINT,
      COALESCE(SUM(ahm.morning_count),0)::BIGINT,
      COALESCE(SUM(ahm.afternoon_count),0)::BIGINT
    FROM locations l
    LEFT JOIN assignment_history_monthly ahm ON ahm.location_id = l.id
      AND ahm.year_month >= TO_CHAR(start_date,'YYYY-MM')
      AND ahm.year_month <= TO_CHAR(end_date,'YYYY-MM')
    WHERE l.is_active = true
    GROUP BY COALESCE(ahm.location_id, l.id), COALESCE(ahm.location_name, l.name),
             COALESCE(ahm.location_type, l.location_type), COALESCE(ahm.city, l.city), l.state
    ORDER BY COALESCE(SUM(ahm.total_assignments),0) DESC;
  END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_hybrid(target_month text)
 RETURNS json
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE result JSON; month_start DATE; month_end DATE; has_live_data BOOLEAN;
  total_assignments BIGINT; morning_total BIGINT; afternoon_total BIGINT;
BEGIN
  IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
    RAISE EXCEPTION 'Access denied: escalas system access required';
  END IF;
  month_start := (target_month || '-01')::DATE;
  month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;
  SELECT EXISTS(SELECT 1 FROM schedule_assignments sa WHERE sa.assignment_date BETWEEN month_start AND month_end LIMIT 1) INTO has_live_data;
  IF has_live_data THEN
    SELECT COUNT(*),
      SUM(CASE WHEN shift_type='morning' THEN 1 ELSE 0 END),
      SUM(CASE WHEN shift_type='afternoon' THEN 1 ELSE 0 END)
    INTO total_assignments, morning_total, afternoon_total
    FROM schedule_assignments WHERE assignment_date BETWEEN month_start AND month_end;
  ELSE
    SELECT COALESCE(SUM(ahm.total_assignments),0),
      COALESCE(SUM(ahm.morning_count),0),
      COALESCE(SUM(ahm.afternoon_count),0)
    INTO total_assignments, morning_total, afternoon_total
    FROM assignment_history_monthly ahm WHERE ahm.year_month = target_month;
  END IF;
  result := json_build_object(
    'total_assignments', total_assignments,
    'morning_count', morning_total,
    'afternoon_count', afternoon_total,
    'source', CASE WHEN has_live_data THEN 'live' ELSE 'history' END
  );
  RETURN result;
END; $fn$;
