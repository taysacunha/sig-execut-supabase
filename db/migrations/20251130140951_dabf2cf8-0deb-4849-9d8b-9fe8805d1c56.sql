-- Criar tabela para datas excluídas dos períodos (feriados, fechamentos)
CREATE TABLE IF NOT EXISTS period_excluded_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES location_periods(id) ON DELETE CASCADE,
  excluded_date DATE NOT NULL,
  reason TEXT, -- Opcional: "Natal", "Fechamento", etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, excluded_date)
);

-- RLS policies
ALTER TABLE period_excluded_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view period_excluded_dates"
  ON period_excluded_dates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert period_excluded_dates"
  ON period_excluded_dates FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update period_excluded_dates"
  ON period_excluded_dates FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete period_excluded_dates"
  ON period_excluded_dates FOR DELETE USING (true);