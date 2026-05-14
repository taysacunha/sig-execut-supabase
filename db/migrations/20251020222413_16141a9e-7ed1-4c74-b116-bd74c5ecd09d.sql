-- Create enum for shift types
CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'full');

-- Create enum for weekdays
CREATE TYPE weekday AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- Create brokers table (corretores)
CREATE TABLE public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creci TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create locations table (locais)
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  morning_start TIME,
  morning_end TIME,
  afternoon_start TIME,
  afternoon_end TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create schedules table (escalas)
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weekdays weekday[] NOT NULL,
  shift_type shift_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create junction table for schedule-broker relationship
CREATE TABLE public.schedule_brokers (
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, broker_id)
);

-- Create junction table for schedule-location relationship
CREATE TABLE public.schedule_locations (
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, location_id)
);

-- Enable RLS
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_locations ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for now, can be restricted later)
CREATE POLICY "Anyone can view brokers" ON public.brokers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert brokers" ON public.brokers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update brokers" ON public.brokers FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete brokers" ON public.brokers FOR DELETE USING (true);

CREATE POLICY "Anyone can view locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update locations" ON public.locations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete locations" ON public.locations FOR DELETE USING (true);

CREATE POLICY "Anyone can view schedules" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert schedules" ON public.schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update schedules" ON public.schedules FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete schedules" ON public.schedules FOR DELETE USING (true);

CREATE POLICY "Anyone can view schedule_brokers" ON public.schedule_brokers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert schedule_brokers" ON public.schedule_brokers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update schedule_brokers" ON public.schedule_brokers FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete schedule_brokers" ON public.schedule_brokers FOR DELETE USING (true);

CREATE POLICY "Anyone can view schedule_locations" ON public.schedule_locations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert schedule_locations" ON public.schedule_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update schedule_locations" ON public.schedule_locations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete schedule_locations" ON public.schedule_locations FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.brokers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();