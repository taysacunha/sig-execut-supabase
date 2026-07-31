-- =====================================================================
-- Limite anual do beneficiário: registrar em qual competência o limite
-- foi definido, por quem e quando (para exibição no diálogo de repasse).
-- =====================================================================

ALTER TABLE public.despesas_repasse_benef_limite_anual
  ADD COLUMN IF NOT EXISTS competencia_origem date,
  ADD COLUMN IF NOT EXISTS definido_por uuid,
  ADD COLUMN IF NOT EXISTS definido_por_nome text,
  ADD COLUMN IF NOT EXISTS definido_em timestamptz NOT NULL DEFAULT now();
