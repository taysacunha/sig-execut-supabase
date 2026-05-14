-- =============================================
-- SISTEMA DE VENDAS - TABELAS
-- =============================================

-- 1. Equipes de Vendas
CREATE TABLE public.sales_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Corretores de Vendas
CREATE TABLE public.sales_brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_id uuid REFERENCES public.sales_teams(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Leads Mensais por Corretor
CREATE TABLE public.monthly_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid REFERENCES public.sales_brokers(id) ON DELETE CASCADE NOT NULL,
  year_month text NOT NULL, -- '2025-01', '2025-02'...
  leads_received integer DEFAULT 0,
  leads_archived integer DEFAULT 0,
  leads_active integer DEFAULT 0,
  average_leads numeric(10,2),
  average_visits numeric(10,2),
  gimob_key_visits integer DEFAULT 0,
  scheduled_visits integer DEFAULT 0,
  builder_visits integer DEFAULT 0,
  last_visit_date date,
  observations text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(broker_id, year_month)
);

-- 4. Vendas Individuais
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid REFERENCES public.sales_brokers(id) ON DELETE CASCADE NOT NULL,
  sale_date date NOT NULL,
  sale_value numeric(15,2) NOT NULL,
  property_name text,
  year_month text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Propostas
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid REFERENCES public.sales_brokers(id) ON DELETE CASCADE NOT NULL,
  proposal_date date NOT NULL,
  proposal_value numeric(15,2),
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'converted'
  converted_to_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  year_month text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Avaliações de Corretores (C2S - 14 critérios)
CREATE TABLE public.broker_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid REFERENCES public.sales_brokers(id) ON DELETE CASCADE NOT NULL,
  year_month text NOT NULL,
  
  -- SDR (5 critérios)
  sdr_arquivamento numeric(3,1) CHECK (sdr_arquivamento >= 0 AND sdr_arquivamento <= 10),
  sdr_encaminhamento numeric(3,1) CHECK (sdr_encaminhamento >= 0 AND sdr_encaminhamento <= 10),
  sdr_lead_ativo numeric(3,1) CHECK (sdr_lead_ativo >= 0 AND sdr_lead_ativo <= 10),
  sdr_oportunidade numeric(3,1) CHECK (sdr_oportunidade >= 0 AND sdr_oportunidade <= 10),
  sdr_visita_realizada numeric(3,1) CHECK (sdr_visita_realizada >= 0 AND sdr_visita_realizada <= 10),
  
  -- Rotina (3 critérios)
  rotina_captacao_imoveis numeric(3,1) CHECK (rotina_captacao_imoveis >= 0 AND rotina_captacao_imoveis <= 10),
  rotina_oferta_ativa numeric(3,1) CHECK (rotina_oferta_ativa >= 0 AND rotina_oferta_ativa <= 10),
  rotina_agenda_atualizacao numeric(3,1) CHECK (rotina_agenda_atualizacao >= 0 AND rotina_agenda_atualizacao <= 10),
  
  -- Vendas (1 critério)
  vendas_vgv numeric(3,1) CHECK (vendas_vgv >= 0 AND vendas_vgv <= 10),
  
  -- Postura (5 critérios)
  postura_treinamento numeric(3,1) CHECK (postura_treinamento >= 0 AND postura_treinamento <= 10),
  postura_rotina_negocios numeric(3,1) CHECK (postura_rotina_negocios >= 0 AND postura_rotina_negocios <= 10),
  postura_relacionamento numeric(3,1) CHECK (postura_relacionamento >= 0 AND postura_relacionamento <= 10),
  postura_comprometimento numeric(3,1) CHECK (postura_comprometimento >= 0 AND postura_comprometimento <= 10),
  postura_proatividade numeric(3,1) CHECK (postura_proatividade >= 0 AND postura_proatividade <= 10),
  
  -- Resultados calculados
  average_score numeric(4,2),
  classification text, -- 'Não atualiza', 'Precisa Melhorar', 'Bom', 'Excelente'
  feedback text,
  
  evaluated_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(broker_id, year_month)
);

-- =============================================
-- HABILITAR RLS
-- =============================================

ALTER TABLE public.sales_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_evaluations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - sales_teams
-- =============================================

CREATE POLICY "Admin/Manager can view sales_teams"
ON public.sales_teams FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can insert sales_teams"
ON public.sales_teams FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update sales_teams"
ON public.sales_teams FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete sales_teams"
ON public.sales_teams FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - sales_brokers
-- =============================================

CREATE POLICY "Admin/Manager can view sales_brokers"
ON public.sales_brokers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can insert sales_brokers"
ON public.sales_brokers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update sales_brokers"
ON public.sales_brokers FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete sales_brokers"
ON public.sales_brokers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - monthly_leads
-- =============================================

CREATE POLICY "Admin/Manager can view monthly_leads"
ON public.monthly_leads FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can insert monthly_leads"
ON public.monthly_leads FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can update monthly_leads"
ON public.monthly_leads FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can delete monthly_leads"
ON public.monthly_leads FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - sales
-- =============================================

CREATE POLICY "Admin/Manager can view sales"
ON public.sales FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can insert sales"
ON public.sales FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can update sales"
ON public.sales FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can delete sales"
ON public.sales FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - proposals
-- =============================================

CREATE POLICY "Admin/Manager can view proposals"
ON public.proposals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can insert proposals"
ON public.proposals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can update proposals"
ON public.proposals FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can delete proposals"
ON public.proposals FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - broker_evaluations
-- =============================================

CREATE POLICY "Admin/Manager can view broker_evaluations"
ON public.broker_evaluations FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can insert broker_evaluations"
ON public.broker_evaluations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can update broker_evaluations"
ON public.broker_evaluations FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can delete broker_evaluations"
ON public.broker_evaluations FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- TRIGGERS para updated_at
-- =============================================

CREATE TRIGGER update_sales_teams_updated_at
BEFORE UPDATE ON public.sales_teams
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_sales_brokers_updated_at
BEFORE UPDATE ON public.sales_brokers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_monthly_leads_updated_at
BEFORE UPDATE ON public.monthly_leads
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_broker_evaluations_updated_at
BEFORE UPDATE ON public.broker_evaluations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TRIGGER para calcular média e classificação automaticamente
-- =============================================

CREATE OR REPLACE FUNCTION public.calculate_evaluation_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_score numeric;
  count_criteria integer;
  avg_score numeric;
  class_text text;
BEGIN
  -- Calcular soma e contagem dos critérios preenchidos
  total_score := 0;
  count_criteria := 0;
  
  IF NEW.sdr_arquivamento IS NOT NULL THEN
    total_score := total_score + NEW.sdr_arquivamento;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.sdr_encaminhamento IS NOT NULL THEN
    total_score := total_score + NEW.sdr_encaminhamento;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.sdr_lead_ativo IS NOT NULL THEN
    total_score := total_score + NEW.sdr_lead_ativo;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.sdr_oportunidade IS NOT NULL THEN
    total_score := total_score + NEW.sdr_oportunidade;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.sdr_visita_realizada IS NOT NULL THEN
    total_score := total_score + NEW.sdr_visita_realizada;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.rotina_captacao_imoveis IS NOT NULL THEN
    total_score := total_score + NEW.rotina_captacao_imoveis;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.rotina_oferta_ativa IS NOT NULL THEN
    total_score := total_score + NEW.rotina_oferta_ativa;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.rotina_agenda_atualizacao IS NOT NULL THEN
    total_score := total_score + NEW.rotina_agenda_atualizacao;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.vendas_vgv IS NOT NULL THEN
    total_score := total_score + NEW.vendas_vgv;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.postura_treinamento IS NOT NULL THEN
    total_score := total_score + NEW.postura_treinamento;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.postura_rotina_negocios IS NOT NULL THEN
    total_score := total_score + NEW.postura_rotina_negocios;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.postura_relacionamento IS NOT NULL THEN
    total_score := total_score + NEW.postura_relacionamento;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.postura_comprometimento IS NOT NULL THEN
    total_score := total_score + NEW.postura_comprometimento;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.postura_proatividade IS NOT NULL THEN
    total_score := total_score + NEW.postura_proatividade;
    count_criteria := count_criteria + 1;
  END IF;
  
  -- Calcular média
  IF count_criteria > 0 THEN
    avg_score := ROUND(total_score / count_criteria, 2);
  ELSE
    avg_score := NULL;
  END IF;
  
  -- Determinar classificação
  IF avg_score IS NULL THEN
    class_text := NULL;
  ELSIF avg_score >= 10 THEN
    class_text := 'Excelente';
  ELSIF avg_score >= 7 THEN
    class_text := 'Bom';
  ELSIF avg_score >= 4 THEN
    class_text := 'Precisa Melhorar';
  ELSE
    class_text := 'Não atualiza';
  END IF;
  
  NEW.average_score := avg_score;
  NEW.classification := class_text;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_evaluation_before_save
BEFORE INSERT OR UPDATE ON public.broker_evaluations
FOR EACH ROW EXECUTE FUNCTION public.calculate_evaluation_score();

-- =============================================
-- FUNÇÕES DE RANKING
-- =============================================

-- Ranking de corretores por VGV
CREATE OR REPLACE FUNCTION public.get_sales_broker_vgv_ranking(p_year_month text)
RETURNS TABLE (
  broker_id uuid,
  broker_name text,
  team_name text,
  total_vgv numeric,
  total_sales bigint,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  LEFT JOIN sales s ON s.broker_id = sb.id AND s.year_month = p_year_month
  WHERE sb.is_active = true
  GROUP BY sb.id, sb.name, st.name
  ORDER BY total_vgv DESC;
END;
$$;

-- Ranking de equipes por VGV
CREATE OR REPLACE FUNCTION public.get_sales_team_vgv_ranking(p_year_month text)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  total_vgv numeric,
  total_sales bigint,
  broker_count bigint,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  LEFT JOIN sales s ON s.broker_id = sb.id AND s.year_month = p_year_month
  WHERE st.is_active = true
  GROUP BY st.id, st.name
  ORDER BY total_vgv DESC;
END;
$$;

-- Dashboard summary do sistema de vendas
CREATE OR REPLACE FUNCTION public.get_sales_dashboard_summary(p_year_month text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_vgv', COALESCE((SELECT SUM(sale_value) FROM sales WHERE year_month = p_year_month), 0),
    'total_sales', (SELECT COUNT(*) FROM sales WHERE year_month = p_year_month),
    'total_proposals', (SELECT COUNT(*) FROM proposals WHERE year_month = p_year_month),
    'pending_proposals', (SELECT COUNT(*) FROM proposals WHERE year_month = p_year_month AND status = 'pending'),
    'converted_proposals', (SELECT COUNT(*) FROM proposals WHERE year_month = p_year_month AND status = 'converted'),
    'active_brokers', (SELECT COUNT(*) FROM sales_brokers WHERE is_active = true),
    'active_teams', (SELECT COUNT(*) FROM sales_teams WHERE is_active = true)
  ) INTO result;
  
  RETURN result;
END;
$$;