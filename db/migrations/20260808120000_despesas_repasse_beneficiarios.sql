-- Beneficiários do repasse: quem efetivamente recebe o valor líquido.
-- Uma pessoa (PF/PJ, papel livre) por linha, com valor destinado.
-- Regras: soma dos beneficiários <= valor_liquido do repasse.
--         Alterações bloqueadas quando status IN ('pago','cancelado').

CREATE TABLE IF NOT EXISTS public.despesas_repasse_beneficiarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repasse_id uuid NOT NULL REFERENCES public.despesas_repasses(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.despesas_pessoas(id) ON DELETE RESTRICT,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  ordem int NOT NULL DEFAULT 1,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repasse_id, pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_desp_rep_benef_repasse
  ON public.despesas_repasse_beneficiarios(repasse_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_repasse_beneficiarios TO authenticated;
GRANT ALL ON public.despesas_repasse_beneficiarios TO service_role;

ALTER TABLE public.despesas_repasse_beneficiarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_rep_benef_select" ON public.despesas_repasse_beneficiarios
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_ver_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

CREATE POLICY "desp_rep_benef_insert" ON public.despesas_repasse_beneficiarios
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

CREATE POLICY "desp_rep_benef_update" ON public.despesas_repasse_beneficiarios
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

CREATE POLICY "desp_rep_benef_delete" ON public.despesas_repasse_beneficiarios
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

-- Validação: soma <= líquido e status editável
CREATE OR REPLACE FUNCTION public.despesas_repasse_benef_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_liquido numeric(14,2);
  v_soma numeric(14,2);
  v_repasse uuid;
BEGIN
  v_repasse := COALESCE(NEW.repasse_id, OLD.repasse_id);
  SELECT status, valor_liquido INTO v_status, v_liquido
    FROM public.despesas_repasses WHERE id = v_repasse;
  IF v_status IN ('pago','cancelado') THEN
    RAISE EXCEPTION 'Repasse já % — beneficiários não podem ser alterados.', v_status;
  END IF;

  SELECT COALESCE(SUM(valor),0) INTO v_soma
    FROM public.despesas_repasse_beneficiarios
   WHERE repasse_id = v_repasse
     AND (TG_OP <> 'UPDATE' OR id <> NEW.id)
     AND (TG_OP <> 'DELETE' OR id <> OLD.id);

  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_soma := v_soma + COALESCE(NEW.valor, 0);
  END IF;

  IF v_soma > COALESCE(v_liquido, 0) THEN
    RAISE EXCEPTION 'Soma dos beneficiários (R$ %) excede o valor líquido do repasse (R$ %).',
      v_soma, v_liquido;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_rep_benef_validate ON public.despesas_repasse_beneficiarios;
CREATE TRIGGER trg_desp_rep_benef_validate
  BEFORE INSERT OR UPDATE OR DELETE ON public.despesas_repasse_beneficiarios
  FOR EACH ROW EXECUTE FUNCTION public.despesas_repasse_benef_validate();

-- Auditoria
DROP TRIGGER IF EXISTS trg_despesas_repasse_beneficiarios_audit
  ON public.despesas_repasse_beneficiarios;
CREATE TRIGGER trg_despesas_repasse_beneficiarios_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.despesas_repasse_beneficiarios
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();
