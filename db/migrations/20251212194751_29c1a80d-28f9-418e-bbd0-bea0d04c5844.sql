-- Tabela de metas de VGV por corretor
CREATE TABLE public.broker_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES public.sales_brokers(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  target_vgv numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(broker_id, year_month)
);

-- Tabela de metas de VGV por equipe
CREATE TABLE public.team_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.sales_teams(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  target_vgv numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(team_id, year_month)
);

-- Enable RLS
ALTER TABLE public.broker_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for broker_goals
CREATE POLICY "Admin/Manager can view broker_goals" ON public.broker_goals
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can insert broker_goals" ON public.broker_goals
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update broker_goals" ON public.broker_goals
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete broker_goals" ON public.broker_goals
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for team_goals
CREATE POLICY "Admin/Manager can view team_goals" ON public.team_goals
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can insert team_goals" ON public.team_goals
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update team_goals" ON public.team_goals
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete team_goals" ON public.team_goals
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_broker_goals_updated_at
BEFORE UPDATE ON public.broker_goals
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_team_goals_updated_at
BEFORE UPDATE ON public.team_goals
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();