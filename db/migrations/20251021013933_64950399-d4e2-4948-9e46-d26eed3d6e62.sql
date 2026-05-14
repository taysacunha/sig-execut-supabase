-- Adicionar disponibilidade semanal aos corretores
ALTER TABLE public.brokers 
ADD COLUMN available_weekdays TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

-- Adicionar tipo (interno/externo) aos locais
ALTER TABLE public.locations 
ADD COLUMN location_type TEXT DEFAULT 'external' CHECK (location_type IN ('internal', 'external'));

-- Tabela de associação corretor-local com disponibilidade
CREATE TABLE public.location_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE NOT NULL,
  available_morning BOOLEAN DEFAULT false,
  available_afternoon BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, broker_id)
);

-- Tabela de períodos (estrutura hierárquica mensal > semanal)
CREATE TABLE public.location_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  parent_period_id UUID REFERENCES public.location_periods(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'weekly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de configuração por dia da semana
CREATE TABLE public.period_day_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES public.location_periods(id) ON DELETE CASCADE NOT NULL,
  weekday TEXT NOT NULL CHECK (weekday IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  max_brokers_count INTEGER NOT NULL DEFAULT 1,
  has_morning BOOLEAN DEFAULT false,
  morning_start TIME,
  morning_end TIME,
  has_afternoon BOOLEAN DEFAULT false,
  afternoon_start TIME,
  afternoon_end TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, weekday)
);

-- Tabela de escalas geradas
CREATE TABLE public.generated_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de alocações individuais
CREATE TABLE public.schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_schedule_id UUID REFERENCES public.generated_schedules(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  assignment_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies para location_brokers
ALTER TABLE public.location_brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view location_brokers" 
ON public.location_brokers FOR SELECT USING (true);

CREATE POLICY "Anyone can insert location_brokers" 
ON public.location_brokers FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update location_brokers" 
ON public.location_brokers FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete location_brokers" 
ON public.location_brokers FOR DELETE USING (true);

-- RLS Policies para location_periods
ALTER TABLE public.location_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view location_periods" 
ON public.location_periods FOR SELECT USING (true);

CREATE POLICY "Anyone can insert location_periods" 
ON public.location_periods FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update location_periods" 
ON public.location_periods FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete location_periods" 
ON public.location_periods FOR DELETE USING (true);

-- RLS Policies para period_day_configs
ALTER TABLE public.period_day_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view period_day_configs" 
ON public.period_day_configs FOR SELECT USING (true);

CREATE POLICY "Anyone can insert period_day_configs" 
ON public.period_day_configs FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update period_day_configs" 
ON public.period_day_configs FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete period_day_configs" 
ON public.period_day_configs FOR DELETE USING (true);

-- RLS Policies para generated_schedules
ALTER TABLE public.generated_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view generated_schedules" 
ON public.generated_schedules FOR SELECT USING (true);

CREATE POLICY "Anyone can insert generated_schedules" 
ON public.generated_schedules FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update generated_schedules" 
ON public.generated_schedules FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete generated_schedules" 
ON public.generated_schedules FOR DELETE USING (true);

-- RLS Policies para schedule_assignments
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view schedule_assignments" 
ON public.schedule_assignments FOR SELECT USING (true);

CREATE POLICY "Anyone can insert schedule_assignments" 
ON public.schedule_assignments FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update schedule_assignments" 
ON public.schedule_assignments FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete schedule_assignments" 
ON public.schedule_assignments FOR DELETE USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_location_periods_updated_at
BEFORE UPDATE ON public.location_periods
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_generated_schedules_updated_at
BEFORE UPDATE ON public.generated_schedules
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_schedule_assignments_updated_at
BEFORE UPDATE ON public.schedule_assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Índices para performance
CREATE INDEX idx_location_brokers_location ON public.location_brokers(location_id);
CREATE INDEX idx_location_brokers_broker ON public.location_brokers(broker_id);
CREATE INDEX idx_location_periods_location ON public.location_periods(location_id);
CREATE INDEX idx_location_periods_parent ON public.location_periods(parent_period_id);
CREATE INDEX idx_location_periods_dates ON public.location_periods(start_date, end_date);
CREATE INDEX idx_period_day_configs_period ON public.period_day_configs(period_id);
CREATE INDEX idx_schedule_assignments_schedule ON public.schedule_assignments(generated_schedule_id);
CREATE INDEX idx_schedule_assignments_broker ON public.schedule_assignments(broker_id);
CREATE INDEX idx_schedule_assignments_location ON public.schedule_assignments(location_id);
CREATE INDEX idx_schedule_assignments_date ON public.schedule_assignments(assignment_date);