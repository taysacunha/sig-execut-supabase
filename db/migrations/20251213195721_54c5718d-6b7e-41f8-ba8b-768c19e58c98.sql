-- Corrigir função get_dashboard_counts para usar generated_schedules ao invés de schedules
CREATE OR REPLACE FUNCTION public.get_dashboard_counts()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN json_build_object(
    'brokers', (SELECT COUNT(*) FROM brokers WHERE is_active = true),
    'locations', (SELECT COUNT(*) FROM locations WHERE is_active = true),
    'schedules', (SELECT COUNT(*) FROM generated_schedules WHERE is_active = true)
  );
END;
$function$;