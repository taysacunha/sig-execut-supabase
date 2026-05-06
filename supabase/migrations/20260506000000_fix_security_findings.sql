-- 1) ferias_audit_logs INSERT hardening
DROP POLICY IF EXISTS "ferias_audit_logs_insert" ON public.ferias_audit_logs;
CREATE POLICY "ferias_audit_logs_insert"
  ON public.ferias_audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND can_edit_system(auth.uid(), 'ferias')
  );

-- 2) Sensitive data table for CPF
CREATE TABLE IF NOT EXISTS public.ferias_colaboradores_dados_sensiveis (
  colaborador_id uuid PRIMARY KEY REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  cpf text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ferias_colaboradores_dados_sensiveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Editors can view colaborador sensitive data" ON public.ferias_colaboradores_dados_sensiveis;
CREATE POLICY "Editors can view colaborador sensitive data"
  ON public.ferias_colaboradores_dados_sensiveis FOR SELECT TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias') OR is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Editors can insert colaborador sensitive data" ON public.ferias_colaboradores_dados_sensiveis;
CREATE POLICY "Editors can insert colaborador sensitive data"
  ON public.ferias_colaboradores_dados_sensiveis FOR INSERT TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "Editors can update colaborador sensitive data" ON public.ferias_colaboradores_dados_sensiveis;
CREATE POLICY "Editors can update colaborador sensitive data"
  ON public.ferias_colaboradores_dados_sensiveis FOR UPDATE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'))
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "Editors can delete colaborador sensitive data" ON public.ferias_colaboradores_dados_sensiveis;
CREATE POLICY "Editors can delete colaborador sensitive data"
  ON public.ferias_colaboradores_dados_sensiveis FOR DELETE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'));

-- Backfill existing CPFs (executar antes do DROP COLUMN)
INSERT INTO public.ferias_colaboradores_dados_sensiveis (colaborador_id, cpf)
SELECT id, cpf FROM public.ferias_colaboradores WHERE cpf IS NOT NULL
ON CONFLICT (colaborador_id) DO UPDATE SET cpf = EXCLUDED.cpf;

ALTER TABLE public.ferias_colaboradores DROP COLUMN IF EXISTS cpf;

-- 3) module_audit_logs SELECT — incluir ferias e estoque
DROP POLICY IF EXISTS "Users can view own module audit_logs" ON public.module_audit_logs;
CREATE POLICY "Users can view own module audit_logs"
  ON public.module_audit_logs FOR SELECT TO authenticated
  USING (
    (module_name = 'escalas' AND can_view_system(auth.uid(), 'escalas'))
    OR (module_name = 'vendas' AND can_view_system(auth.uid(), 'vendas'))
    OR (module_name = 'ferias' AND can_view_system(auth.uid(), 'ferias'))
    OR (module_name = 'estoque' AND can_view_system(auth.uid(), 'estoque'))
    OR (module_name = 'sistema' AND is_admin_or_super(auth.uid()))
  );

-- 4) Limpar policies legacy "always true" remanescentes
DROP POLICY IF EXISTS "Authenticated users can view period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can insert period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can update period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can delete period_specific_day_configs" ON public.period_specific_day_configs;

DROP POLICY IF EXISTS "Authenticated users can view brokers" ON public.brokers;
DROP POLICY IF EXISTS "Authenticated users can insert brokers" ON public.brokers;
DROP POLICY IF EXISTS "Authenticated users can update brokers" ON public.brokers;
DROP POLICY IF EXISTS "Authenticated users can delete brokers" ON public.brokers;

DROP POLICY IF EXISTS "Authenticated users can view locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can update locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can delete locations" ON public.locations;

DROP POLICY IF EXISTS "Authenticated users can view generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Authenticated users can update generated_schedules" ON public.generated_schedules;
DROP POLICY IF EXISTS "Authenticated users can delete generated_schedules" ON public.generated_schedules;
