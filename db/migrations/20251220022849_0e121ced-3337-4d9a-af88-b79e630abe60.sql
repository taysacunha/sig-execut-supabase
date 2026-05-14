-- Função híbrida para performance de corretores
CREATE OR REPLACE FUNCTION get_broker_performance_hybrid(start_date date, end_date date)
RETURNS TABLE(
  broker_id uuid, 
  broker_name text, 
  total_assignments bigint, 
  morning_count bigint, 
  afternoon_count bigint, 
  unique_locations bigint, 
  last_assignment date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_live_data BOOLEAN;
BEGIN
  -- Verificar se há dados "ao vivo" no período
  SELECT EXISTS(
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN start_date AND end_date
    LIMIT 1
  ) INTO has_live_data;

  IF has_live_data THEN
    -- Usar dados ao vivo de schedule_assignments
    RETURN QUERY
    SELECT 
      b.id,
      b.name,
      COUNT(sa.id) as total_assignments,
      SUM(CASE WHEN sa.shift_type = 'morning' THEN 1 ELSE 0 END) as morning_count,
      SUM(CASE WHEN sa.shift_type = 'afternoon' THEN 1 ELSE 0 END) as afternoon_count,
      COUNT(DISTINCT sa.location_id) as unique_locations,
      MAX(sa.assignment_date) as last_assignment
    FROM brokers b
    LEFT JOIN schedule_assignments sa ON sa.broker_id = b.id
      AND sa.assignment_date BETWEEN start_date AND end_date
    WHERE b.is_active = true
    GROUP BY b.id, b.name
    ORDER BY total_assignments DESC;
  ELSE
    -- Usar dados históricos de assignment_history_monthly
    RETURN QUERY
    SELECT 
      COALESCE(ahm.broker_id, b.id) as broker_id,
      COALESCE(ahm.broker_name, b.name) as broker_name,
      COALESCE(SUM(ahm.total_assignments), 0)::BIGINT as total_assignments,
      COALESCE(SUM(ahm.morning_count), 0)::BIGINT as morning_count,
      COALESCE(SUM(ahm.afternoon_count), 0)::BIGINT as afternoon_count,
      COUNT(DISTINCT ahm.location_id)::BIGINT as unique_locations,
      NULL::date as last_assignment
    FROM brokers b
    LEFT JOIN assignment_history_monthly ahm ON ahm.broker_id = b.id
      AND ahm.year_month >= TO_CHAR(start_date, 'YYYY-MM')
      AND ahm.year_month <= TO_CHAR(end_date, 'YYYY-MM')
    WHERE b.is_active = true
    GROUP BY COALESCE(ahm.broker_id, b.id), COALESCE(ahm.broker_name, b.name)
    ORDER BY total_assignments DESC;
  END IF;
END;
$$;

-- Função híbrida para performance de locais
CREATE OR REPLACE FUNCTION get_location_performance_hybrid(start_date date, end_date date)
RETURNS TABLE(
  location_id uuid, 
  location_name text, 
  location_type text, 
  city text, 
  state text, 
  total_assignments bigint, 
  days_covered bigint, 
  unique_brokers bigint, 
  morning_count bigint, 
  afternoon_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_live_data BOOLEAN;
BEGIN
  -- Verificar se há dados "ao vivo" no período
  SELECT EXISTS(
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN start_date AND end_date
    LIMIT 1
  ) INTO has_live_data;

  IF has_live_data THEN
    -- Usar dados ao vivo
    RETURN QUERY
    SELECT 
      l.id,
      l.name,
      l.location_type,
      l.city,
      l.state,
      COUNT(sa.id) as total_assignments,
      COUNT(DISTINCT sa.assignment_date) as days_covered,
      COUNT(DISTINCT sa.broker_id) as unique_brokers,
      SUM(CASE WHEN sa.shift_type = 'morning' THEN 1 ELSE 0 END) as morning_count,
      SUM(CASE WHEN sa.shift_type = 'afternoon' THEN 1 ELSE 0 END) as afternoon_count
    FROM locations l
    LEFT JOIN schedule_assignments sa ON sa.location_id = l.id
      AND sa.assignment_date BETWEEN start_date AND end_date
    WHERE l.is_active = true
    GROUP BY l.id, l.name, l.location_type, l.city, l.state
    ORDER BY total_assignments DESC;
  ELSE
    -- Usar dados históricos
    RETURN QUERY
    SELECT 
      COALESCE(ahm.location_id, l.id) as location_id,
      COALESCE(ahm.location_name, l.name) as location_name,
      COALESCE(ahm.location_type, l.location_type) as location_type,
      COALESCE(ahm.city, l.city) as city,
      l.state,
      COALESCE(SUM(ahm.total_assignments), 0)::BIGINT as total_assignments,
      0::BIGINT as days_covered, -- Não temos essa info no histórico agregado
      COUNT(DISTINCT ahm.broker_id)::BIGINT as unique_brokers,
      COALESCE(SUM(ahm.morning_count), 0)::BIGINT as morning_count,
      COALESCE(SUM(ahm.afternoon_count), 0)::BIGINT as afternoon_count
    FROM locations l
    LEFT JOIN assignment_history_monthly ahm ON ahm.location_id = l.id
      AND ahm.year_month >= TO_CHAR(start_date, 'YYYY-MM')
      AND ahm.year_month <= TO_CHAR(end_date, 'YYYY-MM')
    WHERE l.is_active = true
    GROUP BY COALESCE(ahm.location_id, l.id), COALESCE(ahm.location_name, l.name), 
             COALESCE(ahm.location_type, l.location_type), COALESCE(ahm.city, l.city), l.state
    ORDER BY total_assignments DESC;
  END IF;
END;
$$;

-- Função híbrida para distribuição por dia da semana
CREATE OR REPLACE FUNCTION get_weekday_distribution_hybrid(start_date date, end_date date)
RETURNS TABLE(
  weekday integer, 
  weekday_name text, 
  total_assignments bigint, 
  morning_count bigint, 
  afternoon_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_live_data BOOLEAN;
BEGIN
  -- Verificar se há dados "ao vivo" no período
  SELECT EXISTS(
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN start_date AND end_date
    LIMIT 1
  ) INTO has_live_data;

  IF has_live_data THEN
    -- Usar dados ao vivo
    RETURN QUERY
    SELECT 
      EXTRACT(DOW FROM sa.assignment_date)::INT as weekday,
      CASE EXTRACT(DOW FROM sa.assignment_date)::INT
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Segunda'
        WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta'
        WHEN 4 THEN 'Quinta'
        WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
      END as weekday_name,
      COUNT(sa.id) as total_assignments,
      SUM(CASE WHEN sa.shift_type = 'morning' THEN 1 ELSE 0 END) as morning_count,
      SUM(CASE WHEN sa.shift_type = 'afternoon' THEN 1 ELSE 0 END) as afternoon_count
    FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN start_date AND end_date
    GROUP BY EXTRACT(DOW FROM sa.assignment_date)
    ORDER BY weekday;
  ELSE
    -- Para histórico agregado, não temos info de dia da semana
    -- Retornamos dados agregados estimando distribuição uniforme
    RETURN QUERY
    SELECT 
      day_num as weekday,
      CASE day_num
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Segunda'
        WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta'
        WHEN 4 THEN 'Quinta'
        WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
      END as weekday_name,
      0::BIGINT as total_assignments,
      0::BIGINT as morning_count,
      0::BIGINT as afternoon_count
    FROM generate_series(0, 6) as day_num
    ORDER BY day_num;
  END IF;
END;
$$;

-- Função para obter totais do dashboard com suporte a histórico
CREATE OR REPLACE FUNCTION get_dashboard_stats_hybrid(target_month text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  month_start DATE;
  month_end DATE;
  has_live_data BOOLEAN;
  total_assignments BIGINT;
  morning_total BIGINT;
  afternoon_total BIGINT;
BEGIN
  month_start := (target_month || '-01')::DATE;
  month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;
  
  -- Verificar se há dados ao vivo
  SELECT EXISTS(
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN month_start AND month_end
    LIMIT 1
  ) INTO has_live_data;
  
  IF has_live_data THEN
    SELECT 
      COUNT(*),
      SUM(CASE WHEN shift_type = 'morning' THEN 1 ELSE 0 END),
      SUM(CASE WHEN shift_type = 'afternoon' THEN 1 ELSE 0 END)
    INTO total_assignments, morning_total, afternoon_total
    FROM schedule_assignments
    WHERE assignment_date BETWEEN month_start AND month_end;
  ELSE
    SELECT 
      COALESCE(SUM(ahm.total_assignments), 0),
      COALESCE(SUM(ahm.morning_count), 0),
      COALESCE(SUM(ahm.afternoon_count), 0)
    INTO total_assignments, morning_total, afternoon_total
    FROM assignment_history_monthly ahm
    WHERE ahm.year_month = target_month;
  END IF;
  
  result := json_build_object(
    'total_assignments', total_assignments,
    'morning_count', morning_total,
    'afternoon_count', afternoon_total,
    'source', CASE WHEN has_live_data THEN 'live' ELSE 'history' END
  );
  
  RETURN result;
END;
$$;

-- Função para top corretores com suporte a histórico
CREATE OR REPLACE FUNCTION get_top_brokers_hybrid(target_month text, limit_count integer)
RETURNS TABLE(name text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  month_start DATE;
  month_end DATE;
  has_live_data BOOLEAN;
BEGIN
  month_start := (target_month || '-01')::DATE;
  month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;
  
  SELECT EXISTS(
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN month_start AND month_end
    LIMIT 1
  ) INTO has_live_data;
  
  IF has_live_data THEN
    RETURN QUERY
    SELECT 
      b.name,
      COUNT(sa.id)::BIGINT as count
    FROM schedule_assignments sa
    INNER JOIN brokers b ON b.id = sa.broker_id
    WHERE sa.assignment_date BETWEEN month_start AND month_end
    GROUP BY b.name
    ORDER BY count DESC
    LIMIT limit_count;
  ELSE
    RETURN QUERY
    SELECT 
      ahm.broker_name as name,
      SUM(ahm.total_assignments)::BIGINT as count
    FROM assignment_history_monthly ahm
    WHERE ahm.year_month = target_month
    GROUP BY ahm.broker_name
    ORDER BY count DESC
    LIMIT limit_count;
  END IF;
END;
$$;

-- Função para top locais com suporte a histórico
CREATE OR REPLACE FUNCTION get_top_locations_hybrid(target_month text, limit_count integer)
RETURNS TABLE(name text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  month_start DATE;
  month_end DATE;
  has_live_data BOOLEAN;
BEGIN
  month_start := (target_month || '-01')::DATE;
  month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;
  
  SELECT EXISTS(
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.assignment_date BETWEEN month_start AND month_end
    LIMIT 1
  ) INTO has_live_data;
  
  IF has_live_data THEN
    RETURN QUERY
    SELECT 
      l.name,
      COUNT(sa.id)::BIGINT as count
    FROM schedule_assignments sa
    INNER JOIN locations l ON l.id = sa.location_id
    WHERE sa.assignment_date BETWEEN month_start AND month_end
    GROUP BY l.name
    ORDER BY count DESC
    LIMIT limit_count;
  ELSE
    RETURN QUERY
    SELECT 
      ahm.location_name as name,
      SUM(ahm.total_assignments)::BIGINT as count
    FROM assignment_history_monthly ahm
    WHERE ahm.year_month = target_month
    GROUP BY ahm.location_name
    ORDER BY count DESC
    LIMIT limit_count;
  END IF;
END;
$$;