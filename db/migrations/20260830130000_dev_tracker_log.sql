-- Histórico cronológico de desenvolvimento + restrição de acesso por e-mail
-- Acesso exclusivo: brunumorais@gmail.com

CREATE TABLE IF NOT EXISTS public.dev_tracker_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_on date NOT NULL DEFAULT current_date,
  system_name text NOT NULL,
  title text NOT NULL,
  description text,
  change_type text NOT NULL DEFAULT 'novo',
  hours numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dev_tracker_log TO authenticated;
GRANT ALL ON public.dev_tracker_log TO service_role;

ALTER TABLE public.dev_tracker_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dev owner manages dev_tracker_log" ON public.dev_tracker_log;
CREATE POLICY "Dev owner manages dev_tracker_log"
  ON public.dev_tracker_log
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brunumorais@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brunumorais@gmail.com');

DROP TRIGGER IF EXISTS handle_dev_tracker_log_updated_at ON public.dev_tracker_log;
CREATE TRIGGER handle_dev_tracker_log_updated_at
  BEFORE UPDATE ON public.dev_tracker_log
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_dev_tracker_log_occurred_on
  ON public.dev_tracker_log (occurred_on DESC);

-- dev_tracker: restringir ao mesmo e-mail (antes: admins)
DROP POLICY IF EXISTS "Admins can manage dev_tracker" ON public.dev_tracker;
DROP POLICY IF EXISTS "Dev owner manages dev_tracker" ON public.dev_tracker;
CREATE POLICY "Dev owner manages dev_tracker"
  ON public.dev_tracker
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brunumorais@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brunumorais@gmail.com');
