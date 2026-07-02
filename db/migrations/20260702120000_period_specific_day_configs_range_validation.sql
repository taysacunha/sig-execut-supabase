-- ============================================================================
-- Correção: period_specific_day_configs com specific_date fora do intervalo
-- do próprio período (bug descoberto no Nammos, período de julho/2026).
--
-- 1) Limpa linhas órfãs (specific_date fora de [start_date, end_date])
-- 2) Cria trigger BEFORE INSERT/UPDATE que rejeita novos vazamentos
-- 3) Cria trigger AFTER UPDATE em location_periods que rejeita reduzir o
--    intervalo deixando configs específicas fora dele
--
-- Executar no SQL Editor. Não usa CHECK constraint porque a validação
-- depende de outra tabela.
-- ============================================================================

-- 1. VARREDURA (opcional, apenas para conferência antes do delete)
--    SELECT sc.period_id, l.name, lp.start_date, lp.end_date, count(*)
--    FROM public.period_specific_day_configs sc
--    JOIN public.location_periods lp ON lp.id = sc.period_id
--    JOIN public.locations l ON l.id = lp.location_id
--    WHERE sc.specific_date < lp.start_date OR sc.specific_date > lp.end_date
--    GROUP BY sc.period_id, l.name, lp.start_date, lp.end_date;

-- 2. CLEANUP: remove todas as configs específicas fora do intervalo do período
DELETE FROM public.period_specific_day_configs sc
USING public.location_periods lp
WHERE sc.period_id = lp.id
  AND (sc.specific_date < lp.start_date OR sc.specific_date > lp.end_date);

-- 3. TRIGGER: rejeitar novas linhas com specific_date fora do intervalo
CREATE OR REPLACE FUNCTION public.enforce_specific_date_within_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end   date;
BEGIN
  SELECT start_date, end_date INTO v_start, v_end
  FROM public.location_periods
  WHERE id = NEW.period_id;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Período % não encontrado', NEW.period_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.specific_date < v_start OR NEW.specific_date > v_end THEN
    RAISE EXCEPTION
      'Data % está fora do intervalo do período (% a %)',
      NEW.specific_date, v_start, v_end
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_specific_date_within_period
  ON public.period_specific_day_configs;

CREATE TRIGGER trg_specific_date_within_period
BEFORE INSERT OR UPDATE OF specific_date, period_id
ON public.period_specific_day_configs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_specific_date_within_period();

-- 4. TRIGGER: ao alterar start_date/end_date de um período, rejeitar se
--    sobrarem configs específicas fora do novo intervalo
CREATE OR REPLACE FUNCTION public.enforce_period_range_covers_configs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orphans int;
BEGIN
  IF NEW.start_date = OLD.start_date AND NEW.end_date = OLD.end_date THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_orphans
  FROM public.period_specific_day_configs
  WHERE period_id = NEW.id
    AND (specific_date < NEW.start_date OR specific_date > NEW.end_date);

  IF v_orphans > 0 THEN
    RAISE EXCEPTION
      'Não é possível alterar o intervalo: existem % configuração(ões) específica(s) fora do novo intervalo (% a %). Remova-as primeiro.',
      v_orphans, NEW.start_date, NEW.end_date
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_period_range_covers_configs
  ON public.location_periods;

CREATE TRIGGER trg_period_range_covers_configs
BEFORE UPDATE OF start_date, end_date
ON public.location_periods
FOR EACH ROW
EXECUTE FUNCTION public.enforce_period_range_covers_configs();