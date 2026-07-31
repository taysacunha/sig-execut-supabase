-- =====================================================================
-- Repasses: limite por beneficiário, data de recebimento e beneficiário
-- residual (quem fica com a sobra após todos atingirem o limite).
-- Também garante nível total de acesso ao super_admin no módulo Despesas.
-- =====================================================================

ALTER TABLE public.despesas_repasse_beneficiarios
  ADD COLUMN IF NOT EXISTS valor_limite numeric(14,2),
  ADD COLUMN IF NOT EXISTS data_recebimento date,
  ADD COLUMN IF NOT EXISTS is_residual boolean NOT NULL DEFAULT false;

-- No máximo um beneficiário residual por repasse
CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_rep_benef_residual
  ON public.despesas_repasse_beneficiarios(repasse_id)
  WHERE is_residual;

-- Valor do mês nunca pode ultrapassar o limite definido para o beneficiário
CREATE OR REPLACE FUNCTION public.despesas_repasse_benef_limite_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.valor_limite IS NOT NULL AND NEW.valor > NEW.valor_limite THEN
    RAISE EXCEPTION 'Valor (R$ %) excede o limite definido para o beneficiário (R$ %).',
      NEW.valor, NEW.valor_limite;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_rep_benef_limite ON public.despesas_repasse_beneficiarios;
CREATE TRIGGER trg_desp_rep_benef_limite
  BEFORE INSERT OR UPDATE ON public.despesas_repasse_beneficiarios
  FOR EACH ROW EXECUTE FUNCTION public.despesas_repasse_benef_limite_check();

-- Super admin sempre com nível 'delete', ignorando linhas explícitas
CREATE OR REPLACE FUNCTION public.despesas_nivel_aba(_user_id uuid, _aba text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'super_admin'::app_role) THEN 'delete'
    ELSE COALESCE(
      (SELECT nivel FROM public.despesas_aba_permissoes
        WHERE user_id = _user_id AND aba = _aba),
      CASE WHEN public.has_role(_user_id, 'admin'::app_role)
           THEN 'delete' ELSE 'sem_acesso' END
    )
  END
$$;
