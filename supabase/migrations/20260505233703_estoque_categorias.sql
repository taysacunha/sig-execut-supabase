CREATE TABLE IF NOT EXISTS public.estoque_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS estoque_categorias_nome_unique
  ON public.estoque_categorias (lower(nome)) WHERE is_active = true;

ALTER TABLE public.estoque_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estoque: leitura categorias por quem pode ver"
  ON public.estoque_categorias FOR SELECT TO authenticated
  USING (public.can_view_system(auth.uid(), 'estoque'));

CREATE POLICY "Estoque: escrita categorias por quem pode editar"
  ON public.estoque_categorias FOR ALL TO authenticated
  USING (public.can_edit_system(auth.uid(), 'estoque'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

CREATE TRIGGER estoque_categorias_updated_at
  BEFORE UPDATE ON public.estoque_categorias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER estoque_categorias_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_categorias
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

ALTER TABLE public.estoque_materiais
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.estoque_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS estoque_materiais_categoria_id_idx
  ON public.estoque_materiais (categoria_id);
