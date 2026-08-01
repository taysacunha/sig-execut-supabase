-- =====================================================================
-- Repasses / Beneficiários:
--  * marcar se o beneficiário é o proprietário da conta
--  * permitir vários repasses (pagamentos) por beneficiário na mesma
--    competência, em datas diferentes e por imóvel de origem
-- O valor do beneficiário no mês passa a ser a SOMA dos pagamentos.
-- =====================================================================

ALTER TABLE public.despesas_repasse_beneficiarios
  ADD COLUMN IF NOT EXISTS is_proprietario boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.despesas_repasse_benef_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_id uuid NOT NULL
    REFERENCES public.despesas_repasse_beneficiarios(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  imovel_id uuid REFERENCES public.despesas_imoveis(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_repasse_benef_pagamentos TO authenticated;
GRANT ALL ON public.despesas_repasse_benef_pagamentos TO service_role;

ALTER TABLE public.despesas_repasse_benef_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_desp_rep_benef_pag_benef
  ON public.despesas_repasse_benef_pagamentos(beneficiario_id);

-- Um pagamento por (beneficiário, data, imóvel)
CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_rep_benef_pag
  ON public.despesas_repasse_benef_pagamentos (
    beneficiario_id, data,
    COALESCE(imovel_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

DROP POLICY IF EXISTS "desp_rep_benef_pag_select" ON public.despesas_repasse_benef_pagamentos;
CREATE POLICY "desp_rep_benef_pag_select" ON public.despesas_repasse_benef_pagamentos
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasse_beneficiarios b
    JOIN public.despesas_repasses r ON r.id = b.repasse_id
    WHERE b.id = beneficiario_id
      AND public.despesas_pode_ver_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

DROP POLICY IF EXISTS "desp_rep_benef_pag_insert" ON public.despesas_repasse_benef_pagamentos;
CREATE POLICY "desp_rep_benef_pag_insert" ON public.despesas_repasse_benef_pagamentos
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasse_beneficiarios b
    JOIN public.despesas_repasses r ON r.id = b.repasse_id
    WHERE b.id = beneficiario_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

DROP POLICY IF EXISTS "desp_rep_benef_pag_update" ON public.despesas_repasse_benef_pagamentos;
CREATE POLICY "desp_rep_benef_pag_update" ON public.despesas_repasse_benef_pagamentos
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasse_beneficiarios b
    JOIN public.despesas_repasses r ON r.id = b.repasse_id
    WHERE b.id = beneficiario_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasse_beneficiarios b
    JOIN public.despesas_repasses r ON r.id = b.repasse_id
    WHERE b.id = beneficiario_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

DROP POLICY IF EXISTS "desp_rep_benef_pag_delete" ON public.despesas_repasse_benef_pagamentos;
CREATE POLICY "desp_rep_benef_pag_delete" ON public.despesas_repasse_benef_pagamentos
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasse_beneficiarios b
    JOIN public.despesas_repasses r ON r.id = b.repasse_id
    WHERE b.id = beneficiario_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

-- Recalcula o valor do beneficiário como a soma dos seus pagamentos
CREATE OR REPLACE FUNCTION public.despesas_repasse_benef_pag_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_benef uuid;
  v_total numeric(14,2);
BEGIN
  v_benef := COALESCE(NEW.beneficiario_id, OLD.beneficiario_id);
  SELECT COALESCE(SUM(valor), 0) INTO v_total
    FROM public.despesas_repasse_benef_pagamentos
   WHERE beneficiario_id = v_benef;

  UPDATE public.despesas_repasse_beneficiarios
     SET valor = v_total,
         updated_at = now()
   WHERE id = v_benef;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_rep_benef_pag_sync ON public.despesas_repasse_benef_pagamentos;
CREATE TRIGGER trg_desp_rep_benef_pag_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.despesas_repasse_benef_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.despesas_repasse_benef_pag_sync();

DROP TRIGGER IF EXISTS trg_desp_rep_benef_pag_updated ON public.despesas_repasse_benef_pagamentos;
CREATE TRIGGER trg_desp_rep_benef_pag_updated
  BEFORE UPDATE ON public.despesas_repasse_benef_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Migra valores já existentes para o novo modelo (um pagamento por beneficiário)
INSERT INTO public.despesas_repasse_benef_pagamentos (beneficiario_id, data, valor, observacao)
SELECT b.id,
       COALESCE(b.data_recebimento, r.competencia),
       b.valor,
       'Migrado do valor único da competência'
  FROM public.despesas_repasse_beneficiarios b
  JOIN public.despesas_repasses r ON r.id = b.repasse_id
 WHERE b.valor > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.despesas_repasse_benef_pagamentos p
      WHERE p.beneficiario_id = b.id
   );
