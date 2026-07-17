-- ==========================================================
-- DESPESAS - FASE 1: Fundação, permissões, cadastros auxiliares
-- Rode este SQL no Supabase SQL Editor.
-- ==========================================================

-- ---------- Permissões por aba ----------
CREATE TABLE IF NOT EXISTS public.despesas_aba_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aba text NOT NULL CHECK (aba IN ('calendario','imoveis','repasses','cadastros')),
  nivel text NOT NULL DEFAULT 'sem_acesso' CHECK (nivel IN ('sem_acesso','view','edit','delete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, aba)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_aba_permissoes TO authenticated;
GRANT ALL ON public.despesas_aba_permissoes TO service_role;
ALTER TABLE public.despesas_aba_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_aba_perm_admin_all"
  ON public.despesas_aba_permissoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "despesas_aba_perm_read_own"
  ON public.despesas_aba_permissoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.despesas_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS despesas_centros_custo_nome_unique
  ON public.despesas_centros_custo (lower(nome)) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_centros_custo TO authenticated;
GRANT ALL ON public.despesas_centros_custo TO service_role;

CREATE TABLE IF NOT EXISTS public.despesas_centros_custo_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  centro_custo_id uuid NOT NULL REFERENCES public.despesas_centros_custo(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, centro_custo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_centros_custo_permissoes TO authenticated;
GRANT ALL ON public.despesas_centros_custo_permissoes TO service_role;
ALTER TABLE public.despesas_centros_custo_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_cc_perm_admin_all"
  ON public.despesas_centros_custo_permissoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "despesas_cc_perm_read_own"
  ON public.despesas_centros_custo_permissoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------- Helpers de nível ----------
CREATE OR REPLACE FUNCTION public.despesas_nivel_aba(_user_id uuid, _aba text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT nivel FROM public.despesas_aba_permissoes WHERE user_id = _user_id AND aba = _aba),
    CASE WHEN public.has_role(_user_id, 'super_admin'::app_role) OR public.has_role(_user_id, 'admin'::app_role)
         THEN 'delete' ELSE 'sem_acesso' END
  )
$$;

CREATE OR REPLACE FUNCTION public.despesas_pode_ver_aba(_user_id uuid, _aba text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.despesas_nivel_aba(_user_id, _aba) IN ('view','edit','delete') $$;

CREATE OR REPLACE FUNCTION public.despesas_pode_editar_aba(_user_id uuid, _aba text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.despesas_nivel_aba(_user_id, _aba) IN ('edit','delete') $$;

CREATE OR REPLACE FUNCTION public.despesas_pode_excluir_aba(_user_id uuid, _aba text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.despesas_nivel_aba(_user_id, _aba) = 'delete' $$;

CREATE OR REPLACE FUNCTION public.despesas_centros_permitidos(_user_id uuid)
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.despesas_centros_custo_permissoes WHERE user_id = _user_id;
  IF v_count = 0 THEN
    RETURN QUERY SELECT id FROM public.despesas_centros_custo WHERE is_active = true;
  ELSE
    RETURN QUERY SELECT centro_custo_id FROM public.despesas_centros_custo_permissoes WHERE user_id = _user_id;
  END IF;
END; $$;

-- ---------- RLS dos cadastros ----------
ALTER TABLE public.despesas_centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_cc_view" ON public.despesas_centros_custo FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'calendario'));
CREATE POLICY "despesas_cc_edit" ON public.despesas_centros_custo FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

CREATE TABLE IF NOT EXISTS public.despesas_planos_conta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'pagar' CHECK (tipo IN ('pagar','receber','ambos')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_planos_conta TO authenticated;
GRANT ALL ON public.despesas_planos_conta TO service_role;
ALTER TABLE public.despesas_planos_conta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_plano_view" ON public.despesas_planos_conta FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'calendario'));
CREATE POLICY "despesas_plano_edit" ON public.despesas_planos_conta FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

CREATE TABLE IF NOT EXISTS public.despesas_subcategorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_conta_id uuid NOT NULL REFERENCES public.despesas_planos_conta(id) ON DELETE CASCADE,
  nome text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_subcategorias TO authenticated;
GRANT ALL ON public.despesas_subcategorias TO service_role;
ALTER TABLE public.despesas_subcategorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_sub_view" ON public.despesas_subcategorias FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'calendario'));
CREATE POLICY "despesas_sub_edit" ON public.despesas_subcategorias FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

CREATE TABLE IF NOT EXISTS public.despesas_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'ambos' CHECK (tipo IN ('credito','debito','ambos')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS despesas_categorias_nome_unique
  ON public.despesas_categorias (lower(nome)) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_categorias TO authenticated;
GRANT ALL ON public.despesas_categorias TO service_role;
ALTER TABLE public.despesas_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_cat_view" ON public.despesas_categorias FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'calendario') OR public.despesas_pode_ver_aba(auth.uid(),'repasses'));
CREATE POLICY "despesas_cat_edit" ON public.despesas_categorias FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

CREATE TABLE IF NOT EXISTS public.despesas_contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  banco text,
  agencia text,
  numero_conta text,
  centro_custo_id uuid REFERENCES public.despesas_centros_custo(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_contas_bancarias TO authenticated;
GRANT ALL ON public.despesas_contas_bancarias TO service_role;
ALTER TABLE public.despesas_contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_conta_view" ON public.despesas_contas_bancarias FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'calendario'));
CREATE POLICY "despesas_conta_edit" ON public.despesas_contas_bancarias FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

CREATE TABLE IF NOT EXISTS public.despesas_perfis_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_perfis_acesso TO authenticated;
GRANT ALL ON public.despesas_perfis_acesso TO service_role;
ALTER TABLE public.despesas_perfis_acesso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_perfil_view" ON public.despesas_perfis_acesso FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'calendario'));
CREATE POLICY "despesas_perfil_edit" ON public.despesas_perfis_acesso FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

CREATE TABLE IF NOT EXISTS public.despesas_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_pessoa text NOT NULL DEFAULT 'fisica' CHECK (tipo_pessoa IN ('fisica','juridica')),
  cpf_cnpj text,
  oab text,
  creci text,
  papeis text[] NOT NULL DEFAULT '{}',
  email text,
  telefone text,
  observacao text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_pessoas TO authenticated;
GRANT ALL ON public.despesas_pessoas TO service_role;
ALTER TABLE public.despesas_pessoas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_pessoa_view" ON public.despesas_pessoas FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros') OR public.despesas_pode_ver_aba(auth.uid(),'calendario') OR public.despesas_pode_ver_aba(auth.uid(),'repasses') OR public.despesas_pode_ver_aba(auth.uid(),'imoveis'));
CREATE POLICY "despesas_pessoa_edit" ON public.despesas_pessoas FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

CREATE TABLE IF NOT EXISTS public.despesas_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo text NOT NULL,
  placa text,
  data_aquisicao date,
  nota_fiscal text,
  motorista_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  proprietario_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  data_venda date,
  comprador_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  observacao text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_veiculos TO authenticated;
GRANT ALL ON public.despesas_veiculos TO service_role;
ALTER TABLE public.despesas_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_veic_view" ON public.despesas_veiculos FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(),'cadastros'));
CREATE POLICY "despesas_veic_edit" ON public.despesas_veiculos FOR ALL TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(),'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(),'cadastros'));

-- Triggers de updated_at
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'despesas_aba_permissoes','despesas_centros_custo','despesas_planos_conta',
    'despesas_subcategorias','despesas_categorias','despesas_contas_bancarias',
    'despesas_perfis_acesso','despesas_pessoas','despesas_veiculos'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I; CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t,t,t,t);
  END LOOP;
END $$;

-- Ampliar audit_module_changes para reconhecer despesas_*
CREATE OR REPLACE FUNCTION public.audit_module_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_module_name text; v_old_data jsonb; v_new_data jsonb;
  v_changed_fields text[]; v_user_id uuid; v_user_email text;
BEGIN
  IF TG_TABLE_NAME LIKE 'despesas_%' THEN v_module_name := 'despesas';
  ELSIF TG_TABLE_NAME LIKE 'ferias_%' THEN v_module_name := 'ferias';
  ELSIF TG_TABLE_NAME LIKE 'estoque_%' THEN v_module_name := 'estoque';
  ELSIF TG_TABLE_NAME IN ('sales','sales_brokers','sales_teams','broker_evaluations','monthly_leads','proposals','sale_partners') THEN v_module_name := 'vendas';
  ELSIF TG_TABLE_NAME IN ('brokers','locations','schedule_assignments','generated_schedules','location_period_configs','saturday_queue','location_rotation_queues') THEN v_module_name := 'escalas';
  ELSE v_module_name := 'sistema';
  END IF;
  BEGIN v_user_id := auth.uid(); EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;
  BEGIN SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN v_user_email := NULL; END;
  IF TG_OP = 'DELETE' THEN v_old_data := to_jsonb(OLD); v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN v_old_data := NULL; v_new_data := to_jsonb(NEW);
  ELSE
    v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW);
    SELECT array_agg(key) INTO v_changed_fields FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM value AND key NOT IN ('updated_at','created_at');
    IF v_changed_fields IS NULL OR array_length(v_changed_fields,1) IS NULL THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.module_audit_logs (module_name, table_name, record_id, action, old_data, new_data, changed_fields, changed_by, changed_by_email)
  VALUES (v_module_name, TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP='DELETE' THEN (OLD).id ELSE (NEW).id END)::text, ''),
    TG_OP, v_old_data, v_new_data, v_changed_fields, v_user_id, v_user_email);
  RETURN COALESCE(NEW, OLD);
END; $function$;

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'despesas_centros_custo','despesas_planos_conta','despesas_subcategorias',
    'despesas_categorias','despesas_contas_bancarias','despesas_perfis_acesso',
    'despesas_pessoas','despesas_veiculos','despesas_aba_permissoes',
    'despesas_centros_custo_permissoes'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_changes ON public.%I; CREATE TRIGGER audit_%I_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();', t,t,t,t);
  END LOOP;
END $$;

-- Adicione 'despesas' ao system_access para usuários que devem enxergar o módulo:
-- INSERT INTO public.system_access (user_id, system_name, permission_type)
-- VALUES ('<uuid>', 'despesas', 'view_edit');