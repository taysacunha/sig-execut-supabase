-- Índices não únicos para acelerar detecção de duplicidade de imóveis.
-- Duplicidade é apenas alerta na aplicação; imóveis em construção podem
-- ficar sem código/inscrição municipal (NULL não entra no índice parcial).
CREATE INDEX IF NOT EXISTS idx_desp_imoveis_codigo_lower
  ON public.despesas_imoveis (lower(codigo))
  WHERE codigo IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_desp_imoveis_insc_mun_lower
  ON public.despesas_imoveis (lower(inscricao_municipal))
  WHERE inscricao_municipal IS NOT NULL AND is_active = true;