-- ============================================================================
-- Auditoria automática para o módulo de Férias e Folgas
-- ============================================================================
-- Espelha o padrão usado em Escalas/Vendas/Estoque:
--   1) Estende a função audit_module_changes() para reconhecer tabelas ferias_*
--      e classificá-las no módulo 'ferias'.
--   2) Anexa um trigger AFTER INSERT/UPDATE/DELETE em todas as tabelas de
--      férias relevantes para que cada alteração seja registrada
--      automaticamente em module_audit_logs.
--
-- Aplicar no Supabase SQL Editor (projeto msbhhsrtfqfqcsofnsuy).
-- Idempotente: pode ser executado múltiplas vezes sem efeito colateral.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_module_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module_name text;
  v_old_data jsonb;
  v_new_data jsonb;
  v_changed_fields text[];
  v_user_id uuid;
  v_user_email text;
BEGIN
  -- Determinar módulo baseado na tabela
  CASE TG_TABLE_NAME
    WHEN 'brokers', 'locations', 'schedule_assignments', 'generated_schedules',
         'location_period_configs', 'saturday_queue', 'location_rotation_queues' THEN
      v_module_name := 'escalas';
    WHEN 'sales', 'sales_brokers', 'sales_teams', 'broker_evaluations',
         'monthly_leads', 'proposals', 'sale_partners' THEN
      v_module_name := 'vendas';
    WHEN 'estoque_materiais', 'estoque_locais_armazenamento', 'estoque_saldos',
         'estoque_gestores', 'estoque_solicitacoes', 'estoque_solicitacao_itens',
         'estoque_movimentacoes', 'estoque_notificacoes', 'estoque_usuarios_unidades' THEN
      v_module_name := 'estoque';
    WHEN 'ferias_colaboradores', 'ferias_ferias', 'ferias_folgas', 'ferias_folgas_escala',
         'ferias_folgas_creditos', 'ferias_folgas_perdas', 'ferias_afastamentos',
         'ferias_setores', 'ferias_equipes', 'ferias_cargos', 'ferias_unidades',
         'ferias_feriados', 'ferias_formulario_anual', 'ferias_gozo_periodos',
         'ferias_periodos_quitados', 'ferias_configuracoes', 'ferias_setor_chefes',
         'ferias_colaborador_setores_substitutos', 'ferias_conflitos', 'ferias_quinzenas' THEN
      v_module_name := 'ferias';
    ELSE
      v_module_name := 'sistema';
  END CASE;

  -- Obter usuário
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NULL THEN
    BEGIN
      v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  v_user_email := COALESCE(v_user_email, 'sistema@interno');

  -- Preparar dados conforme operação
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
    v_changed_fields := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    SELECT ARRAY_AGG(changes.key) INTO v_changed_fields
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

  -- Registrar log (apenas se houver mudanças reais para UPDATE)
  IF TG_OP != 'UPDATE' OR v_changed_fields IS NOT NULL THEN
    INSERT INTO public.module_audit_logs (
      module_name, table_name, record_id, action,
      old_data, new_data, changed_fields, changed_by, changed_by_email
    ) VALUES (
      v_module_name, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
      v_old_data, v_new_data, v_changed_fields, v_user_id, v_user_email
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Anexar trigger nas tabelas de férias (drop + create para idempotência)
DO $$
DECLARE
  t text;
  ferias_tables text[] := ARRAY[
    'ferias_colaboradores', 'ferias_ferias', 'ferias_folgas', 'ferias_folgas_escala',
    'ferias_folgas_creditos', 'ferias_folgas_perdas', 'ferias_afastamentos',
    'ferias_setores', 'ferias_equipes', 'ferias_cargos', 'ferias_unidades',
    'ferias_feriados', 'ferias_formulario_anual', 'ferias_gozo_periodos',
    'ferias_periodos_quitados', 'ferias_setor_chefes',
    'ferias_colaborador_setores_substitutos'
  ];
BEGIN
  FOREACH t IN ARRAY ferias_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_changes ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes()',
      t, t
    );
  END LOOP;
END $$;
