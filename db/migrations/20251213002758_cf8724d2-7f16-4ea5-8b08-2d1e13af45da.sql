-- Add deactivated_month to sales_brokers
ALTER TABLE public.sales_brokers ADD COLUMN deactivated_month text;

-- Create broker_monthly_proposals table for simplified proposals
CREATE TABLE public.broker_monthly_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES public.sales_brokers(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  proposals_count integer NOT NULL DEFAULT 0,
  proposals_converted integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(broker_id, year_month)
);

-- Enable RLS on broker_monthly_proposals
ALTER TABLE public.broker_monthly_proposals ENABLE ROW LEVEL SECURITY;

-- RLS policies for broker_monthly_proposals
CREATE POLICY "Admin can delete broker_monthly_proposals" ON public.broker_monthly_proposals FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can insert broker_monthly_proposals" ON public.broker_monthly_proposals FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can update broker_monthly_proposals" ON public.broker_monthly_proposals FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can view broker_monthly_proposals" ON public.broker_monthly_proposals FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Drop old columns from broker_evaluations and add new C2S structure
ALTER TABLE public.broker_evaluations 
  DROP COLUMN IF EXISTS sdr_arquivamento,
  DROP COLUMN IF EXISTS sdr_encaminhamento,
  DROP COLUMN IF EXISTS sdr_lead_ativo,
  DROP COLUMN IF EXISTS sdr_oportunidade,
  DROP COLUMN IF EXISTS sdr_visita_realizada,
  DROP COLUMN IF EXISTS rotina_captacao_imoveis,
  DROP COLUMN IF EXISTS rotina_oferta_ativa,
  DROP COLUMN IF EXISTS rotina_agenda_atualizacao,
  DROP COLUMN IF EXISTS vendas_vgv,
  DROP COLUMN IF EXISTS postura_treinamento,
  DROP COLUMN IF EXISTS postura_rotina_negocios,
  DROP COLUMN IF EXISTS postura_relacionamento,
  DROP COLUMN IF EXISTS postura_comprometimento,
  DROP COLUMN IF EXISTS postura_proatividade;

-- Add new C2S columns
ALTER TABLE public.broker_evaluations 
  ADD COLUMN is_launch boolean DEFAULT false,
  ADD COLUMN c2s_perfil_cliente numeric(3,1),
  ADD COLUMN c2s_atualiza_atividades numeric(3,1),
  ADD COLUMN c2s_atende_rapido numeric(3,1),
  ADD COLUMN c2s_cliente_remanejado numeric(3,1),
  ADD COLUMN c2s_bolsao numeric(3,1),
  ADD COLUMN c2s_agendamento_chaves numeric(3,1),
  ADD COLUMN c2s_agendamento_sem_chaves numeric(3,1),
  ADD COLUMN c2s_cliente_potencial numeric(3,1),
  ADD COLUMN c2s_justifica_arquivamento numeric(3,1),
  ADD COLUMN c2s_insere_etiquetas numeric(3,1),
  ADD COLUMN c2s_etiqueta_construtora numeric(3,1),
  ADD COLUMN c2s_feedback_visita numeric(3,1),
  ADD COLUMN c2s_cadastra_proposta numeric(3,1),
  ADD COLUMN c2s_negocio_fechado numeric(3,1),
  ADD COLUMN desempenho_visitas integer DEFAULT 0,
  ADD COLUMN desempenho_propostas integer DEFAULT 0,
  ADD COLUMN desempenho_contratos integer DEFAULT 0,
  ADD COLUMN obs_feedbacks text,
  ADD COLUMN acoes_melhorias_c2s text,
  ADD COLUMN metas_acoes_futuras text,
  ADD COLUMN previous_average numeric(4,2);

-- Update trigger to calculate new C2S average
CREATE OR REPLACE FUNCTION public.calculate_evaluation_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_score numeric;
  count_criteria integer;
  avg_score numeric;
  class_text text;
  prev_avg numeric;
BEGIN
  -- Calculate sum and count of filled C2S criteria
  total_score := 0;
  count_criteria := 0;
  
  IF NEW.c2s_perfil_cliente IS NOT NULL THEN
    total_score := total_score + NEW.c2s_perfil_cliente;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_atualiza_atividades IS NOT NULL THEN
    total_score := total_score + NEW.c2s_atualiza_atividades;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_atende_rapido IS NOT NULL THEN
    total_score := total_score + NEW.c2s_atende_rapido;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_cliente_remanejado IS NOT NULL THEN
    total_score := total_score + NEW.c2s_cliente_remanejado;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_bolsao IS NOT NULL THEN
    total_score := total_score + NEW.c2s_bolsao;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_agendamento_chaves IS NOT NULL THEN
    total_score := total_score + NEW.c2s_agendamento_chaves;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_agendamento_sem_chaves IS NOT NULL THEN
    total_score := total_score + NEW.c2s_agendamento_sem_chaves;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_cliente_potencial IS NOT NULL THEN
    total_score := total_score + NEW.c2s_cliente_potencial;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_justifica_arquivamento IS NOT NULL THEN
    total_score := total_score + NEW.c2s_justifica_arquivamento;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_insere_etiquetas IS NOT NULL THEN
    total_score := total_score + NEW.c2s_insere_etiquetas;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_etiqueta_construtora IS NOT NULL THEN
    total_score := total_score + NEW.c2s_etiqueta_construtora;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_feedback_visita IS NOT NULL THEN
    total_score := total_score + NEW.c2s_feedback_visita;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_cadastra_proposta IS NOT NULL THEN
    total_score := total_score + NEW.c2s_cadastra_proposta;
    count_criteria := count_criteria + 1;
  END IF;
  IF NEW.c2s_negocio_fechado IS NOT NULL THEN
    total_score := total_score + NEW.c2s_negocio_fechado;
    count_criteria := count_criteria + 1;
  END IF;
  
  -- Calculate average
  IF count_criteria > 0 THEN
    avg_score := ROUND(total_score / count_criteria, 2);
  ELSE
    avg_score := NULL;
  END IF;
  
  -- Get previous month average
  SELECT average_score INTO prev_avg
  FROM public.broker_evaluations
  WHERE broker_id = NEW.broker_id
    AND year_month < NEW.year_month
  ORDER BY year_month DESC
  LIMIT 1;
  
  -- Determine classification
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
  NEW.previous_average := prev_avg;
  NEW.classification := class_text;
  
  RETURN NEW;
END;
$function$;