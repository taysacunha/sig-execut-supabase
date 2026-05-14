-- Create function to get top brokers with assignment count
CREATE OR REPLACE FUNCTION get_top_brokers(days_ago INT, limit_count INT)
RETURNS TABLE(name TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.name,
    COUNT(sa.id)::BIGINT as count
  FROM schedule_assignments sa
  INNER JOIN brokers b ON b.id = sa.broker_id
  WHERE sa.assignment_date >= (CURRENT_DATE - days_ago)
  GROUP BY b.name
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get top locations with assignment count
CREATE OR REPLACE FUNCTION get_top_locations(days_ago INT, limit_count INT)
RETURNS TABLE(name TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.name,
    COUNT(sa.id)::BIGINT as count
  FROM schedule_assignments sa
  INNER JOIN locations l ON l.id = sa.location_id
  WHERE sa.assignment_date >= (CURRENT_DATE - days_ago)
  GROUP BY l.name
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get shift statistics
CREATE OR REPLACE FUNCTION get_shift_stats(days_ago INT)
RETURNS TABLE(shift_type TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.shift_type,
    COUNT(sa.id)::BIGINT as count
  FROM schedule_assignments sa
  WHERE sa.assignment_date >= (CURRENT_DATE - days_ago)
  GROUP BY sa.shift_type
  ORDER BY sa.shift_type;
END;
$$ LANGUAGE plpgsql;

-- Create function to get dashboard counts
CREATE OR REPLACE FUNCTION get_dashboard_counts()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'brokers', (SELECT COUNT(*) FROM brokers WHERE is_active = true),
    'locations', (SELECT COUNT(*) FROM locations WHERE is_active = true),
    'schedules', (SELECT COUNT(*) FROM schedules WHERE is_active = true)
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to get weekly assignments aggregated
CREATE OR REPLACE FUNCTION get_weekly_assignments(weeks_count INT)
RETURNS TABLE(week_label TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(DATE_TRUNC('week', sa.assignment_date), 'DD/MM') as week_label,
    COUNT(sa.id)::BIGINT as count
  FROM schedule_assignments sa
  WHERE sa.assignment_date >= (CURRENT_DATE - (weeks_count * 7))
  GROUP BY DATE_TRUNC('week', sa.assignment_date)
  ORDER BY DATE_TRUNC('week', sa.assignment_date) ASC;
END;
$$ LANGUAGE plpgsql;