-- Criar tabela para configurações de turnos por data específica
CREATE TABLE period_specific_day_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES location_periods(id) ON DELETE CASCADE,
  specific_date DATE NOT NULL,
  has_morning BOOLEAN DEFAULT false,
  has_afternoon BOOLEAN DEFAULT false,
  morning_start TIME,
  morning_end TIME,
  afternoon_start TIME,
  afternoon_end TIME,
  max_brokers_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, specific_date)
);

-- Habilitar RLS
ALTER TABLE period_specific_day_configs ENABLE ROW LEVEL SECURITY;

-- Policies para period_specific_day_configs
CREATE POLICY "Authenticated users can view period_specific_day_configs"
  ON period_specific_day_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert period_specific_day_configs"
  ON period_specific_day_configs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update period_specific_day_configs"
  ON period_specific_day_configs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete period_specific_day_configs"
  ON period_specific_day_configs FOR DELETE TO authenticated USING (true);

-- Adicionar campo para identificar modo de configuração de turnos
ALTER TABLE locations 
ADD COLUMN shift_config_mode TEXT DEFAULT 'weekday' 
CHECK (shift_config_mode IN ('weekday', 'specific_date'));

COMMENT ON COLUMN locations.shift_config_mode IS 'weekday: usa period_day_configs (padrão atual), specific_date: usa period_specific_day_configs (Orla ABC)';