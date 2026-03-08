-- =============================================
-- Migração: estoque_usuarios_unidades
-- Vincular usuários às unidades do estoque
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS public.estoque_usuarios_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unidade_id uuid REFERENCES public.ferias_unidades(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, unidade_id)
);

ALTER TABLE public.estoque_usuarios_unidades ENABLE ROW LEVEL SECURITY;

-- Admins/super_admins podem gerenciar tudo
CREATE POLICY "Admins can manage estoque_usuarios_unidades"
  ON public.estoque_usuarios_unidades
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Usuários podem ver seus próprios vínculos
CREATE POLICY "Users can view own unit links"
  ON public.estoque_usuarios_unidades
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Gestores com acesso de edição podem gerenciar
CREATE POLICY "Editors can manage estoque_usuarios_unidades"
  ON public.estoque_usuarios_unidades
  FOR ALL TO authenticated
  USING (public.can_edit_system(auth.uid(), 'estoque'))
  WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'));

-- Audit trigger
CREATE TRIGGER audit_estoque_usuarios_unidades
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_usuarios_unidades
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();
