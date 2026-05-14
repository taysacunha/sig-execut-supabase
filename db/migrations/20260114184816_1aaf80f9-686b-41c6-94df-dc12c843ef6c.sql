-- Atualizar a função de auditoria para capturar usuário de forma mais robusta
CREATE OR REPLACE FUNCTION public.audit_module_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_name text;
  v_old_data jsonb;
  v_new_data jsonb;
  v_changed_fields text[];
  v_user_id uuid;
  v_user_email text;
  key text;
BEGIN
  -- Determinar módulo baseado na tabela
  CASE TG_TABLE_NAME
    WHEN 'brokers', 'locations', 'schedule_assignments', 'generated_schedules', 
         'location_period_configs', 'saturday_queue', 'location_rotation_queues',
         'broker_availability' THEN
      v_module_name := 'escalas';
    WHEN 'sales', 'sales_brokers', 'sales_teams', 'broker_evaluations', 
         'monthly_leads', 'proposals', 'sale_partners' THEN
      v_module_name := 'vendas';
    ELSE
      v_module_name := 'sistema';
  END CASE;

  -- Tentar obter usuário de várias formas
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  
  -- Fallback: tentar obter do JWT claims
  IF v_user_id IS NULL THEN
    BEGIN
      v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;
  
  -- Obter email do usuário
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;
  
  -- Fallback para email se ainda nulo
  v_user_email := COALESCE(v_user_email, 'sistema@interno');

  -- Preparar dados
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
    v_changed_fields := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    -- Calcular campos alterados
    SELECT ARRAY_AGG(key) INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    ) AS changes;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
  END IF;

  -- Inserir log (apenas se houver mudanças reais para UPDATE)
  IF TG_OP != 'UPDATE' OR v_changed_fields IS NOT NULL THEN
    INSERT INTO public.module_audit_logs (
      module_name,
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_fields,
      changed_by,
      changed_by_email
    ) VALUES (
      v_module_name,
      TG_TABLE_NAME,
      COALESCE(NEW.id::text, OLD.id::text),
      TG_OP,
      v_old_data,
      v_new_data,
      v_changed_fields,
      v_user_id,
      v_user_email
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;