-- Add is_launch column to sales_brokers table
ALTER TABLE public.sales_brokers 
ADD COLUMN is_launch BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.sales_brokers.is_launch IS 'Indicates if the broker is in launch/training period';