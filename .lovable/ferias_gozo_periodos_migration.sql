-- Migration: Create ferias_gozo_periodos table and add columns to ferias_ferias
-- This supports flexible distribution of vacation gozo periods (N sub-periods)

-- 1. New table for flexible gozo periods
CREATE TABLE IF NOT EXISTS public.ferias_gozo_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferias_id uuid NOT NULL REFERENCES public.ferias_ferias(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'venda' or 'gozo_diferente'
  referencia_periodo integer, -- 1 or 2 (which official period this refers to)
  numero integer NOT NULL DEFAULT 1, -- sequential order
  dias integer NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.ferias_gozo_periodos ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies (same as ferias_ferias)
CREATE POLICY "ferias_gozo_periodos_select" ON public.ferias_gozo_periodos
  FOR SELECT TO authenticated
  USING (can_view_system(auth.uid(), 'ferias'));

CREATE POLICY "ferias_gozo_periodos_insert" ON public.ferias_gozo_periodos
  FOR INSERT TO authenticated
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

CREATE POLICY "ferias_gozo_periodos_update" ON public.ferias_gozo_periodos
  FOR UPDATE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'));

CREATE POLICY "ferias_gozo_periodos_delete" ON public.ferias_gozo_periodos
  FOR DELETE TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'));

-- 4. New columns on ferias_ferias
ALTER TABLE public.ferias_ferias ADD COLUMN IF NOT EXISTS gozo_flexivel boolean DEFAULT false;
ALTER TABLE public.ferias_ferias ADD COLUMN IF NOT EXISTS distribuicao_tipo text;

-- 5. Index for performance
CREATE INDEX IF NOT EXISTS idx_ferias_gozo_periodos_ferias_id ON public.ferias_gozo_periodos(ferias_id);
