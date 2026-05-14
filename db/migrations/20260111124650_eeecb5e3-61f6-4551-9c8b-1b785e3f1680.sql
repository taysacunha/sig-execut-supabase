-- Create table to track locked schedules (manually edited weeks that shouldn't be overwritten)
CREATE TABLE public.schedule_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.generated_schedules(id) ON DELETE CASCADE,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  locked_by UUID REFERENCES auth.users(id),
  reason TEXT,
  UNIQUE(schedule_id)
);

-- Enable Row Level Security
ALTER TABLE public.schedule_locks ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all schedule locks" 
ON public.schedule_locks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can create schedule locks" 
ON public.schedule_locks 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete schedule locks" 
ON public.schedule_locks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);