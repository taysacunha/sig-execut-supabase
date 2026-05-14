
-- =============================================
-- MÓDULO DE FÉRIAS, FOLGAS E ANIVERSARIANTES
-- =============================================

-- 1. TABELAS DE ESTRUTURA
-- =============================================

-- Unidades
CREATE TABLE public.ferias_unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  endereco TEXT,
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Setores
CREATE TABLE public.ferias_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade_id UUID REFERENCES public.ferias_unidades(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cargos
CREATE TABLE public.ferias_cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Equipes
CREATE TABLE public.ferias_equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  setor_id UUID REFERENCES public.ferias_setores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE COLABORADORES
-- =============================================

CREATE TABLE public.ferias_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  data_nascimento DATE NOT NULL,
  data_admissao DATE NOT NULL,
  unidade_id UUID REFERENCES public.ferias_unidades(id),
  setor_titular_id UUID REFERENCES public.ferias_setores(id) NOT NULL,
  cargo_id UUID REFERENCES public.ferias_cargos(id),
  equipe_id UUID REFERENCES public.ferias_equipes(id),
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  aviso_previo_inicio DATE,
  aviso_previo_fim DATE,
  familiar_id UUID REFERENCES public.ferias_colaboradores(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Setores substitutos (multi-seleção)
CREATE TABLE public.ferias_colaborador_setores_substitutos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  setor_id UUID REFERENCES public.ferias_setores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(colaborador_id, setor_id)
);

-- Chefes de setor
CREATE TABLE public.ferias_setor_chefes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id UUID REFERENCES public.ferias_setores(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(setor_id, colaborador_id)
);

-- 3. TABELA DE FÉRIAS
-- =============================================

CREATE TABLE public.ferias_ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  
  -- Quinzena 1 (para contador)
  quinzena1_inicio DATE NOT NULL,
  quinzena1_fim DATE NOT NULL,
  
  -- Quinzena 2 (para contador)
  quinzena2_inicio DATE NOT NULL,
  quinzena2_fim DATE NOT NULL,
  
  -- Gozo em datas diferentes
  gozo_diferente BOOLEAN DEFAULT false,
  gozo_quinzena1_inicio DATE,
  gozo_quinzena1_fim DATE,
  gozo_quinzena2_inicio DATE,
  gozo_quinzena2_fim DATE,
  
  -- Venda de dias
  vender_dias BOOLEAN DEFAULT false,
  quinzena_venda INTEGER CHECK (quinzena_venda IN (1, 2)),
  dias_vendidos INTEGER DEFAULT 0,
  
  -- Status e exceção
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),
  is_excecao BOOLEAN DEFAULT false,
  excecao_motivo TEXT,
  excecao_justificativa TEXT,
  
  -- Período aquisitivo referência
  periodo_aquisitivo_inicio DATE,
  periodo_aquisitivo_fim DATE,
  
  -- Origem (manual ou formulário anual)
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual', 'formulario_anual')),
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE FORMULÁRIO ANUAL
-- =============================================

CREATE TABLE public.ferias_formulario_anual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  ano_referencia INTEGER NOT NULL,
  
  -- Período 1
  periodo1_mes INTEGER,
  periodo1_quinzena TEXT CHECK (periodo1_quinzena IN ('primeira', 'segunda', 'qualquer')),
  
  -- Período 2
  periodo2_mes INTEGER,
  periodo2_quinzena TEXT CHECK (periodo2_quinzena IN ('primeira', 'segunda', 'qualquer')),
  
  -- Período 3 (opcional)
  periodo3_mes INTEGER,
  periodo3_quinzena TEXT CHECK (periodo3_quinzena IN ('primeira', 'segunda', 'qualquer')),
  
  -- Preferência
  periodo_preferencia INTEGER CHECK (periodo_preferencia IN (1, 2, 3)),
  
  -- Venda
  vender_dias BOOLEAN DEFAULT false,
  dias_vender INTEGER DEFAULT 0 CHECK (dias_vender >= 0 AND dias_vender <= 10),
  
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'cadastrado', 'gerado')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(colaborador_id, ano_referencia)
);

-- 5. TABELAS DE FOLGAS DE SÁBADO
-- =============================================

-- Escala mensal de folgas
CREATE TABLE public.ferias_folgas_escala (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id UUID REFERENCES public.ferias_setores(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'confirmada')),
  confirmada_por UUID,
  confirmada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(setor_id, mes, ano)
);

-- Folgas individuais
CREATE TABLE public.ferias_folgas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id UUID REFERENCES public.ferias_folgas_escala(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  data_sabado DATE NOT NULL,
  is_excecao BOOLEAN DEFAULT false,
  excecao_motivo TEXT,
  excecao_justificativa TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Perdas de folga
CREATE TABLE public.ferias_folgas_perdas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('falta_injustificada', 'atestado_sabado', 'aviso_previo')),
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(colaborador_id, mes, ano, motivo)
);

-- 6. TABELAS DE CONFIGURAÇÃO
-- =============================================

-- Feriados
CREATE TABLE public.ferias_feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('nacional', 'estadual', 'municipal', 'interno')),
  unidade_id UUID REFERENCES public.ferias_unidades(id) ON DELETE CASCADE,
  recorrente BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conflitos entre colaboradores
CREATE TABLE public.ferias_conflitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador1_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  colaborador2_id UUID REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (colaborador1_id < colaborador2_id)
);

-- Configurações do sistema
CREATE TABLE public.ferias_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quinzenas por ano (datas de início/fim de cada quinzena)
CREATE TABLE public.ferias_quinzenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  quinzena INTEGER NOT NULL CHECK (quinzena IN (1, 2)),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ano, mes, quinzena)
);

-- 7. TABELA DE AUDITORIA
-- =============================================

CREATE TABLE public.ferias_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.ferias_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_colaborador_setores_substitutos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_setor_chefes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_formulario_anual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_folgas_escala ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_folgas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_folgas_perdas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_conflitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_quinzenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - SELECT (VIEW)
-- =============================================

-- Unidades - SELECT
CREATE POLICY "ferias_unidades_select" ON public.ferias_unidades
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Setores - SELECT
CREATE POLICY "ferias_setores_select" ON public.ferias_setores
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Cargos - SELECT
CREATE POLICY "ferias_cargos_select" ON public.ferias_cargos
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Equipes - SELECT
CREATE POLICY "ferias_equipes_select" ON public.ferias_equipes
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Colaboradores - SELECT
CREATE POLICY "ferias_colaboradores_select" ON public.ferias_colaboradores
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Colaborador Setores Substitutos - SELECT
CREATE POLICY "ferias_colaborador_setores_substitutos_select" ON public.ferias_colaborador_setores_substitutos
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Setor Chefes - SELECT
CREATE POLICY "ferias_setor_chefes_select" ON public.ferias_setor_chefes
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Férias - SELECT
CREATE POLICY "ferias_ferias_select" ON public.ferias_ferias
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Formulário Anual - SELECT
CREATE POLICY "ferias_formulario_anual_select" ON public.ferias_formulario_anual
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Folgas Escala - SELECT
CREATE POLICY "ferias_folgas_escala_select" ON public.ferias_folgas_escala
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Folgas - SELECT
CREATE POLICY "ferias_folgas_select" ON public.ferias_folgas
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Folgas Perdas - SELECT
CREATE POLICY "ferias_folgas_perdas_select" ON public.ferias_folgas_perdas
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Feriados - SELECT
CREATE POLICY "ferias_feriados_select" ON public.ferias_feriados
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Conflitos - SELECT
CREATE POLICY "ferias_conflitos_select" ON public.ferias_conflitos
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Configurações - SELECT
CREATE POLICY "ferias_configuracoes_select" ON public.ferias_configuracoes
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Quinzenas - SELECT
CREATE POLICY "ferias_quinzenas_select" ON public.ferias_quinzenas
FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'ferias'));

-- Audit Logs - SELECT (apenas admin ou super)
CREATE POLICY "ferias_audit_logs_select" ON public.ferias_audit_logs
FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- =============================================
-- RLS POLICIES - INSERT/UPDATE/DELETE (EDIT)
-- =============================================

-- Unidades - INSERT
CREATE POLICY "ferias_unidades_insert" ON public.ferias_unidades
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Unidades - UPDATE
CREATE POLICY "ferias_unidades_update" ON public.ferias_unidades
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Unidades - DELETE
CREATE POLICY "ferias_unidades_delete" ON public.ferias_unidades
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Setores - INSERT
CREATE POLICY "ferias_setores_insert" ON public.ferias_setores
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Setores - UPDATE
CREATE POLICY "ferias_setores_update" ON public.ferias_setores
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Setores - DELETE
CREATE POLICY "ferias_setores_delete" ON public.ferias_setores
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Cargos - INSERT
CREATE POLICY "ferias_cargos_insert" ON public.ferias_cargos
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Cargos - UPDATE
CREATE POLICY "ferias_cargos_update" ON public.ferias_cargos
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Cargos - DELETE
CREATE POLICY "ferias_cargos_delete" ON public.ferias_cargos
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Equipes - INSERT
CREATE POLICY "ferias_equipes_insert" ON public.ferias_equipes
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Equipes - UPDATE
CREATE POLICY "ferias_equipes_update" ON public.ferias_equipes
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Equipes - DELETE
CREATE POLICY "ferias_equipes_delete" ON public.ferias_equipes
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Colaboradores - INSERT
CREATE POLICY "ferias_colaboradores_insert" ON public.ferias_colaboradores
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Colaboradores - UPDATE
CREATE POLICY "ferias_colaboradores_update" ON public.ferias_colaboradores
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Colaboradores - DELETE
CREATE POLICY "ferias_colaboradores_delete" ON public.ferias_colaboradores
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Colaborador Setores Substitutos - INSERT
CREATE POLICY "ferias_colaborador_setores_substitutos_insert" ON public.ferias_colaborador_setores_substitutos
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Colaborador Setores Substitutos - DELETE
CREATE POLICY "ferias_colaborador_setores_substitutos_delete" ON public.ferias_colaborador_setores_substitutos
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Setor Chefes - INSERT
CREATE POLICY "ferias_setor_chefes_insert" ON public.ferias_setor_chefes
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Setor Chefes - DELETE
CREATE POLICY "ferias_setor_chefes_delete" ON public.ferias_setor_chefes
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Férias - INSERT
CREATE POLICY "ferias_ferias_insert" ON public.ferias_ferias
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Férias - UPDATE
CREATE POLICY "ferias_ferias_update" ON public.ferias_ferias
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Férias - DELETE
CREATE POLICY "ferias_ferias_delete" ON public.ferias_ferias
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Formulário Anual - INSERT
CREATE POLICY "ferias_formulario_anual_insert" ON public.ferias_formulario_anual
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Formulário Anual - UPDATE
CREATE POLICY "ferias_formulario_anual_update" ON public.ferias_formulario_anual
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Formulário Anual - DELETE
CREATE POLICY "ferias_formulario_anual_delete" ON public.ferias_formulario_anual
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas Escala - INSERT
CREATE POLICY "ferias_folgas_escala_insert" ON public.ferias_folgas_escala
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas Escala - UPDATE
CREATE POLICY "ferias_folgas_escala_update" ON public.ferias_folgas_escala
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas Escala - DELETE
CREATE POLICY "ferias_folgas_escala_delete" ON public.ferias_folgas_escala
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas - INSERT
CREATE POLICY "ferias_folgas_insert" ON public.ferias_folgas
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas - UPDATE
CREATE POLICY "ferias_folgas_update" ON public.ferias_folgas
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas - DELETE
CREATE POLICY "ferias_folgas_delete" ON public.ferias_folgas
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas Perdas - INSERT
CREATE POLICY "ferias_folgas_perdas_insert" ON public.ferias_folgas_perdas
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Folgas Perdas - DELETE
CREATE POLICY "ferias_folgas_perdas_delete" ON public.ferias_folgas_perdas
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Feriados - INSERT
CREATE POLICY "ferias_feriados_insert" ON public.ferias_feriados
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Feriados - UPDATE
CREATE POLICY "ferias_feriados_update" ON public.ferias_feriados
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Feriados - DELETE
CREATE POLICY "ferias_feriados_delete" ON public.ferias_feriados
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Conflitos - INSERT
CREATE POLICY "ferias_conflitos_insert" ON public.ferias_conflitos
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Conflitos - DELETE
CREATE POLICY "ferias_conflitos_delete" ON public.ferias_conflitos
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Configurações - INSERT
CREATE POLICY "ferias_configuracoes_insert" ON public.ferias_configuracoes
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Configurações - UPDATE
CREATE POLICY "ferias_configuracoes_update" ON public.ferias_configuracoes
FOR UPDATE TO authenticated
USING (public.is_admin_or_super(auth.uid()));

-- Quinzenas - INSERT
CREATE POLICY "ferias_quinzenas_insert" ON public.ferias_quinzenas
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_system(auth.uid(), 'ferias'));

-- Quinzenas - UPDATE
CREATE POLICY "ferias_quinzenas_update" ON public.ferias_quinzenas
FOR UPDATE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Quinzenas - DELETE
CREATE POLICY "ferias_quinzenas_delete" ON public.ferias_quinzenas
FOR DELETE TO authenticated
USING (public.can_edit_system(auth.uid(), 'ferias'));

-- Audit Logs - INSERT (append-only, todos podem inserir)
CREATE POLICY "ferias_audit_logs_insert" ON public.ferias_audit_logs
FOR INSERT TO authenticated
WITH CHECK (public.can_view_system(auth.uid(), 'ferias'));

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER set_ferias_unidades_updated_at
  BEFORE UPDATE ON public.ferias_unidades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_setores_updated_at
  BEFORE UPDATE ON public.ferias_setores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_cargos_updated_at
  BEFORE UPDATE ON public.ferias_cargos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_equipes_updated_at
  BEFORE UPDATE ON public.ferias_equipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_colaboradores_updated_at
  BEFORE UPDATE ON public.ferias_colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_ferias_updated_at
  BEFORE UPDATE ON public.ferias_ferias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_formulario_anual_updated_at
  BEFORE UPDATE ON public.ferias_formulario_anual
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_folgas_escala_updated_at
  BEFORE UPDATE ON public.ferias_folgas_escala
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_folgas_updated_at
  BEFORE UPDATE ON public.ferias_folgas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ferias_feriados_updated_at
  BEFORE UPDATE ON public.ferias_feriados
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_ferias_colaboradores_setor ON public.ferias_colaboradores(setor_titular_id);
CREATE INDEX idx_ferias_colaboradores_unidade ON public.ferias_colaboradores(unidade_id);
CREATE INDEX idx_ferias_colaboradores_status ON public.ferias_colaboradores(status);
CREATE INDEX idx_ferias_colaboradores_nascimento ON public.ferias_colaboradores(data_nascimento);

CREATE INDEX idx_ferias_ferias_colaborador ON public.ferias_ferias(colaborador_id);
CREATE INDEX idx_ferias_ferias_status ON public.ferias_ferias(status);
CREATE INDEX idx_ferias_ferias_quinzena1 ON public.ferias_ferias(quinzena1_inicio, quinzena1_fim);
CREATE INDEX idx_ferias_ferias_quinzena2 ON public.ferias_ferias(quinzena2_inicio, quinzena2_fim);

CREATE INDEX idx_ferias_formulario_ano ON public.ferias_formulario_anual(ano_referencia);
CREATE INDEX idx_ferias_formulario_status ON public.ferias_formulario_anual(status);

CREATE INDEX idx_ferias_folgas_escala_periodo ON public.ferias_folgas_escala(ano, mes);
CREATE INDEX idx_ferias_folgas_data ON public.ferias_folgas(data_sabado);

CREATE INDEX idx_ferias_feriados_data ON public.ferias_feriados(data);

CREATE INDEX idx_ferias_audit_logs_entity ON public.ferias_audit_logs(entity_type, entity_id);
CREATE INDEX idx_ferias_audit_logs_created ON public.ferias_audit_logs(created_at);
