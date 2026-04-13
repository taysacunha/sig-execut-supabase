-- Migration: Create ferias_afastamentos table
-- Tracks employee leave periods (medical, maternity, etc.)

CREATE TABLE IF NOT EXISTS public.ferias_afastamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE NOT NULL,
  motivo text NOT NULL CHECK (motivo IN ('acidente', 'doenca', 'licenca_maternidade', 'licenca_paternidade', 'licenca_medica', 'outros')),
  motivo_descricao text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT data_fim_after_inicio CHECK (data_fim >= data_inicio)
);

ALTER TABLE public.ferias_afastamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read afastamentos"
  ON public.ferias_afastamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert afastamentos"
  ON public.ferias_afastamentos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update afastamentos"
  ON public.ferias_afastamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete afastamentos"
  ON public.ferias_afastamentos FOR DELETE TO authenticated USING (true);
