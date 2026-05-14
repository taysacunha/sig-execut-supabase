-- Corrigir search_path nas funções criadas
CREATE OR REPLACE FUNCTION public.get_sales_team_vgv_ranking_flexible(p_year text, p_month text DEFAULT NULL)
RETURNS TABLE(team_id uuid, team_name text, total_vgv numeric, total_sales bigint, broker_count bigint, rank bigint)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
    st.id AS team_id,
    st.name AS team_name,
    COALESCE(SUM(s.sale_value), 0)::numeric AS total_vgv,
    COUNT(DISTINCT s.id)::bigint AS total_sales,
    COUNT(DISTINCT s.broker_id)::bigint AS broker_count,
    RANK() OVER (ORDER BY COALESCE(SUM(s.sale_value), 0) DESC)::bigint AS rank
  FROM sales_teams st
  LEFT JOIN sales s ON s.team_id = st.id
    AND CASE 
      WHEN p_month IS NULL THEN s.year_month LIKE year_month_pattern 
      ELSE s.year_month = year_month_pattern 
    END
  WHERE st.is_active = true
  GROUP BY st.id, st.name
  ORDER BY total_vgv DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_broker_vgv_ranking_flexible(p_year text, p_month text DEFAULT NULL)
RETURNS TABLE(broker_id uuid, broker_name text, team_name text, total_vgv numeric, total_sales bigint, rank bigint)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
    sb.id AS broker_id,
    sb.name AS broker_name,
    COALESCE(st.name, 'Sem equipe')::text AS team_name,
    COALESCE(SUM(s.sale_value), 0)::numeric AS total_vgv,
    COUNT(DISTINCT s.id)::bigint AS total_sales,
    RANK() OVER (ORDER BY COALESCE(SUM(s.sale_value), 0) DESC)::bigint AS rank
  FROM sales s
  INNER JOIN sales_brokers sb ON sb.id = s.broker_id
  LEFT JOIN sales_teams st ON st.id = s.team_id
  WHERE CASE 
      WHEN p_month IS NULL THEN s.year_month LIKE year_month_pattern 
      ELSE s.year_month = year_month_pattern 
    END
  GROUP BY sb.id, sb.name, st.name
  ORDER BY total_vgv DESC;
END;
$$;