-- Histórico de vínculos (admissão/demissão) dos colaboradores do módulo Férias

CREATE TABLE IF NOT EXISTS public.ferias_colaborador_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  data_admissao date NOT NULL,
  data_demissao date,
  tipo_desligamento text,
  motivo text,
  observacao text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ferias_vinculos_colab
  ON public.ferias_colaborador_vinculos(colaborador_id, data_admissao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_colaborador_vinculos TO authenticated;
GRANT ALL ON public.ferias_colaborador_vinculos TO service_role;

ALTER TABLE public.ferias_colaborador_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vinculos_select" ON public.ferias_colaborador_vinculos;
CREATE POLICY "vinculos_select" ON public.ferias_colaborador_vinculos
  FOR SELECT TO authenticated
  USING (can_view_system(auth.uid(), 'ferias') OR is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "vinculos_insert" ON public.ferias_colaborador_vinculos;
CREATE POLICY "vinculos_insert" ON public.ferias_colaborador_vinculos
  FOR INSERT TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "vinculos_update" ON public.ferias_colaborador_vinculos;
CREATE POLICY "vinculos_update" ON public.ferias_colaborador_vinculos
  FOR UPDATE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'))
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

DROP POLICY IF EXISTS "vinculos_delete" ON public.ferias_colaborador_vinculos;
CREATE POLICY "vinculos_delete" ON public.ferias_colaborador_vinculos
  FOR DELETE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'));

ALTER TABLE public.ferias_colaboradores
  ADD COLUMN IF NOT EXISTS motivo_inativacao text,
  ADD COLUMN IF NOT EXISTS data_demissao date,
  ADD COLUMN IF NOT EXISTS observacao_inativacao text;

-- Validações (trigger, não CHECK)
CREATE OR REPLACE FUNCTION public.ferias_vinculo_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflito int;
BEGIN
  IF NEW.data_demissao IS NOT NULL AND NEW.data_demissao < NEW.data_admissao THEN
    RAISE EXCEPTION 'A data de demissão não pode ser anterior à data de admissão do vínculo.';
  END IF;

  SELECT count(*) INTO v_conflito
  FROM public.ferias_colaborador_vinculos v
  WHERE v.colaborador_id = NEW.colaborador_id
    AND v.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND daterange(v.data_admissao, COALESCE(v.data_demissao, 'infinity'::date), '[]')
        && daterange(NEW.data_admissao, COALESCE(NEW.data_demissao, 'infinity'::date), '[]');

  IF v_conflito > 0 THEN
    RAISE EXCEPTION 'Já existe um vínculo neste período para este colaborador.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ferias_vinculo_validate ON public.ferias_colaborador_vinculos;
CREATE TRIGGER trg_ferias_vinculo_validate
  BEFORE INSERT OR UPDATE ON public.ferias_colaborador_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.ferias_vinculo_validate();

-- Sincroniza os campos denormalizados no colaborador (vínculo mais recente)
CREATE OR REPLACE FUNCTION public.ferias_vinculo_sync_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colab uuid := COALESCE(NEW.colaborador_id, OLD.colaborador_id);
  v_adm date;
  v_dem date;
BEGIN
  SELECT data_admissao, data_demissao INTO v_adm, v_dem
  FROM public.ferias_colaborador_vinculos
  WHERE colaborador_id = v_colab
  ORDER BY data_admissao DESC
  LIMIT 1;

  IF v_adm IS NOT NULL THEN
    UPDATE public.ferias_colaboradores
    SET data_admissao = v_adm,
        data_demissao = v_dem
    WHERE id = v_colab;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ferias_vinculo_sync ON public.ferias_colaborador_vinculos;
CREATE TRIGGER trg_ferias_vinculo_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_colaborador_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.ferias_vinculo_sync_colaborador();

-- Backfill: um vínculo aberto por colaborador existente
INSERT INTO public.ferias_colaborador_vinculos (colaborador_id, data_admissao)
SELECT c.id, c.data_admissao
FROM public.ferias_colaboradores c
WHERE c.data_admissao IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ferias_colaborador_vinculos v WHERE v.colaborador_id = c.id
  );
