-- Add policy for managers to view brokers (needed for Schedules page)
CREATE POLICY "Manager can view all brokers" 
ON public.brokers 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));