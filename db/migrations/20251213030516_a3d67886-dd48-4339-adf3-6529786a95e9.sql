-- Update get_sales_dashboard_summary_flexible to use broker_monthly_proposals instead of proposals table
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
  -- Se p_month é NULL, busca o ano inteiro, senão busca o mês específico
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