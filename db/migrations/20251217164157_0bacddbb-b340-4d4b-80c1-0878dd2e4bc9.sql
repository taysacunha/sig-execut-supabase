-- Create table to persist validation results
CREATE TABLE public.schedule_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.generated_schedules(id) ON DELETE CASCADE,
  is_valid BOOLEAN NOT NULL,
  violations JSONB DEFAULT '[]',
  unallocated_demands JSONB DEFAULT '[]',
  summary JSONB NOT NULL,
  broker_reports JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schedule_id)
);

-- Enable RLS
ALTER TABLE public.schedule_validation_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin can manage schedule_validation_results"
ON public.schedule_validation_results
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can view schedule_validation_results"
ON public.schedule_validation_results
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));