-- Converter todas as políticas RESTRICTIVE para PERMISSIVE em todas as 24 tabelas
-- Isso não afeta funcionalidades, apenas segue melhores práticas

-- ========== schedule_assignments ==========
DROP POLICY IF EXISTS "Admin can delete schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Admin can insert schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Admin can update schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Admin/Manager can view schedule_assignments" ON schedule_assignments;

CREATE POLICY "Admin can delete schedule_assignments" ON schedule_assignments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert schedule_assignments" ON schedule_assignments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update schedule_assignments" ON schedule_assignments FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view schedule_assignments" ON schedule_assignments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== locations ==========
DROP POLICY IF EXISTS "Admin can delete locations" ON locations;
DROP POLICY IF EXISTS "Admin can insert locations" ON locations;
DROP POLICY IF EXISTS "Admin can update locations" ON locations;
DROP POLICY IF EXISTS "Admin/Manager can view locations" ON locations;

CREATE POLICY "Admin can delete locations" ON locations FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert locations" ON locations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update locations" ON locations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view locations" ON locations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== broker_goals ==========
DROP POLICY IF EXISTS "Admin can delete broker_goals" ON broker_goals;
DROP POLICY IF EXISTS "Admin can insert broker_goals" ON broker_goals;
DROP POLICY IF EXISTS "Admin can update broker_goals" ON broker_goals;
DROP POLICY IF EXISTS "Admin/Manager can view broker_goals" ON broker_goals;

CREATE POLICY "Admin can delete broker_goals" ON broker_goals FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert broker_goals" ON broker_goals FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update broker_goals" ON broker_goals FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view broker_goals" ON broker_goals FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== location_periods ==========
DROP POLICY IF EXISTS "Admin can delete location_periods" ON location_periods;
DROP POLICY IF EXISTS "Admin can insert location_periods" ON location_periods;
DROP POLICY IF EXISTS "Admin can update location_periods" ON location_periods;
DROP POLICY IF EXISTS "Admin/Manager can view location_periods" ON location_periods;

CREATE POLICY "Admin can delete location_periods" ON location_periods FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert location_periods" ON location_periods FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update location_periods" ON location_periods FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view location_periods" ON location_periods FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== system_access ==========
DROP POLICY IF EXISTS "Admin can delete system_access" ON system_access;
DROP POLICY IF EXISTS "Admin can insert system_access" ON system_access;
DROP POLICY IF EXISTS "Admin can update system_access" ON system_access;
DROP POLICY IF EXISTS "Admin can view all system_access" ON system_access;
DROP POLICY IF EXISTS "Users can view own system_access" ON system_access;

CREATE POLICY "Admin can delete system_access" ON system_access FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert system_access" ON system_access FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update system_access" ON system_access FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can view all system_access" ON system_access FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own system_access" ON system_access FOR SELECT USING (auth.uid() = user_id);

-- ========== location_brokers ==========
DROP POLICY IF EXISTS "Admin can delete location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Admin can insert location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Admin can update location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Admin/Manager can view location_brokers" ON location_brokers;

CREATE POLICY "Admin can delete location_brokers" ON location_brokers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert location_brokers" ON location_brokers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update location_brokers" ON location_brokers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view location_brokers" ON location_brokers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== proposals ==========
DROP POLICY IF EXISTS "Admin can delete proposals" ON proposals;
DROP POLICY IF EXISTS "Admin/Manager can insert proposals" ON proposals;
DROP POLICY IF EXISTS "Admin/Manager can update proposals" ON proposals;
DROP POLICY IF EXISTS "Admin/Manager can view proposals" ON proposals;

CREATE POLICY "Admin can delete proposals" ON proposals FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can insert proposals" ON proposals FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can update proposals" ON proposals FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can view proposals" ON proposals FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== sales ==========
DROP POLICY IF EXISTS "Admin can delete sales" ON sales;
DROP POLICY IF EXISTS "Admin/Manager can insert sales" ON sales;
DROP POLICY IF EXISTS "Admin/Manager can update sales" ON sales;
DROP POLICY IF EXISTS "Admin/Manager can view sales" ON sales;

CREATE POLICY "Admin can delete sales" ON sales FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can insert sales" ON sales FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can update sales" ON sales FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can view sales" ON sales FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== schedules ==========
DROP POLICY IF EXISTS "Admin can delete schedules" ON schedules;
DROP POLICY IF EXISTS "Admin can insert schedules" ON schedules;
DROP POLICY IF EXISTS "Admin can update schedules" ON schedules;
DROP POLICY IF EXISTS "Admin/Manager can view schedules" ON schedules;

CREATE POLICY "Admin can delete schedules" ON schedules FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert schedules" ON schedules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update schedules" ON schedules FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view schedules" ON schedules FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== monthly_leads ==========
DROP POLICY IF EXISTS "Admin can delete monthly_leads" ON monthly_leads;
DROP POLICY IF EXISTS "Admin/Manager can insert monthly_leads" ON monthly_leads;
DROP POLICY IF EXISTS "Admin/Manager can update monthly_leads" ON monthly_leads;
DROP POLICY IF EXISTS "Admin/Manager can view monthly_leads" ON monthly_leads;

CREATE POLICY "Admin can delete monthly_leads" ON monthly_leads FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can insert monthly_leads" ON monthly_leads FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can update monthly_leads" ON monthly_leads FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can view monthly_leads" ON monthly_leads FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== generated_schedules ==========
DROP POLICY IF EXISTS "Admin can delete generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Admin can insert generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Admin can update generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Admin/Manager can view generated_schedules" ON generated_schedules;

CREATE POLICY "Admin can delete generated_schedules" ON generated_schedules FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert generated_schedules" ON generated_schedules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update generated_schedules" ON generated_schedules FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view generated_schedules" ON generated_schedules FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== period_excluded_dates ==========
DROP POLICY IF EXISTS "Admin can delete period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Admin can insert period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Admin can update period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Admin/Manager can view period_excluded_dates" ON period_excluded_dates;

CREATE POLICY "Admin can delete period_excluded_dates" ON period_excluded_dates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert period_excluded_dates" ON period_excluded_dates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update period_excluded_dates" ON period_excluded_dates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view period_excluded_dates" ON period_excluded_dates FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== period_specific_day_configs ==========
DROP POLICY IF EXISTS "Admin can delete period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Admin can insert period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Admin can update period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Admin/Manager can view period_specific_day_configs" ON period_specific_day_configs;

CREATE POLICY "Admin can delete period_specific_day_configs" ON period_specific_day_configs FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert period_specific_day_configs" ON period_specific_day_configs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update period_specific_day_configs" ON period_specific_day_configs FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view period_specific_day_configs" ON period_specific_day_configs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== broker_monthly_proposals ==========
DROP POLICY IF EXISTS "Admin can delete broker_monthly_proposals" ON broker_monthly_proposals;
DROP POLICY IF EXISTS "Admin/Manager can insert broker_monthly_proposals" ON broker_monthly_proposals;
DROP POLICY IF EXISTS "Admin/Manager can update broker_monthly_proposals" ON broker_monthly_proposals;
DROP POLICY IF EXISTS "Admin/Manager can view broker_monthly_proposals" ON broker_monthly_proposals;

CREATE POLICY "Admin can delete broker_monthly_proposals" ON broker_monthly_proposals FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can insert broker_monthly_proposals" ON broker_monthly_proposals FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can update broker_monthly_proposals" ON broker_monthly_proposals FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can view broker_monthly_proposals" ON broker_monthly_proposals FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== user_roles ==========
DROP POLICY IF EXISTS "Admin can delete user_roles" ON user_roles;
DROP POLICY IF EXISTS "Admin can insert user_roles" ON user_roles;
DROP POLICY IF EXISTS "Admin can update user_roles" ON user_roles;
DROP POLICY IF EXISTS "Admin can view all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;

CREATE POLICY "Admin can delete user_roles" ON user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert user_roles" ON user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update user_roles" ON user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can view all user_roles" ON user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own role" ON user_roles FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ========== schedule_locations ==========
DROP POLICY IF EXISTS "Admin can delete schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Admin can insert schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Admin can update schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Admin/Manager can view schedule_locations" ON schedule_locations;

CREATE POLICY "Admin can delete schedule_locations" ON schedule_locations FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert schedule_locations" ON schedule_locations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update schedule_locations" ON schedule_locations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view schedule_locations" ON schedule_locations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== sales_teams ==========
DROP POLICY IF EXISTS "Admin can delete sales_teams" ON sales_teams;
DROP POLICY IF EXISTS "Admin can insert sales_teams" ON sales_teams;
DROP POLICY IF EXISTS "Admin can update sales_teams" ON sales_teams;
DROP POLICY IF EXISTS "Admin/Manager can view sales_teams" ON sales_teams;

CREATE POLICY "Admin can delete sales_teams" ON sales_teams FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert sales_teams" ON sales_teams FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update sales_teams" ON sales_teams FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view sales_teams" ON sales_teams FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== brokers ==========
DROP POLICY IF EXISTS "Admin can delete brokers" ON brokers;
DROP POLICY IF EXISTS "Admin can insert brokers" ON brokers;
DROP POLICY IF EXISTS "Admin can update brokers" ON brokers;
DROP POLICY IF EXISTS "Admin can view all brokers" ON brokers;
DROP POLICY IF EXISTS "Manager can view all brokers" ON brokers;

CREATE POLICY "Admin can delete brokers" ON brokers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert brokers" ON brokers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update brokers" ON brokers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can view all brokers" ON brokers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can view all brokers" ON brokers FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role));

-- ========== period_day_configs ==========
DROP POLICY IF EXISTS "Admin can delete period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Admin can insert period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Admin can update period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Admin/Manager can view period_day_configs" ON period_day_configs;

CREATE POLICY "Admin can delete period_day_configs" ON period_day_configs FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert period_day_configs" ON period_day_configs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update period_day_configs" ON period_day_configs FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view period_day_configs" ON period_day_configs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== sales_brokers ==========
DROP POLICY IF EXISTS "Admin can delete sales_brokers" ON sales_brokers;
DROP POLICY IF EXISTS "Admin can insert sales_brokers" ON sales_brokers;
DROP POLICY IF EXISTS "Admin can update sales_brokers" ON sales_brokers;
DROP POLICY IF EXISTS "Admin/Manager can view sales_brokers" ON sales_brokers;

CREATE POLICY "Admin can delete sales_brokers" ON sales_brokers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert sales_brokers" ON sales_brokers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update sales_brokers" ON sales_brokers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view sales_brokers" ON sales_brokers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== broker_evaluations ==========
DROP POLICY IF EXISTS "Admin can delete broker_evaluations" ON broker_evaluations;
DROP POLICY IF EXISTS "Admin/Manager can insert broker_evaluations" ON broker_evaluations;
DROP POLICY IF EXISTS "Admin/Manager can update broker_evaluations" ON broker_evaluations;
DROP POLICY IF EXISTS "Admin/Manager can view broker_evaluations" ON broker_evaluations;

CREATE POLICY "Admin can delete broker_evaluations" ON broker_evaluations FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can insert broker_evaluations" ON broker_evaluations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can update broker_evaluations" ON broker_evaluations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/Manager can view broker_evaluations" ON broker_evaluations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== schedule_brokers ==========
DROP POLICY IF EXISTS "Admin can delete schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Admin can insert schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Admin can update schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Admin/Manager can view schedule_brokers" ON schedule_brokers;

CREATE POLICY "Admin can delete schedule_brokers" ON schedule_brokers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert schedule_brokers" ON schedule_brokers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update schedule_brokers" ON schedule_brokers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view schedule_brokers" ON schedule_brokers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== assignment_history_monthly ==========
DROP POLICY IF EXISTS "Admin can delete assignment_history" ON assignment_history_monthly;
DROP POLICY IF EXISTS "Admin can insert assignment_history" ON assignment_history_monthly;
DROP POLICY IF EXISTS "Admin can update assignment_history" ON assignment_history_monthly;
DROP POLICY IF EXISTS "Admin/Manager can view assignment_history" ON assignment_history_monthly;

CREATE POLICY "Admin can delete assignment_history" ON assignment_history_monthly FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert assignment_history" ON assignment_history_monthly FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update assignment_history" ON assignment_history_monthly FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view assignment_history" ON assignment_history_monthly FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ========== team_goals ==========
DROP POLICY IF EXISTS "Admin can delete team_goals" ON team_goals;
DROP POLICY IF EXISTS "Admin can insert team_goals" ON team_goals;
DROP POLICY IF EXISTS "Admin can update team_goals" ON team_goals;
DROP POLICY IF EXISTS "Admin/Manager can view team_goals" ON team_goals;

CREATE POLICY "Admin can delete team_goals" ON team_goals FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert team_goals" ON team_goals FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update team_goals" ON team_goals FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin/Manager can view team_goals" ON team_goals FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));