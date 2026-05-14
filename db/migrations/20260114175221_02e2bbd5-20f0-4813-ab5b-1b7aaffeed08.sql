-- =====================================================
-- AUDIT LOGGING SYSTEM
-- =====================================================

-- 1. Tabela de auditoria para ações administrativas
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_name text,
  target_id uuid,
  target_email text,
  target_name text,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_admin_audit_actor ON admin_audit_logs(actor_id);
CREATE INDEX idx_admin_audit_target ON admin_audit_logs(target_id);
CREATE INDEX idx_admin_audit_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_created_at ON admin_audit_logs(created_at DESC);

-- RLS: apenas super_admin/admin podem ver
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Sistema (via edge function com service role) pode inserir
CREATE POLICY "Service role can insert audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Tabela de auditoria para ações nos módulos
CREATE TABLE public.module_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL, -- 'escalas', 'vendas'
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_module_audit_module ON module_audit_logs(module_name);
CREATE INDEX idx_module_audit_table ON module_audit_logs(table_name);
CREATE INDEX idx_module_audit_record ON module_audit_logs(record_id);
CREATE INDEX idx_module_audit_action ON module_audit_logs(action);
CREATE INDEX idx_module_audit_changed_by ON module_audit_logs(changed_by);
CREATE INDEX idx_module_audit_created_at ON module_audit_logs(created_at DESC);

-- RLS
ALTER TABLE module_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view module audit logs"
  ON module_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Authenticated can insert module audit logs"
  ON module_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Função genérica de trigger para auditoria de módulos
CREATE OR REPLACE FUNCTION audit_module_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_module_name text;
  v_old_data jsonb;
  v_new_data jsonb;
  v_changed_fields text[];
  v_user_email text;
  v_key text;
BEGIN
  -- Determinar módulo baseado na tabela
  v_module_name := CASE 
    WHEN TG_TABLE_NAME IN ('brokers', 'locations', 'schedule_assignments', 'generated_schedules', 'location_brokers') THEN 'escalas'
    WHEN TG_TABLE_NAME IN ('sales', 'sales_brokers', 'sales_teams', 'broker_evaluations', 'monthly_leads', 'proposals') THEN 'vendas'
    ELSE 'sistema'
  END;

  -- Obter email do usuário atual
  SELECT email INTO v_user_email 
  FROM auth.users 
  WHERE id = auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    INSERT INTO module_audit_logs (module_name, table_name, record_id, action, old_data, changed_by, changed_by_email)
    VALUES (v_module_name, TG_TABLE_NAME, OLD.id, 'DELETE', v_old_data, auth.uid(), v_user_email);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    
    -- Identificar campos alterados
    SELECT array_agg(key) INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_each(v_new_data)
      EXCEPT
      SELECT key FROM jsonb_each(v_old_data) WHERE v_old_data->key = v_new_data->key
    ) changed;
    
    -- Só registrar se houve alteração real
    IF v_changed_fields IS NOT NULL AND array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO module_audit_logs (module_name, table_name, record_id, action, old_data, new_data, changed_fields, changed_by, changed_by_email)
      VALUES (v_module_name, TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_data, v_new_data, v_changed_fields, auth.uid(), v_user_email);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    INSERT INTO module_audit_logs (module_name, table_name, record_id, action, new_data, changed_by, changed_by_email)
    VALUES (v_module_name, TG_TABLE_NAME, NEW.id, 'INSERT', v_new_data, auth.uid(), v_user_email);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Aplicar triggers nas tabelas principais do módulo Escalas
CREATE TRIGGER audit_brokers_changes
  AFTER INSERT OR UPDATE OR DELETE ON brokers
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_locations_changes
  AFTER INSERT OR UPDATE OR DELETE ON locations
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_schedule_assignments_changes
  AFTER INSERT OR UPDATE OR DELETE ON schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_generated_schedules_changes
  AFTER INSERT OR UPDATE OR DELETE ON generated_schedules
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

-- 5. Aplicar triggers nas tabelas principais do módulo Vendas
CREATE TRIGGER audit_sales_changes
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_sales_brokers_changes
  AFTER INSERT OR UPDATE OR DELETE ON sales_brokers
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_sales_teams_changes
  AFTER INSERT OR UPDATE OR DELETE ON sales_teams
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_broker_evaluations_changes
  AFTER INSERT OR UPDATE OR DELETE ON broker_evaluations
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_monthly_leads_changes
  AFTER INSERT OR UPDATE OR DELETE ON monthly_leads
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_proposals_changes
  AFTER INSERT OR UPDATE OR DELETE ON proposals
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

-- 6. Triggers para tabelas de sistema (user_roles, system_access)
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();

CREATE TRIGGER audit_system_access_changes
  AFTER INSERT OR UPDATE OR DELETE ON system_access
  FOR EACH ROW EXECUTE FUNCTION audit_module_changes();