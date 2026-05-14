-- Drop existing permissive policies on sale_partners
DROP POLICY IF EXISTS "Users can view sale partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Users can insert sale partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Users can update sale partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Users can delete sale partners" ON public.sale_partners;

-- Create restrictive policies aligned with sales table
CREATE POLICY "Admins and managers can view sale partners"
ON public.sale_partners
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admins and managers can insert sale partners"
ON public.sale_partners
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admins and managers can update sale partners"
ON public.sale_partners
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admins can delete sale partners"
ON public.sale_partners
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));