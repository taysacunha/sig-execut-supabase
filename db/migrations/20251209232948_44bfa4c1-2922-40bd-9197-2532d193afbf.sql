-- =====================================================
-- CORRIGIR RLS PARA TODAS AS TABELAS DO SISTEMA
-- =====================================================

-- 1. SCHEDULES
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON schedules;
DROP POLICY IF EXISTS "Authenticated users can insert schedules" ON schedules;
DROP POLICY IF EXISTS "Authenticated users can update schedules" ON schedules;
DROP POLICY IF EXISTS "Authenticated users can delete schedules" ON schedules;

CREATE POLICY "Admin/Manager can view schedules" ON schedules
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert schedules" ON schedules
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update schedules" ON schedules
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete schedules" ON schedules
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 2. GENERATED_SCHEDULES
DROP POLICY IF EXISTS "Authenticated users can view generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Authenticated users can update generated_schedules" ON generated_schedules;
DROP POLICY IF EXISTS "Authenticated users can delete generated_schedules" ON generated_schedules;

CREATE POLICY "Admin/Manager can view generated_schedules" ON generated_schedules
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert generated_schedules" ON generated_schedules
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update generated_schedules" ON generated_schedules
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete generated_schedules" ON generated_schedules
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 3. SCHEDULE_ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated users can view schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Authenticated users can insert schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Authenticated users can update schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete schedule_assignments" ON schedule_assignments;

CREATE POLICY "Admin/Manager can view schedule_assignments" ON schedule_assignments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert schedule_assignments" ON schedule_assignments
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update schedule_assignments" ON schedule_assignments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete schedule_assignments" ON schedule_assignments
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 4. SCHEDULE_BROKERS
DROP POLICY IF EXISTS "Authenticated users can view schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Authenticated users can insert schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Authenticated users can update schedule_brokers" ON schedule_brokers;
DROP POLICY IF EXISTS "Authenticated users can delete schedule_brokers" ON schedule_brokers;

CREATE POLICY "Admin/Manager can view schedule_brokers" ON schedule_brokers
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert schedule_brokers" ON schedule_brokers
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update schedule_brokers" ON schedule_brokers
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete schedule_brokers" ON schedule_brokers
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 5. SCHEDULE_LOCATIONS
DROP POLICY IF EXISTS "Authenticated users can view schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Authenticated users can insert schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Authenticated users can update schedule_locations" ON schedule_locations;
DROP POLICY IF EXISTS "Authenticated users can delete schedule_locations" ON schedule_locations;

CREATE POLICY "Admin/Manager can view schedule_locations" ON schedule_locations
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert schedule_locations" ON schedule_locations
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update schedule_locations" ON schedule_locations
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete schedule_locations" ON schedule_locations
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 6. LOCATIONS
DROP POLICY IF EXISTS "Authenticated users can view locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can update locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can delete locations" ON locations;

CREATE POLICY "Admin/Manager can view locations" ON locations
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert locations" ON locations
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update locations" ON locations
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete locations" ON locations
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 7. LOCATION_PERIODS
DROP POLICY IF EXISTS "Authenticated users can view location_periods" ON location_periods;
DROP POLICY IF EXISTS "Authenticated users can insert location_periods" ON location_periods;
DROP POLICY IF EXISTS "Authenticated users can update location_periods" ON location_periods;
DROP POLICY IF EXISTS "Authenticated users can delete location_periods" ON location_periods;

CREATE POLICY "Admin/Manager can view location_periods" ON location_periods
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert location_periods" ON location_periods
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update location_periods" ON location_periods
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete location_periods" ON location_periods
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 8. LOCATION_BROKERS
DROP POLICY IF EXISTS "Authenticated users can view location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Authenticated users can insert location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Authenticated users can update location_brokers" ON location_brokers;
DROP POLICY IF EXISTS "Authenticated users can delete location_brokers" ON location_brokers;

CREATE POLICY "Admin/Manager can view location_brokers" ON location_brokers
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert location_brokers" ON location_brokers
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update location_brokers" ON location_brokers
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete location_brokers" ON location_brokers
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 9. PERIOD_DAY_CONFIGS
DROP POLICY IF EXISTS "Authenticated users can view period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Authenticated users can insert period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Authenticated users can update period_day_configs" ON period_day_configs;
DROP POLICY IF EXISTS "Authenticated users can delete period_day_configs" ON period_day_configs;

CREATE POLICY "Admin/Manager can view period_day_configs" ON period_day_configs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert period_day_configs" ON period_day_configs
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update period_day_configs" ON period_day_configs
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete period_day_configs" ON period_day_configs
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 10. PERIOD_EXCLUDED_DATES
DROP POLICY IF EXISTS "Authenticated users can view period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Authenticated users can insert period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Authenticated users can update period_excluded_dates" ON period_excluded_dates;
DROP POLICY IF EXISTS "Authenticated users can delete period_excluded_dates" ON period_excluded_dates;

CREATE POLICY "Admin/Manager can view period_excluded_dates" ON period_excluded_dates
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert period_excluded_dates" ON period_excluded_dates
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update period_excluded_dates" ON period_excluded_dates
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete period_excluded_dates" ON period_excluded_dates
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 11. PERIOD_SPECIFIC_DAY_CONFIGS
DROP POLICY IF EXISTS "Authenticated users can view period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can insert period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can update period_specific_day_configs" ON period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can delete period_specific_day_configs" ON period_specific_day_configs;

CREATE POLICY "Admin/Manager can view period_specific_day_configs" ON period_specific_day_configs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can insert period_specific_day_configs" ON period_specific_day_configs
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/Manager can update period_specific_day_configs" ON period_specific_day_configs
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin can delete period_specific_day_configs" ON period_specific_day_configs
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));