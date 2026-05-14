-- Função flexível para summary do dashboard de vendas
CREATE OR REPLACE FUNCTION public.get_sales_dashboard_summary_flexible(p_year text, p_month text DEFAULT NULL)
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
    'total_proposals', (
      SELECT COUNT(*) FROM proposals 
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
    ),
    'pending_proposals', (
      SELECT COUNT(*) FROM proposals 
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
      AND status = 'pending'
    ),
    'converted_proposals', (
      SELECT COUNT(*) FROM proposals 
      WHERE CASE WHEN p_month IS NULL THEN year_month LIKE year_month_pattern ELSE year_month = year_month_pattern END
      AND status = 'converted'
    ),
    'active_brokers', (SELECT COUNT(*) FROM sales_brokers WHERE is_active = true),
    'active_teams', (SELECT COUNT(*) FROM sales_teams WHERE is_active = true)
  ) INTO result;
  
  RETURN result;
END;
$function$;

-- Função flexível para ranking de equipes
CREATE OR REPLACE FUNCTION public.get_sales_team_vgv_ranking_flexible(p_year text, p_month text DEFAULT NULL)
 RETURNS TABLE(team_id uuid, team_name text, total_vgv numeric, total_sales bigint, broker_count bigint, rank bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  year_month_pattern text;
BEGIN
  IF p_month IS NULL THEN
    year_month_pattern := p_year || '-%';
  ELSE
    year_month_pattern := p_year || '-' || p_month;
  END IF;

  RETURN QUERY
  SELECT 
    st.id,
    st.name,
    COALESCE(SUM(s.sale_value), 0) as total_vgv,
    COUNT(DISTINCT s.id) as total_sales,
    COUNT(DISTINCT sb.id) as broker_count,
    RANK() OVER (ORDER BY COALESCE(SUM(s.sale_value), 0) DESC) as rank
  FROM sales_teams st
  LEFT JOIN sales_brokers sb ON sb.team_id = st.id AND sb.is_active = true
  LEFT JOIN sales s ON s.broker_id = sb.id 
    AND CASE WHEN p_month IS NULL THEN s.year_month LIKE year_month_pattern ELSE s.year_month = year_month_pattern END
  WHERE st.is_active = true
  GROUP BY st.id, st.name
  ORDER BY total_vgv DESC;
END;
$function$;

-- Função flexível para ranking de corretores
CREATE OR REPLACE FUNCTION public.get_sales_broker_vgv_ranking_flexible(p_year text, p_month text DEFAULT NULL)
 RETURNS TABLE(broker_id uuid, broker_name text, team_name text, total_vgv numeric, total_sales bigint, rank bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  year_month_pattern text;
BEGIN
  IF p_month IS NULL THEN
    year_month_pattern := p_year || '-%';
  ELSE
    year_month_pattern := p_year || '-' || p_month;
  END IF;

  RETURN QUERY
  SELECT 
    sb.id,
    sb.name,
    COALESCE(st.name, 'Sem equipe') as team_name,
    COALESCE(SUM(s.sale_value), 0) as total_vgv,
    COUNT(s.id) as total_sales,
    RANK() OVER (ORDER BY COALESCE(SUM(s.sale_value), 0) DESC) as rank
  FROM sales_brokers sb
  LEFT JOIN sales_teams st ON st.id = sb.team_id
  LEFT JOIN sales s ON s.broker_id = sb.id 
    AND CASE WHEN p_month IS NULL THEN s.year_month LIKE year_month_pattern ELSE s.year_month = year_month_pattern END
  WHERE sb.is_active = true
  GROUP BY sb.id, sb.name, st.name
  ORDER BY total_vgv DESC;
END;
$function$;