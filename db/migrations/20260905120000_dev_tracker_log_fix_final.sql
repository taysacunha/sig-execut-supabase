-- Correção final do histórico de desenvolvimento (/dev)
-- Executar no SQL Editor do Supabase.
-- Total esperado após a correção: 577h (manuais) + 1195h (acervo) - 86h (duplicadas) = 1686h
-- Transacional e idempotente: se o total não fechar, nada é gravado.

BEGIN;

-- 1. Remove as cópias importadas que repetem um lançamento manual
DELETE FROM public.dev_tracker_log l
WHERE l.source = 'legacy_item'
  AND EXISTS (
    SELECT 1 FROM public.dev_tracker_log m
    WHERE m.source = 'manual'
      AND m.system_name = l.system_name
      AND m.title = l.title
  );

-- 2. Devolve as horas cheias do acervo às atividades importadas
UPDATE public.dev_tracker_log l
SET hours = d.hours,
    description = regexp_replace(
      COALESCE(l.description, ''),
      ' \((item preservado sem horas adicionais na reconciliacao|saldo parcial do acervo legado)\)$',
      ''
    )
FROM public.dev_tracker d
WHERE l.source = 'legacy_item'
  AND l.legacy_key = 'dev_tracker:' || d.id::text
  AND l.hours IS DISTINCT FROM d.hours;

-- 3. Validação
DO $$
DECLARE t numeric; z int;
BEGIN
  SELECT COALESCE(SUM(hours),0), COUNT(*) FILTER (WHERE COALESCE(hours,0) <= 0)
    INTO t, z FROM public.dev_tracker_log;
  IF z > 0 THEN
    RAISE EXCEPTION 'Ainda existem % atividades com 0h. Nada foi gravado.', z;
  END IF;
  IF t <> 1686 THEN
    RAISE EXCEPTION 'Total ficou em % h, esperado 1686 h. Nada foi gravado.', t;
  END IF;
  RAISE NOTICE 'Historico corrigido: % h, sem atividades zeradas.', t;
END $$;

COMMIT;
