
-- Tabela de créditos de folga e férias
CREATE TABLE public.ferias_folgas_creditos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id uuid NOT NULL REFERENCES public.ferias_colaboradores(id),
  tipo text NOT NULL CHECK (tipo IN ('folga', 'ferias')),
  origem_data date NOT NULL,
  dias integer NOT NULL DEFAULT 1,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'utilizado', 'pago')),
  utilizado_em date,
  utilizado_referencia text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ferias_folgas_creditos ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Authenticated users can manage credits"
  ON public.ferias_folgas_creditos FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
