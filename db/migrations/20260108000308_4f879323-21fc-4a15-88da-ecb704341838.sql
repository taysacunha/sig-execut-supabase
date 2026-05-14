-- Remove old permissive policies that still exist
DROP POLICY IF EXISTS "Authenticated users can delete sale_partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Authenticated users can insert sale_partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Authenticated users can update sale_partners" ON public.sale_partners;
DROP POLICY IF EXISTS "Authenticated users can view sale_partners" ON public.sale_partners;