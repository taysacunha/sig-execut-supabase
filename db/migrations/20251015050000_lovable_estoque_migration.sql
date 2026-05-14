-- =============================================
-- MÓDULO DE ESTOQUE - Migração completa
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. TABELA: estoque_locais_armazenamento
CREATE TABLE IF NOT EXISTS public.estoque_locais_armazenamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.ferias_unidades(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'deposito', -- deposito, armario, prateleira
  parent_id uuid REFERENCES public.estoque_locais_armazenamento(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. TABELA: estoque_materiais
CREATE TABLE IF NOT EXISTS public.estoque_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  unidade_medida text NOT NULL DEFAULT 'unidade',
  categoria text,
  estoque_minimo integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. TABELA: estoque_saldos
CREATE TABLE IF NOT EXISTS public.estoque_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.estoque_materiais(id) ON DELETE CASCADE NOT NULL,
  local_armazenamento_id uuid REFERENCES public.estoque_locais_armazenamento(id) ON DELETE CASCADE NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(material_id, local_armazenamento_id)
);

-- 4. TABELA: estoque_gestores
CREATE TABLE IF NOT EXISTS public.estoque_gestores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unidade_id uuid REFERENCES public.ferias_unidades(id) ON DELETE CASCADE NOT NULL,
  nome_gestor text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. TABELA: estoque_solicitacoes
CREATE TABLE IF NOT EXISTS public.estoque_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_user_id uuid NOT NULL,
  solicitante_nome text NOT NULL,
  unidade_id uuid REFERENCES public.ferias_unidades(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente', -- pendente, aprovada, separada, entregue, cancelada
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. TABELA: estoque_solicitacao_itens
CREATE TABLE IF NOT EXISTS public.estoque_solicitacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES public.estoque_solicitacoes(id) ON DELETE CASCADE NOT NULL,
  material_id uuid REFERENCES public.estoque_materiais(id) ON DELETE CASCADE NOT NULL,
  quantidade_solicitada integer NOT NULL DEFAULT 1,
  quantidade_atendida integer DEFAULT 0,
  local_armazenamento_id uuid REFERENCES public.estoque_locais_armazenamento(id) ON DELETE SET NULL
);

-- 7. TABELA: estoque_movimentacoes
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.estoque_materiais(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL, -- entrada, saida, transferencia, ajuste
  quantidade integer NOT NULL,
  local_origem_id uuid REFERENCES public.estoque_locais_armazenamento(id) ON DELETE SET NULL,
  local_destino_id uuid REFERENCES public.estoque_locais_armazenamento(id) ON DELETE SET NULL,
  solicitacao_id uuid REFERENCES public.estoque_solicitacoes(id) ON DELETE SET NULL,
  responsavel_user_id uuid,
  recebido_por_user_id uuid,
  recebido_em timestamptz,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- 8. TABELA: estoque_notificacoes
CREATE TABLE IF NOT EXISTS public.estoque_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  referencia_id uuid,
  referencia_tipo text,
  mensagem text NOT NULL,
  lida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.estoque_locais_armazenamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_gestores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_solicitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_notificacoes ENABLE ROW LEVEL SECURITY;

-- Policies para todas as tabelas de estoque (acesso autenticado com system_access)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'estoque_locais_armazenamento', 'estoque_materiais', 'estoque_saldos',
    'estoque_gestores', 'estoque_solicitacoes', 'estoque_solicitacao_itens',
    'estoque_movimentacoes', 'estoque_notificacoes'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Authenticated users with estoque access can view %1$s" ON public;
CREATE POLICY "Authenticated users with estoque access can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.has_system_access(auth.uid(), ''estoque''))',
      tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "Users with edit access can insert %1$s" ON public;
CREATE POLICY "Users with edit access can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.can_edit_system(auth.uid(), ''estoque''))',
      tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "Users with edit access can update %1$s" ON public;
CREATE POLICY "Users with edit access can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.can_edit_system(auth.uid(), ''estoque''))',
      tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "Users with edit access can delete %1$s" ON public;
CREATE POLICY "Users with edit access can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.can_edit_system(auth.uid(), ''estoque''))',
      tbl
    );
  END LOOP;
END $$;

-- Notificações: qualquer usuário pode ver/atualizar suas próprias notificações
DROP POLICY IF EXISTS "Authenticated users with estoque access can view estoque_notificacoes" ON public.estoque_notificacoes;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.estoque_notificacoes;
CREATE POLICY "Users can view own notifications" ON public.estoque_notificacoes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users with edit access can update estoque_notificacoes" ON public.estoque_notificacoes;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.estoque_notificacoes;
CREATE POLICY "Users can update own notifications" ON public.estoque_notificacoes
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Solicitações: qualquer usuário com acesso (view_only ou view_edit) pode criar
DROP POLICY IF EXISTS "Users with edit access can insert estoque_solicitacoes" ON public.estoque_solicitacoes;
DROP POLICY IF EXISTS "Any user with estoque access can create requests" ON public.estoque_solicitacoes;
CREATE POLICY "Any user with estoque access can create requests" ON public.estoque_solicitacoes
  FOR INSERT TO authenticated WITH CHECK (public.has_system_access(auth.uid(), 'estoque'));

DROP POLICY IF EXISTS "Users with edit access can insert estoque_solicitacao_itens" ON public.estoque_solicitacao_itens;
DROP POLICY IF EXISTS "Any user with estoque access can insert request items" ON public.estoque_solicitacao_itens;
CREATE POLICY "Any user with estoque access can insert request items" ON public.estoque_solicitacao_itens
  FOR INSERT TO authenticated WITH CHECK (public.has_system_access(auth.uid(), 'estoque'));

-- =============================================
-- TRIGGERS: handle_updated_at
-- =============================================

DROP TRIGGER IF EXISTS set_updated_at_estoque_locais ON public.estoque_locais_armazenamento;
CREATE TRIGGER set_updated_at_estoque_locais
  BEFORE UPDATE ON public.estoque_locais_armazenamento
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_estoque_materiais ON public.estoque_materiais;
CREATE TRIGGER set_updated_at_estoque_materiais
  BEFORE UPDATE ON public.estoque_materiais
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_estoque_saldos ON public.estoque_saldos;
CREATE TRIGGER set_updated_at_estoque_saldos
  BEFORE UPDATE ON public.estoque_saldos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_estoque_solicitacoes ON public.estoque_solicitacoes;
CREATE TRIGGER set_updated_at_estoque_solicitacoes
  BEFORE UPDATE ON public.estoque_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- AUDIT TRIGGERS
-- =============================================

-- Atualizar a função audit_module_changes para incluir tabelas de estoque
CREATE OR REPLACE FUNCTION public.audit_module_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module_name text;
  v_old_data jsonb;
  v_new_data jsonb;
  v_changed_fields text[];
  v_user_id uuid;
  v_user_email text;
BEGIN
  -- Determinar módulo baseado na tabela
  CASE TG_TABLE_NAME
    WHEN 'brokers', 'locations', 'schedule_assignments', 'generated_schedules', 
         'location_period_configs', 'saturday_queue', 'location_rotation_queues' THEN
      v_module_name := 'escalas';
    WHEN 'sales', 'sales_brokers', 'sales_teams', 'broker_evaluations', 
         'monthly_leads', 'proposals', 'sale_partners' THEN
      v_module_name := 'vendas';
    WHEN 'estoque_locais_armazenamento', 'estoque_materiais', 'estoque_saldos',
         'estoque_gestores', 'estoque_solicitacoes', 'estoque_solicitacao_itens',
         'estoque_movimentacoes', 'estoque_notificacoes' THEN
      v_module_name := 'estoque';
    ELSE
      v_module_name := 'sistema';
  END CASE;

  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  
  IF v_user_id IS NULL THEN
    BEGIN
      v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;
  
  v_user_email := COALESCE(v_user_email, 'sistema@interno');

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
    v_changed_fields := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    SELECT ARRAY_AGG(changes.key) INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    ) AS changes;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
  END IF;

  IF TG_OP != 'UPDATE' OR v_changed_fields IS NOT NULL THEN
    INSERT INTO public.module_audit_logs (
      module_name, table_name, record_id, action,
      old_data, new_data, changed_fields,
      changed_by, changed_by_email
    ) VALUES (
      v_module_name, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
      v_old_data, v_new_data, v_changed_fields,
      v_user_id, v_user_email
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- Criar audit triggers para tabelas de estoque
DROP TRIGGER IF EXISTS audit_estoque_locais ON public.estoque_locais_armazenamento;
CREATE TRIGGER audit_estoque_locais
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_locais_armazenamento
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_materiais ON public.estoque_materiais;
CREATE TRIGGER audit_estoque_materiais
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_materiais
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_saldos ON public.estoque_saldos;
CREATE TRIGGER audit_estoque_saldos
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_saldos
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_gestores ON public.estoque_gestores;
CREATE TRIGGER audit_estoque_gestores
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_gestores
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_solicitacoes ON public.estoque_solicitacoes;
CREATE TRIGGER audit_estoque_solicitacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_solicitacao_itens ON public.estoque_solicitacao_itens;
CREATE TRIGGER audit_estoque_solicitacao_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_solicitacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_movimentacoes ON public.estoque_movimentacoes;
CREATE TRIGGER audit_estoque_movimentacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();

DROP TRIGGER IF EXISTS audit_estoque_notificacoes ON public.estoque_notificacoes;
CREATE TRIGGER audit_estoque_notificacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.estoque_notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes();
