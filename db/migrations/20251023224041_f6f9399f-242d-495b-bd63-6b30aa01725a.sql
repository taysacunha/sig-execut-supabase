-- Drop existing permissive RLS policies on all tables
-- Brokers table
DROP POLICY IF EXISTS "Anyone can view brokers" ON public.brokers;
DROP POLICY IF EXISTS "Anyone can insert brokers" ON public.brokers;
DROP POLICY IF EXISTS "Anyone can update brokers" ON public.brokers;
DROP POLICY IF EXISTS "Anyone can delete brokers" ON public.brokers;

-- Locations table
DROP POLICY IF EXISTS "Anyone can view locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can update locations" ON public.locations;
DROP POLICY IF EXISTS "Anyone can delete locations" ON public.locations;

-- Location brokers table
DROP POLICY IF EXISTS "Anyone can view location_brokers" ON public.location_brokers;
DROP POLICY IF EXISTS "Anyone can insert location_brokers" ON public.location_brokers;
DROP POLICY IF EXISTS "Anyone can update location_brokers" ON public.location_brokers;
DROP POLICY IF EXISTS "Anyone can delete location_brokers" ON public.location_brokers;

-- Location periods table
DROP POLICY IF EXISTS "Anyone can view location_periods" ON public.location_periods;
DROP POLICY IF EXISTS "Anyone can insert location_periods" ON public.location_periods;
DROP POLICY IF EXISTS "Anyone can update location_periods" ON public.location_periods;
DROP POLICY IF EXISTS "Anyone can delete location_periods" ON public.location_periods;

-- Period day configs table
DROP POLICY IF EXISTS "Anyone can view period_day_configs" ON public.period_day_configs;
DROP POLICY IF EXISTS "Anyone can insert period_day_configs" ON public.period_day_configs;
DROP POLICY IF EXISTS "Anyone can update period_day_configs" ON public.period_day_configs;
DROP POLICY IF EXISTS "Anyone can delete period_day_configs" ON public.period_day_configs;

-- Schedules table
DROP POLICY IF EXISTS "Anyone can view schedules" ON public.schedules;
DROP POLICY IF EXISTS "Anyone can insert schedules" ON public.schedules;
DROP POLICY IF EXISTS "Anyone can update schedules" ON public.schedules;
DROP POLICY IF EXISTS "Anyone can delete schedules" ON public.schedules;

-- Schedule assignments table
DROP POLICY IF EXISTS "Anyone can view schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Anyone can insert schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Anyone can update schedule_assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Anyone can delete schedule_assignments" ON public.schedule_assignments;

-- Schedule brokers table
DROP POLICY IF EXISTS "Anyone can view schedule_brokers" ON public.schedule_brokers;
DROP POLICY IF EXISTS "Anyone can insert schedule_brokers" ON public.schedule_brokers;
DROP POLICY IF EXISTS "Anyone can update schedule_brokers" ON public.schedule_brokers;
DROP POLICY IF EXISTS "Anyone can delete schedule_brokers" ON public.schedule_brokers;

-- Schedule locations table
DROP POLICY IF EXISTS "Anyone can view schedule_locations" ON public.schedule_locations;
DROP POLICY IF EXISTS "Anyone can insert schedule_locations" ON public.schedule_locations;
DROP POLICY IF EXISTS "Anyone can update schedule_locations" ON public.schedule_locations;
DROP POLICY IF EXISTS "Anyone can delete schedule_locations" ON public.schedule_locations;

-- Generated schedules table
DROP POLICY IF EXISTS "Anyone can view generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Anyone can insert generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Anyone can update generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Anyone can delete generated_schedules" ON public.generated_schedules;

-- Create secure RLS policies for authenticated users only
-- Brokers table
CREATE POLICY "Authenticated users can view brokers" 
ON public.brokers FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert brokers" 
ON public.brokers FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update brokers" 
ON public.brokers FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete brokers" 
ON public.brokers FOR DELETE 
TO authenticated 
USING (true);

-- Locations table
CREATE POLICY "Authenticated users can view locations" 
ON public.locations FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert locations" 
ON public.locations FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update locations" 
ON public.locations FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete locations" 
ON public.locations FOR DELETE 
TO authenticated 
USING (true);

-- Location brokers table
CREATE POLICY "Authenticated users can view location_brokers" 
ON public.location_brokers FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert location_brokers" 
ON public.location_brokers FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update location_brokers" 
ON public.location_brokers FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete location_brokers" 
ON public.location_brokers FOR DELETE 
TO authenticated 
USING (true);

-- Location periods table
CREATE POLICY "Authenticated users can view location_periods" 
ON public.location_periods FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert location_periods" 
ON public.location_periods FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update location_periods" 
ON public.location_periods FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete location_periods" 
ON public.location_periods FOR DELETE 
TO authenticated 
USING (true);

-- Period day configs table
CREATE POLICY "Authenticated users can view period_day_configs" 
ON public.period_day_configs FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert period_day_configs" 
ON public.period_day_configs FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update period_day_configs" 
ON public.period_day_configs FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete period_day_configs" 
ON public.period_day_configs FOR DELETE 
TO authenticated 
USING (true);

-- Schedules table
CREATE POLICY "Authenticated users can view schedules" 
ON public.schedules FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert schedules" 
ON public.schedules FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules" 
ON public.schedules FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete schedules" 
ON public.schedules FOR DELETE 
TO authenticated 
USING (true);

-- Schedule assignments table
CREATE POLICY "Authenticated users can view schedule_assignments" 
ON public.schedule_assignments FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert schedule_assignments" 
ON public.schedule_assignments FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule_assignments" 
ON public.schedule_assignments FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete schedule_assignments" 
ON public.schedule_assignments FOR DELETE 
TO authenticated 
USING (true);

-- Schedule brokers table
CREATE POLICY "Authenticated users can view schedule_brokers" 
ON public.schedule_brokers FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert schedule_brokers" 
ON public.schedule_brokers FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule_brokers" 
ON public.schedule_brokers FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete schedule_brokers" 
ON public.schedule_brokers FOR DELETE 
TO authenticated 
USING (true);

-- Schedule locations table
CREATE POLICY "Authenticated users can view schedule_locations" 
ON public.schedule_locations FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert schedule_locations" 
ON public.schedule_locations FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule_locations" 
ON public.schedule_locations FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete schedule_locations" 
ON public.schedule_locations FOR DELETE 
TO authenticated 
USING (true);

-- Generated schedules table
CREATE POLICY "Authenticated users can view generated_schedules" 
ON public.generated_schedules FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert generated_schedules" 
ON public.generated_schedules FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update generated_schedules" 
ON public.generated_schedules FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete generated_schedules" 
ON public.generated_schedules FOR DELETE 
TO authenticated 
USING (true);