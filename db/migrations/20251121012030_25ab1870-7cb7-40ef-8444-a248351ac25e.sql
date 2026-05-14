-- Create optimized dashboard summary function
CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_30_days', (
      SELECT COUNT(*) 
      FROM schedule_assignments 
      WHERE assignment_date >= CURRENT_DATE - 30
    ),
    'this_week', (
      SELECT COUNT(*) 
      FROM schedule_assignments 
      WHERE assignment_date BETWEEN date_trunc('week', CURRENT_DATE) 
        AND date_trunc('week', CURRENT_DATE) + INTERVAL '6 days'
    ),
    'next_week', (
      SELECT COUNT(*) 
      FROM schedule_assignments 
      WHERE assignment_date BETWEEN date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' 
        AND date_trunc('week', CURRENT_DATE) + INTERVAL '13 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;