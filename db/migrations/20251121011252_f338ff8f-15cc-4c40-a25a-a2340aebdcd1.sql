-- Função: Performance de Corretores
CREATE OR REPLACE FUNCTION public.get_broker_performance(start_date DATE, end_date DATE)
RETURNS TABLE (
  broker_id UUID,
  broker_name TEXT,
  total_assignments BIGINT,
  morning_count BIGINT,
  afternoon_count BIGINT,
  unique_locations BIGINT,
  last_assignment DATE
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
END;
$$;

-- Função: Performance de Locais
CREATE OR REPLACE FUNCTION public.get_location_performance(start_date DATE, end_date DATE)
RETURNS TABLE (
  location_id UUID,
  location_name TEXT,
  location_type TEXT,
  city TEXT,
  state TEXT,
  total_assignments BIGINT,
  days_covered BIGINT,
  unique_brokers BIGINT,
  morning_count BIGINT,
  afternoon_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
END;
$$;

-- Função: Distribuição por dia da semana
CREATE OR REPLACE FUNCTION public.get_weekday_distribution(start_date DATE, end_date DATE)
RETURNS TABLE (
  weekday INT,
  weekday_name TEXT,
  total_assignments BIGINT,
  morning_count BIGINT,
  afternoon_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
END;
$$;