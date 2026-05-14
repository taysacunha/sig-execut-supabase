-- Remove políticas de INSERT que incluem manager
DROP POLICY IF EXISTS "Admin/Manager can insert brokers" ON brokers;
DROP POLICY IF EXISTS "Admin/Manager can insert locations" ON locations;
DROP POLICY IF EXISTS "Admin/Manager can insert schedules" ON schedules;
DROP POLICY IF EXISTS "Admin/Manager can insert schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Admin/Manager can insert schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Admin/Manager can insert schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Admin/Manager can insert location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Admin/Manager can insert location_periods" ON location_periods;
DROP POLICY IF EXISTS "Admin/Manager can insert period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Admin/Manager can insert period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Admin/Manager can insert period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Admin/Manager can insert generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Admin/Manager can insert assignment_history" ON assignment_history_monthly;

-- Remove políticas de UPDATE que incluem manager
DROP POLICY IF EXISTS "Admin/Manager can update brokers" ON brokers;
DROP POLICY IF EXISTS "Admin/Manager can update locations" ON locations;
DROP POLICY IF EXISTS "Admin/Manager can update schedules" ON schedules;
DROP POLICY IF EXISTS "Admin/Manager can update schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Admin/Manager can update schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Admin/Manager can update schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Admin/Manager can update location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Admin/Manager can update location_periods" ON location_periods;
DROP POLICY IF EXISTS "Admin/Manager can update period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Admin/Manager can update period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Admin/Manager can update period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Admin/Manager can update generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Admin/Manager can update assignment_history" ON assignment_history_monthly;

-- Cria novas políticas de INSERT apenas para admin
CREATE POLICY "Admin can insert brokers" ON brokers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert locations" ON locations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert schedules" ON schedules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert schedule_assignments" ON schedule_assignments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert schedule_locations" ON schedule_locations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert schedule_brokers" ON schedule_brokers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert location_brokers" ON location_brokers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert location_periods" ON location_periods FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert period_day_configs" ON period_day_configs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert period_excluded_dates" ON period_excluded_dates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert period_specific_day_configs" ON period_specific_day_configs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert generated_schedules" ON generated_schedules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert assignment_history" ON assignment_history_monthly FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Cria novas políticas de UPDATE apenas para admin
CREATE POLICY "Admin can update brokers" ON brokers FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update locations" ON locations FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update schedules" ON schedules FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update schedule_assignments" ON schedule_assignments FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update schedule_locations" ON schedule_locations FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update schedule_brokers" ON schedule_brokers FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update location_brokers" ON location_brokers FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update location_periods" ON location_periods FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update period_day_configs" ON period_day_configs FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update period_excluded_dates" ON period_excluded_dates FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update period_specific_day_configs" ON period_specific_day_configs FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update generated_schedules" ON generated_schedules FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update assignment_history" ON assignment_history_monthly FOR UPDATE USING (has_role(auth.uid(), 'admin'));