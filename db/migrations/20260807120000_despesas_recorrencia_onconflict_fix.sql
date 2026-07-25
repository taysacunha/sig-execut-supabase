-- =====================================================================
-- Fix: ON CONFLICT em despesas_gerar_ocorrencias falhava com
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" porque o índice único original era PARCIAL
-- (WHERE serie_recorrencia_id IS NOT NULL) e a cláusula ON CONFLICT
-- da função não repete o predicado. Recriamos o índice sem o WHERE.
-- NULLs continuam distintos (comportamento padrão), então lançamentos
-- manuais sem série não conflitam entre si.
-- =====================================================================

DROP INDEX IF EXISTS public.uq_desp_lanc_serie_venc;

CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_lanc_serie_venc
  ON public.despesas_lancamentos(serie_recorrencia_id, data_vencimento);