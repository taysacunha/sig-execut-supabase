
-- Corrigir todas as políticas RLS de INSERT e UPDATE para usar TO authenticated
-- em vez de TO public

-- assignment_history_monthly
DROP POLICY IF EXISTS "Admin can insert assignment_history" ON public.assignment_history_monthly;
DROP POLICY IF EXISTS "Admin can update assignment_history" ON public.assignment_history_monthly;

CREATE POLICY "Admin can insert assignment_history" 
ON public.assignment_history_monthly 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update assignment_history" 
ON public.assignment_history_monthly 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- generated_schedules
DROP POLICY IF EXISTS "Admin can insert generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Admin can update generated_schedules" ON public.generated_schedules;

CREATE POLICY "Admin can insert generated_schedules" 
ON public.generated_schedules 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update generated_schedules" 
ON public.generated_schedules 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- location_brokers
DROP POLICY IF EXISTS "Admin can insert location_brokers" ON public.location_brokers;
DROP POLICY IF EXISTS "Admin can update location_brokers" ON public.location_brokers;

CREATE POLICY "Admin can insert location_brokers" 
ON public.location_brokers 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update location_brokers" 
ON public.location_brokers 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- location_periods
DROP POLICY IF EXISTS "Admin can insert location_periods" ON public.location_periods;
DROP POLICY IF EXISTS "Admin can update location_periods" ON public.location_periods;

CREATE POLICY "Admin can insert location_periods" 
ON public.location_periods 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update location_periods" 
ON public.location_periods 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- locations
DROP POLICY IF EXISTS "Admin can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Admin can update locations" ON public.locations;

CREATE POLICY "Admin can insert locations" 
ON public.locations 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update locations" 
ON public.locations 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- period_day_configs
DROP POLICY IF EXISTS "Admin can insert period_day_configs" ON public.period_day_configs;
DROP POLICY IF EXISTS "Admin can update period_day_configs" ON public.period_day_configs;

CREATE POLICY "Admin can insert period_day_configs" 
ON public.period_day_configs 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update period_day_configs" 
ON public.period_day_configs 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- period_excluded_dates
DROP POLICY IF EXISTS "Admin can insert period_excluded_dates" ON public.period_excluded_dates;
DROP POLICY IF EXISTS "Admin can update period_excluded_dates" ON public.period_excluded_dates;

CREATE POLICY "Admin can insert period_excluded_dates" 
ON public.period_excluded_dates 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update period_excluded_dates" 
ON public.period_excluded_dates 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- period_specific_day_configs
DROP POLICY IF EXISTS "Admin can insert period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Admin can update period_specific_day_configs" ON public.period_specific_day_configs;

CREATE POLICY "Admin can insert period_specific_day_configs" 
ON public.period_specific_day_configs 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update period_specific_day_configs" 
ON public.period_specific_day_configs 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- schedule_assignments
DROP POLICY IF EXISTS "Admin can insert schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Admin can update schedule_assignments" ON public.schedule_assignments;

CREATE POLICY "Admin can insert schedule_assignments" 
ON public.schedule_assignments 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update schedule_assignments" 
ON public.schedule_assignments 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- schedule_brokers
DROP POLICY IF EXISTS "Admin can insert schedule_brokers" ON public.schedule_brokers;
DROP POLICY IF EXISTS "Admin can update schedule_brokers" ON public.schedule_brokers;

CREATE POLICY "Admin can insert schedule_brokers" 
ON public.schedule_brokers 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update schedule_brokers" 
ON public.schedule_brokers 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- schedule_locations
DROP POLICY IF EXISTS "Admin can insert schedule_locations" ON public.schedule_locations;
DROP POLICY IF EXISTS "Admin can update schedule_locations" ON public.schedule_locations;

CREATE POLICY "Admin can insert schedule_locations" 
ON public.schedule_locations 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update schedule_locations" 
ON public.schedule_locations 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- schedules
DROP POLICY IF EXISTS "Admin can insert schedules" ON public.schedules;
DROP POLICY IF EXISTS "Admin can update schedules" ON public.schedules;

CREATE POLICY "Admin can insert schedules" 
ON public.schedules 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update schedules" 
ON public.schedules 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- brokers
DROP POLICY IF EXISTS "Admin can insert brokers" ON public.brokers;
DROP POLICY IF EXISTS "Admin can update brokers" ON public.brokers;

CREATE POLICY "Admin can insert brokers" 
ON public.brokers 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update brokers" 
ON public.brokers 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admin can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update user_roles" ON public.user_roles;

CREATE POLICY "Admin can insert user_roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update user_roles" 
ON public.user_roles 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
