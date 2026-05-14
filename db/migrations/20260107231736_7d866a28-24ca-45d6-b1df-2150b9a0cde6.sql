-- 1. Adicionar coluna has_partners na tabela sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS has_partners boolean DEFAULT false;

-- 2. Criar tabela sale_partners para armazenar os parceiros de cada venda
CREATE TABLE IF NOT EXISTS public.sale_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES public.sales_brokers(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sale_id, broker_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sale_partners_sale_id ON public.sale_partners(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_partners_broker_id ON public.sale_partners(broker_id);

-- RLS para sale_partners
ALTER TABLE public.sale_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sale_partners" 
  ON public.sale_partners FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sale_partners" 
  ON public.sale_partners FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sale_partners" 
  ON public.sale_partners FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sale_partners" 
  ON public.sale_partners FOR DELETE TO authenticated USING (true);

-- 3. Criar view para valores proporcionais
CREATE OR REPLACE VIEW public.broker_sales_proportional AS
SELECT 
  s.id AS sale_id,
  s.broker_id,
  s.team_id,
  s.sale_date,
  s.year_month,
  s.property_name,
  s.sale_value AS total_value,
  s.has_partners,
  (1 + COALESCE((SELECT COUNT(*) FROM public.sale_partners sp WHERE sp.sale_id = s.id), 0))::integer AS participant_count,
  s.sale_value / (1 + COALESCE((SELECT COUNT(*) FROM public.sale_partners sp WHERE sp.sale_id = s.id), 0)) AS proportional_value,
  'owner'::text AS role
FROM public.sales s

UNION ALL

SELECT 
  s.id AS sale_id,
  sp.broker_id,
  (SELECT team_id FROM public.sales_brokers WHERE id = sp.broker_id) AS team_id,
  s.sale_date,
  s.year_month,
  s.property_name,
  s.sale_value AS total_value,
  s.has_partners,
  (1 + (SELECT COUNT(*) FROM public.sale_partners sp2 WHERE sp2.sale_id = s.id))::integer AS participant_count,
  s.sale_value / (1 + (SELECT COUNT(*) FROM public.sale_partners sp2 WHERE sp2.sale_id = s.id)) AS proportional_value,
  'partner'::text AS role
FROM public.sales s
INNER JOIN public.sale_partners sp ON sp.sale_id = s.id;

-- 4. Atualizar função get_sales_broker_vgv_ranking_flexible para usar valores proporcionais
CREATE OR REPLACE FUNCTION public.get_sales_broker_vgv_ranking_flexible(p_year text, p_month text DEFAULT NULL::text)
 RETURNS TABLE(broker_id uuid, broker_name text, team_name text, total_vgv numeric, total_sales bigint, rank bigint)
 LANGUAGE plpgsql
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
    sb.id AS broker_id,
    sb.name AS broker_name,
    COALESCE(st.name, 'Sem equipe')::text AS team_name,
    COALESCE(SUM(bsp.proportional_value), 0)::numeric AS total_vgv,
    COUNT(DISTINCT bsp.sale_id)::bigint AS total_sales,
    RANK() OVER (ORDER BY COALESCE(SUM(bsp.proportional_value), 0) DESC)::bigint AS rank
  FROM public.broker_sales_proportional bsp
  INNER JOIN public.sales_brokers sb ON sb.id = bsp.broker_id
  LEFT JOIN public.sales_teams st ON st.id = bsp.team_id
  WHERE CASE 
      WHEN p_month IS NULL THEN bsp.year_month LIKE year_month_pattern 
      ELSE bsp.year_month = year_month_pattern 
    END
  GROUP BY sb.id, sb.name, st.name
  ORDER BY total_vgv DESC;
END;
$function$;