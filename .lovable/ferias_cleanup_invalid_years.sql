-- =====================================================================
-- Limpeza de registros de férias com ano inválido (fora de 1990–2100)
-- + trigger de proteção contra novos lançamentos com ano absurdo.
--
-- Causa: erro de digitação em <input type="date"> permitiu salvar
-- datas como "0225-01-15" (ano 225). Esse lixo continua aparecendo
-- na aba do Contador e nos períodos aquisitivos da colaboradora.
--
-- Como aplicar:
--   1) Abra o SQL Editor do Supabase (link enviado no chat).
--   2) Cole TODO este arquivo e execute.
--   3) Confira as NOTICEs no console — elas listam o que foi apagado.
-- =====================================================================

BEGIN;

-- 1) Diagnóstico: lista os registros que serão removidos
DO $$
DECLARE
  r RECORD;
  total INTEGER := 0;
BEGIN
  FOR r IN
    SELECT f.id,
           c.nome AS colaborador,
           f.quinzena1_inicio,
           f.quinzena2_inicio,
           f.periodo_aquisitivo_inicio,
           f.periodo_aquisitivo_fim
    FROM ferias_ferias f
    LEFT JOIN ferias_colaboradores c ON c.id = f.colaborador_id
    WHERE EXTRACT(YEAR FROM f.quinzena1_inicio)              NOT BETWEEN 1990 AND 2100
       OR (f.quinzena2_inicio          IS NOT NULL AND EXTRACT(YEAR FROM f.quinzena2_inicio)          NOT BETWEEN 1990 AND 2100)
       OR (f.periodo_aquisitivo_inicio IS NOT NULL AND EXTRACT(YEAR FROM f.periodo_aquisitivo_inicio) NOT BETWEEN 1990 AND 2100)
       OR (f.periodo_aquisitivo_fim    IS NOT NULL AND EXTRACT(YEAR FROM f.periodo_aquisitivo_fim)    NOT BETWEEN 1990 AND 2100)
  LOOP
    total := total + 1;
    RAISE NOTICE 'Removendo férias %: % | q1=% q2=% paq=%..%',
      r.id, r.colaborador, r.quinzena1_inicio, r.quinzena2_inicio,
      r.periodo_aquisitivo_inicio, r.periodo_aquisitivo_fim;
  END LOOP;
  RAISE NOTICE 'Total de registros a remover: %', total;
END $$;

-- 2) Apaga dependências (gozo, quitações) e o próprio registro
DELETE FROM ferias_gozo_periodos
WHERE ferias_id IN (
  SELECT id FROM ferias_ferias
  WHERE EXTRACT(YEAR FROM quinzena1_inicio)              NOT BETWEEN 1990 AND 2100
     OR (quinzena2_inicio          IS NOT NULL AND EXTRACT(YEAR FROM quinzena2_inicio)          NOT BETWEEN 1990 AND 2100)
     OR (periodo_aquisitivo_inicio IS NOT NULL AND EXTRACT(YEAR FROM periodo_aquisitivo_inicio) NOT BETWEEN 1990 AND 2100)
     OR (periodo_aquisitivo_fim    IS NOT NULL AND EXTRACT(YEAR FROM periodo_aquisitivo_fim)    NOT BETWEEN 1990 AND 2100)
);

DELETE FROM ferias_ferias
WHERE EXTRACT(YEAR FROM quinzena1_inicio)              NOT BETWEEN 1990 AND 2100
   OR (quinzena2_inicio          IS NOT NULL AND EXTRACT(YEAR FROM quinzena2_inicio)          NOT BETWEEN 1990 AND 2100)
   OR (periodo_aquisitivo_inicio IS NOT NULL AND EXTRACT(YEAR FROM periodo_aquisitivo_inicio) NOT BETWEEN 1990 AND 2100)
   OR (periodo_aquisitivo_fim    IS NOT NULL AND EXTRACT(YEAR FROM periodo_aquisitivo_fim)    NOT BETWEEN 1990 AND 2100);

-- 3) Trigger de proteção: bloqueia inserts/updates futuros com ano fora do range
CREATE OR REPLACE FUNCTION public.ferias_ferias_validate_years()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXTRACT(YEAR FROM NEW.quinzena1_inicio) NOT BETWEEN 1990 AND 2100 THEN
    RAISE EXCEPTION 'quinzena1_inicio com ano inválido (%). Use entre 1990 e 2100.',
      EXTRACT(YEAR FROM NEW.quinzena1_inicio);
  END IF;
  IF NEW.quinzena2_inicio IS NOT NULL
     AND EXTRACT(YEAR FROM NEW.quinzena2_inicio) NOT BETWEEN 1990 AND 2100 THEN
    RAISE EXCEPTION 'quinzena2_inicio com ano inválido (%). Use entre 1990 e 2100.',
      EXTRACT(YEAR FROM NEW.quinzena2_inicio);
  END IF;
  IF NEW.periodo_aquisitivo_inicio IS NOT NULL
     AND EXTRACT(YEAR FROM NEW.periodo_aquisitivo_inicio) NOT BETWEEN 1990 AND 2100 THEN
    RAISE EXCEPTION 'periodo_aquisitivo_inicio com ano inválido (%). Use entre 1990 e 2100.',
      EXTRACT(YEAR FROM NEW.periodo_aquisitivo_inicio);
  END IF;
  IF NEW.periodo_aquisitivo_fim IS NOT NULL
     AND EXTRACT(YEAR FROM NEW.periodo_aquisitivo_fim) NOT BETWEEN 1990 AND 2100 THEN
    RAISE EXCEPTION 'periodo_aquisitivo_fim com ano inválido (%). Use entre 1990 e 2100.',
      EXTRACT(YEAR FROM NEW.periodo_aquisitivo_fim);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ferias_ferias_validate_years ON public.ferias_ferias;
CREATE TRIGGER trg_ferias_ferias_validate_years
BEFORE INSERT OR UPDATE ON public.ferias_ferias
FOR EACH ROW EXECUTE FUNCTION public.ferias_ferias_validate_years();

COMMIT;