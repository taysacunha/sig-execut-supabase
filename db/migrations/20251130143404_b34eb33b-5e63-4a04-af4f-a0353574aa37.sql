-- ========================================
-- TABELA DE HISTÓRICO AGREGADO MENSAL
-- ========================================
CREATE TABLE IF NOT EXISTS assignment_history_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  location_type TEXT,
  city TEXT,
  total_assignments INTEGER DEFAULT 0,
  morning_count INTEGER DEFAULT 0,
  afternoon_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year_month, broker_id, location_id)
);

-- Habilitar RLS
ALTER TABLE assignment_history_monthly ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view assignment_history_monthly"
ON assignment_history_monthly FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert assignment_history_monthly"
ON assignment_history_monthly FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignment_history_monthly"
ON assignment_history_monthly FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete assignment_history_monthly"
ON assignment_history_monthly FOR DELETE
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_assignment_history_monthly_updated_at
BEFORE UPDATE ON assignment_history_monthly
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- ========================================
-- FUNÇÃO PARA AGREGAR DADOS DE UM MÊS
-- ========================================
CREATE OR REPLACE FUNCTION aggregate_month_data(p_year_month TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_result JSON;
BEGIN
  -- 1. Deletar dados agregados existentes do mês
  DELETE FROM assignment_history_monthly
  WHERE year_month = p_year_month;
  
  -- 2. Inserir novos dados agregados
  INSERT INTO assignment_history_monthly (
    year_month,
    broker_id,
    broker_name,
    location_id,
    location_name,
    location_type,
    city,
    total_assignments,
    morning_count,
    afternoon_count
  )
  SELECT 
    p_year_month as year_month,
    sa.broker_id,
    b.name as broker_name,
    sa.location_id,
    l.name as location_name,
    l.location_type,
    l.city,
    COUNT(sa.id) as total_assignments,
    SUM(CASE WHEN sa.shift_type = 'morning' THEN 1 ELSE 0 END) as morning_count,
    SUM(CASE WHEN sa.shift_type = 'afternoon' THEN 1 ELSE 0 END) as afternoon_count
  FROM schedule_assignments sa
  INNER JOIN brokers b ON b.id = sa.broker_id
  INNER JOIN locations l ON l.id = sa.location_id
  WHERE TO_CHAR(sa.assignment_date, 'YYYY-MM') = p_year_month
  GROUP BY sa.broker_id, b.name, sa.location_id, l.name, l.location_type, l.city;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  v_result := json_build_object(
    'success', true,
    'year_month', p_year_month,
    'records_aggregated', v_count
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;