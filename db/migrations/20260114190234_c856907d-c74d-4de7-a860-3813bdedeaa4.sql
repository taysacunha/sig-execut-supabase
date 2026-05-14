
-- ==========================================
-- PARTE 1: CRIAR FUNÇÕES DE VERIFICAÇÃO DE PERMISSÃO
-- ==========================================

-- Verifica se usuário pode EDITAR no sistema (view_edit)
CREATE OR REPLACE FUNCTION public.can_edit_system(_user_id uuid, _system text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_access
    WHERE user_id = _user_id
      AND system_name = _system
      AND permission_type = 'view_edit'
  )
$$;

-- Verifica se usuário pode VISUALIZAR no sistema (qualquer permissão)
CREATE OR REPLACE FUNCTION public.can_view_system(_user_id uuid, _system text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_access
    WHERE user_id = _user_id
      AND system_name = _system
  )
$$;

-- ==========================================
-- PARTE 2: POLÍTICAS DO MÓDULO ESCALAS
-- ==========================================

-- GENERATED_SCHEDULES
DROP POLICY IF EXISTS "Admin can insert generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Admin can update generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Admin can delete generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Admin/Manager can view generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Admin/Super can insert generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Admin/Super can update generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Admin/Super can delete generated_schedules" ON public.generated_schedules;

CREATE POLICY "Escalas users can view generated_schedules"
  ON public.generated_schedules FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert generated_schedules"
  ON public.generated_schedules FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update generated_schedules"
  ON public.generated_schedules FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete generated_schedules"
  ON public.generated_schedules FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- SCHEDULE_ASSIGNMENTS
DROP POLICY IF EXISTS "Admin can insert schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Admin can update schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Admin can delete schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Admin/Manager can view schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Admin/Super can insert schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Admin/Super can update schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Admin/Super can delete schedule_assignments" ON public.schedule_assignments;

CREATE POLICY "Escalas users can view schedule_assignments"
  ON public.schedule_assignments FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert schedule_assignments"
  ON public.schedule_assignments FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update schedule_assignments"
  ON public.schedule_assignments FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete schedule_assignments"
  ON public.schedule_assignments FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- SCHEDULE_LOCKS
DROP POLICY IF EXISTS "Admins can create schedule locks" ON public.schedule_locks;
DROP POLICY IF EXISTS "Admins can delete schedule locks" ON public.schedule_locks;
DROP POLICY IF EXISTS "Admins can view all schedule locks" ON public.schedule_locks;
DROP POLICY IF EXISTS "Admin/Super can view schedule_locks" ON public.schedule_locks;
DROP POLICY IF EXISTS "Admin/Super can insert schedule_locks" ON public.schedule_locks;
DROP POLICY IF EXISTS "Admin/Super can delete schedule_locks" ON public.schedule_locks;

CREATE POLICY "Escalas users can view schedule_locks"
  ON public.schedule_locks FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert schedule_locks"
  ON public.schedule_locks FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete schedule_locks"
  ON public.schedule_locks FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- SCHEDULE_VALIDATION_RESULTS
DROP POLICY IF EXISTS "Admin can manage schedule_validation_results" ON public.schedule_validation_results;
DROP POLICY IF EXISTS "Admin/Super can manage schedule_validation_results" ON public.schedule_validation_results;

CREATE POLICY "Escalas users can view schedule_validation_results"
  ON public.schedule_validation_results FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can manage schedule_validation_results"
  ON public.schedule_validation_results FOR ALL
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'))
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

-- BROKERS
DROP POLICY IF EXISTS "Admin/Manager can view brokers" ON public.brokers;
DROP POLICY IF EXISTS "Admin can insert brokers" ON public.brokers;
DROP POLICY IF EXISTS "Admin can update brokers" ON public.brokers;
DROP POLICY IF EXISTS "Admin can delete brokers" ON public.brokers;

CREATE POLICY "Escalas users can view brokers"
  ON public.brokers FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert brokers"
  ON public.brokers FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update brokers"
  ON public.brokers FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete brokers"
  ON public.brokers FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- LOCATIONS
DROP POLICY IF EXISTS "Admin/Manager can view locations" ON public.locations;
DROP POLICY IF EXISTS "Admin can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Admin can update locations" ON public.locations;
DROP POLICY IF EXISTS "Admin can delete locations" ON public.locations;

CREATE POLICY "Escalas users can view locations"
  ON public.locations FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert locations"
  ON public.locations FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update locations"
  ON public.locations FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete locations"
  ON public.locations FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- LOCATION_PERIODS
DROP POLICY IF EXISTS "Admin/Manager can view location_periods" ON public.location_periods;
DROP POLICY IF EXISTS "Admin can insert location_periods" ON public.location_periods;
DROP POLICY IF EXISTS "Admin can update location_periods" ON public.location_periods;
DROP POLICY IF EXISTS "Admin can delete location_periods" ON public.location_periods;

CREATE POLICY "Escalas users can view location_periods"
  ON public.location_periods FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert location_periods"
  ON public.location_periods FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update location_periods"
  ON public.location_periods FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete location_periods"
  ON public.location_periods FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- LOCATION_BROKERS
DROP POLICY IF EXISTS "Admin/Manager can view location_brokers" ON public.location_brokers;
DROP POLICY IF EXISTS "Admin can insert location_brokers" ON public.location_brokers;
DROP POLICY IF EXISTS "Admin can update location_brokers" ON public.location_brokers;
DROP POLICY IF EXISTS "Admin can delete location_brokers" ON public.location_brokers;

CREATE POLICY "Escalas users can view location_brokers"
  ON public.location_brokers FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert location_brokers"
  ON public.location_brokers FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update location_brokers"
  ON public.location_brokers FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete location_brokers"
  ON public.location_brokers FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- LOCATION_ROTATION_QUEUE
DROP POLICY IF EXISTS "Admin/Manager can view location_rotation_queue" ON public.location_rotation_queue;
DROP POLICY IF EXISTS "Admin can insert location_rotation_queue" ON public.location_rotation_queue;
DROP POLICY IF EXISTS "Admin can update location_rotation_queue" ON public.location_rotation_queue;
DROP POLICY IF EXISTS "Admin can delete location_rotation_queue" ON public.location_rotation_queue;

CREATE POLICY "Escalas users can view location_rotation_queue"
  ON public.location_rotation_queue FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert location_rotation_queue"
  ON public.location_rotation_queue FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update location_rotation_queue"
  ON public.location_rotation_queue FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete location_rotation_queue"
  ON public.location_rotation_queue FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- SATURDAY_ROTATION_QUEUE
DROP POLICY IF EXISTS "Admin/Manager can view saturday_rotation_queue" ON public.saturday_rotation_queue;
DROP POLICY IF EXISTS "Admin can insert saturday_rotation_queue" ON public.saturday_rotation_queue;
DROP POLICY IF EXISTS "Admin can update saturday_rotation_queue" ON public.saturday_rotation_queue;
DROP POLICY IF EXISTS "Admin can delete saturday_rotation_queue" ON public.saturday_rotation_queue;

CREATE POLICY "Escalas users can view saturday_rotation_queue"
  ON public.saturday_rotation_queue FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert saturday_rotation_queue"
  ON public.saturday_rotation_queue FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update saturday_rotation_queue"
  ON public.saturday_rotation_queue FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete saturday_rotation_queue"
  ON public.saturday_rotation_queue FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- PERIOD_DAY_CONFIGS
DROP POLICY IF EXISTS "Admin/Manager can view period_day_configs" ON public.period_day_configs;
DROP POLICY IF EXISTS "Admin can insert period_day_configs" ON public.period_day_configs;
DROP POLICY IF EXISTS "Admin can update period_day_configs" ON public.period_day_configs;
DROP POLICY IF EXISTS "Admin can delete period_day_configs" ON public.period_day_configs;

CREATE POLICY "Escalas users can view period_day_configs"
  ON public.period_day_configs FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert period_day_configs"
  ON public.period_day_configs FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update period_day_configs"
  ON public.period_day_configs FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete period_day_configs"
  ON public.period_day_configs FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- PERIOD_EXCLUDED_DATES
DROP POLICY IF EXISTS "Admin/Manager can view period_excluded_dates" ON public.period_excluded_dates;
DROP POLICY IF EXISTS "Admin can insert period_excluded_dates" ON public.period_excluded_dates;
DROP POLICY IF EXISTS "Admin can update period_excluded_dates" ON public.period_excluded_dates;
DROP POLICY IF EXISTS "Admin can delete period_excluded_dates" ON public.period_excluded_dates;

CREATE POLICY "Escalas users can view period_excluded_dates"
  ON public.period_excluded_dates FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert period_excluded_dates"
  ON public.period_excluded_dates FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update period_excluded_dates"
  ON public.period_excluded_dates FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete period_excluded_dates"
  ON public.period_excluded_dates FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- PERIOD_SPECIFIC_DAY_CONFIGS
DROP POLICY IF EXISTS "Admin/Manager can view period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Admin can insert period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Admin can update period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Admin can delete period_specific_day_configs" ON public.period_specific_day_configs;

CREATE POLICY "Escalas users can view period_specific_day_configs"
  ON public.period_specific_day_configs FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert period_specific_day_configs"
  ON public.period_specific_day_configs FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update period_specific_day_configs"
  ON public.period_specific_day_configs FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete period_specific_day_configs"
  ON public.period_specific_day_configs FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- ASSIGNMENT_HISTORY_MONTHLY
DROP POLICY IF EXISTS "Admin/Manager can view assignment_history_monthly" ON public.assignment_history_monthly;
DROP POLICY IF EXISTS "Admin can insert assignment_history_monthly" ON public.assignment_history_monthly;
DROP POLICY IF EXISTS "Admin can update assignment_history_monthly" ON public.assignment_history_monthly;
DROP POLICY IF EXISTS "Admin can delete assignment_history_monthly" ON public.assignment_history_monthly;

CREATE POLICY "Escalas users can view assignment_history_monthly"
  ON public.assignment_history_monthly FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert assignment_history_monthly"
  ON public.assignment_history_monthly FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update assignment_history_monthly"
  ON public.assignment_history_monthly FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete assignment_history_monthly"
  ON public.assignment_history_monthly FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- BROKER_WEEKLY_STATS
DROP POLICY IF EXISTS "Admin/Manager can view broker_weekly_stats" ON public.broker_weekly_stats;
DROP POLICY IF EXISTS "Admin can insert broker_weekly_stats" ON public.broker_weekly_stats;
DROP POLICY IF EXISTS "Admin can update broker_weekly_stats" ON public.broker_weekly_stats;
DROP POLICY IF EXISTS "Admin can delete broker_weekly_stats" ON public.broker_weekly_stats;

CREATE POLICY "Escalas users can view broker_weekly_stats"
  ON public.broker_weekly_stats FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can insert broker_weekly_stats"
  ON public.broker_weekly_stats FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can update broker_weekly_stats"
  ON public.broker_weekly_stats FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

CREATE POLICY "Escalas editors can delete broker_weekly_stats"
  ON public.broker_weekly_stats FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'escalas'));

-- ==========================================
-- PARTE 3: POLÍTICAS DO MÓDULO VENDAS
-- ==========================================

-- SALES
DROP POLICY IF EXISTS "Admin/Manager can view sales" ON public.sales;
DROP POLICY IF EXISTS "Admin can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Admin can update sales" ON public.sales;
DROP POLICY IF EXISTS "Admin can delete sales" ON public.sales;

CREATE POLICY "Vendas users can view sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert sales"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update sales"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete sales"
  ON public.sales FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- SALES_BROKERS
DROP POLICY IF EXISTS "Admin/Manager can view sales_brokers" ON public.sales_brokers;
DROP POLICY IF EXISTS "Admin can insert sales_brokers" ON public.sales_brokers;
DROP POLICY IF EXISTS "Admin can update sales_brokers" ON public.sales_brokers;
DROP POLICY IF EXISTS "Admin can delete sales_brokers" ON public.sales_brokers;

CREATE POLICY "Vendas users can view sales_brokers"
  ON public.sales_brokers FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert sales_brokers"
  ON public.sales_brokers FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update sales_brokers"
  ON public.sales_brokers FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete sales_brokers"
  ON public.sales_brokers FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- SALES_TEAMS
DROP POLICY IF EXISTS "Admin/Manager can view sales_teams" ON public.sales_teams;
DROP POLICY IF EXISTS "Admin can insert sales_teams" ON public.sales_teams;
DROP POLICY IF EXISTS "Admin can update sales_teams" ON public.sales_teams;
DROP POLICY IF EXISTS "Admin can delete sales_teams" ON public.sales_teams;

CREATE POLICY "Vendas users can view sales_teams"
  ON public.sales_teams FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert sales_teams"
  ON public.sales_teams FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update sales_teams"
  ON public.sales_teams FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete sales_teams"
  ON public.sales_teams FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- SALE_PARTNERS
DROP POLICY IF EXISTS "Admin/Manager can view sale_partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Admin can insert sale_partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Admin can update sale_partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Admin can delete sale_partners" ON public.sale_partners;

CREATE POLICY "Vendas users can view sale_partners"
  ON public.sale_partners FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert sale_partners"
  ON public.sale_partners FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update sale_partners"
  ON public.sale_partners FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete sale_partners"
  ON public.sale_partners FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- MONTHLY_LEADS
DROP POLICY IF EXISTS "Admin/Manager can view monthly_leads" ON public.monthly_leads;
DROP POLICY IF EXISTS "Admin can insert monthly_leads" ON public.monthly_leads;
DROP POLICY IF EXISTS "Admin can update monthly_leads" ON public.monthly_leads;
DROP POLICY IF EXISTS "Admin can delete monthly_leads" ON public.monthly_leads;

CREATE POLICY "Vendas users can view monthly_leads"
  ON public.monthly_leads FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert monthly_leads"
  ON public.monthly_leads FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update monthly_leads"
  ON public.monthly_leads FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete monthly_leads"
  ON public.monthly_leads FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- BROKER_EVALUATIONS
DROP POLICY IF EXISTS "Admin/Manager can view broker_evaluations" ON public.broker_evaluations;
DROP POLICY IF EXISTS "Admin can insert broker_evaluations" ON public.broker_evaluations;
DROP POLICY IF EXISTS "Admin can update broker_evaluations" ON public.broker_evaluations;
DROP POLICY IF EXISTS "Admin can delete broker_evaluations" ON public.broker_evaluations;

CREATE POLICY "Vendas users can view broker_evaluations"
  ON public.broker_evaluations FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert broker_evaluations"
  ON public.broker_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update broker_evaluations"
  ON public.broker_evaluations FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete broker_evaluations"
  ON public.broker_evaluations FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- BROKER_GOALS
DROP POLICY IF EXISTS "Admin/Manager can view broker_goals" ON public.broker_goals;
DROP POLICY IF EXISTS "Admin can insert broker_goals" ON public.broker_goals;
DROP POLICY IF EXISTS "Admin can update broker_goals" ON public.broker_goals;
DROP POLICY IF EXISTS "Admin can delete broker_goals" ON public.broker_goals;

CREATE POLICY "Vendas users can view broker_goals"
  ON public.broker_goals FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert broker_goals"
  ON public.broker_goals FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update broker_goals"
  ON public.broker_goals FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete broker_goals"
  ON public.broker_goals FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- BROKER_MONTHLY_PROPOSALS
DROP POLICY IF EXISTS "Admin/Manager can view broker_monthly_proposals" ON public.broker_monthly_proposals;
DROP POLICY IF EXISTS "Admin can insert broker_monthly_proposals" ON public.broker_monthly_proposals;
DROP POLICY IF EXISTS "Admin can update broker_monthly_proposals" ON public.broker_monthly_proposals;
DROP POLICY IF EXISTS "Admin can delete broker_monthly_proposals" ON public.broker_monthly_proposals;

CREATE POLICY "Vendas users can view broker_monthly_proposals"
  ON public.broker_monthly_proposals FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert broker_monthly_proposals"
  ON public.broker_monthly_proposals FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update broker_monthly_proposals"
  ON public.broker_monthly_proposals FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete broker_monthly_proposals"
  ON public.broker_monthly_proposals FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- TEAM_GOALS
DROP POLICY IF EXISTS "Admin/Manager can view team_goals" ON public.team_goals;
DROP POLICY IF EXISTS "Admin can insert team_goals" ON public.team_goals;
DROP POLICY IF EXISTS "Admin can update team_goals" ON public.team_goals;
DROP POLICY IF EXISTS "Admin can delete team_goals" ON public.team_goals;

CREATE POLICY "Vendas users can view team_goals"
  ON public.team_goals FOR SELECT
  TO authenticated
  USING (can_view_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can insert team_goals"
  ON public.team_goals FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can update team_goals"
  ON public.team_goals FOR UPDATE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

CREATE POLICY "Vendas editors can delete team_goals"
  ON public.team_goals FOR DELETE
  TO authenticated
  USING (can_edit_system(auth.uid(), 'vendas'));

-- MODULE_AUDIT_LOGS (ambos módulos podem visualizar logs do seu módulo)
DROP POLICY IF EXISTS "Admin can view module_audit_logs" ON public.module_audit_logs;
DROP POLICY IF EXISTS "Admin can insert module_audit_logs" ON public.module_audit_logs;

CREATE POLICY "Users can view own module audit_logs"
  ON public.module_audit_logs FOR SELECT
  TO authenticated
  USING (
    (module_name = 'escalas' AND can_view_system(auth.uid(), 'escalas'))
    OR (module_name = 'vendas' AND can_view_system(auth.uid(), 'vendas'))
    OR (module_name = 'sistema' AND is_admin_or_super(auth.uid()))
  );

CREATE POLICY "System can insert module_audit_logs"
  ON public.module_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
