-- Atualização incremental v2 do dev_tracker.
-- Idempotente: usa ON CONFLICT (system_name, feature_name) DO NOTHING.
-- Execute no SQL Editor do Supabase.

CREATE UNIQUE INDEX IF NOT EXISTS dev_tracker_system_feature_unique
  ON public.dev_tracker (system_name, feature_name);

-- =============================================
-- INFRAESTRUTURA (continua a partir de display_order = 21)
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('infraestrutura', 'Guards de autorização em RPCs', 'Hardening server-side (rpc_authorization_guards) validando role/permissão dentro de funções sensíveis expostas via RPC', 6, 0, 21),
('infraestrutura', 'Null-guards e política de DELETE', 'Ajuste em is_admin_or_super para tratar auth.uid() nulo e política de DELETE dedicada em tabelas críticas (security_null_guards_and_delete_policy)', 4, 0, 22),
('infraestrutura', 'Correção de INSERT em module_audit_logs', 'Ajuste da política de INSERT permitindo que os triggers de auditoria gravem corretamente para usuários autenticados', 2, 0, 23),
('infraestrutura', 'WITH CHECK anti-hijack em user_profiles', 'Política de UPDATE com USING e WITH CHECK em user_id = auth.uid() impedindo reescrita do próprio perfil apontando para outro usuário', 3, 0, 24),
('infraestrutura', 'View compartilhada de estrutura de Férias', 'estoque_view_ferias_estrutura expõe unidades/setores/equipes/cargos para o Estoque sem duplicar cadastros', 4, 0, 25)
ON CONFLICT (system_name, feature_name) DO NOTHING;

-- =============================================
-- ESTOQUE - Módulo de Placas (continua a partir de display_order = 17)
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('estoque', 'CRUD de placas de imóveis', 'Cadastro de placas (estoque_placas) com material vinculado, código opcional, categoria, status e vínculo ao imóvel/empreendimento', 14, 0, 17),
('estoque', 'Histórico de placas', 'Tabela estoque_placas_historico registrando cada evento (entrada, atribuição, saída, retorno, reparo) com responsável e data', 8, 0, 18),
('estoque', 'Atribuição de código à placa', 'Dialog AtribuirCodigoDialog para vincular código físico da placa após a produção', 4, 0, 19),
('estoque', 'Saída de placa para imóvel', 'Dialog NovaSaidaDialog com baixa automática de saldo do material e registro no histórico', 10, 0, 20),
('estoque', 'Fluxo de reparo de placa', 'Envio para reparo, retorno ao estoque e reaproveitamento com rastreabilidade completa (estoque_placas_reparo_fluxo_material_saldo)', 10, 0, 21),
('estoque', 'Categoria e código opcional em placas', 'Ajuste estoque_placas_categoria_e_codigo_opcional permitindo classificar placas e cadastrar sem código provisório', 4, 0, 22),
('estoque', 'Atributos de material como placa', 'Campos em estoque_materiais marcando material como placa e definindo atributos específicos (medidas, tipo)', 6, 0, 23),
('estoque', 'PDF de placas', 'Gerador PlacasPDFGenerator com relatório formatado de placas por status e local', 6, 0, 24),
('estoque', 'Estado de recebimento da solicitação', 'Campo/estado dedicado (estoque_solicitacao_recebimento_state) separando atendida, em trânsito e recebida pelo solicitante', 6, 0, 25),
('estoque', 'RPC confirmar_recebimento', 'Função server-side (estoque_confirmar_recebimento_rpc) que valida solicitante e grava atesto sem depender do frontend', 4, 0, 26),
('estoque', 'Restrição admin-only em estoque_saldos', 'RLS endurecida (estoque_saldos_admin_only_rls) restringindo escrita direta em saldos apenas a admin/super_admin', 3, 0, 27)
ON CONFLICT (system_name, feature_name) DO NOTHING;

-- =============================================
-- FÉRIAS (continua a partir de display_order = 35)
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('ferias', 'Validação de range em period_specific_day_configs', 'Trigger de validação garantindo que datas específicas do período respeitem o intervalo do período aquisitivo', 3, 0, 35),
('ferias', 'Correção do check de motivo de afastamento', 'Constraint ferias_afastamentos_motivo_check ampliada para novos motivos e alinhada ao dialog', 2, 0, 36),
('ferias', 'Backfill de quinzena de venda default', 'Migração backfill_quinzena_venda_default_2 normalizando registros históricos', 2, 0, 37)
ON CONFLICT (system_name, feature_name) DO NOTHING;

-- =============================================
-- REVISÕES DE ITENS EXISTENTES
-- =============================================

-- Estoque › Solicitações de materiais: novo estado + RPC
UPDATE public.dev_tracker
SET description = 'Workflow completo: criação, itens, aprovação, atendimento parcial, finalização, estado de recebimento separado e RPC dedicada de confirmação pelo solicitante',
    hours = GREATEST(hours, 18)
WHERE system_name = 'estoque' AND feature_name = 'Solicitações de materiais';

-- Estoque › Gestão de saldos: RLS admin-only
UPDATE public.dev_tracker
SET description = 'Visualização de saldos por material e local com alertas de estoque mínimo. Escrita direta em saldos restrita a admin/super_admin via RLS',
    hours = GREATEST(hours, 10)
WHERE system_name = 'estoque' AND feature_name = 'Gestão de saldos';

-- Férias › Premiações: descrição consolidada
UPDATE public.dev_tracker
SET description = 'Módulo completo de premiações de férias (1º e 2º período): tabelas ferias_premiacoes, lançamento por quinzena, regra de ordem obrigatória, atesto de recebimento, cálculo (premiacaoCalc) e PDF dedicado (premiacaoPdf)',
    hours = GREATEST(hours, 20)
WHERE system_name = 'ferias' AND feature_name = 'Premiações de férias (1º e 2º período)';

-- Férias › Isolamento de dados sensíveis: reforço
UPDATE public.dev_tracker
SET description = 'Tabela ferias_colaboradores_dados_sensiveis (CPF) com RLS restrita a editores/admins e políticas dedicadas de SELECT/INSERT/UPDATE/DELETE',
    hours = GREATEST(hours, 8)
WHERE system_name = 'ferias' AND feature_name = 'Isolamento de dados sensíveis';

-- Infraestrutura › Correções de RLS: consolidar
UPDATE public.dev_tracker
SET description = 'Revisão e endurecimento de políticas RLS em tabelas sensíveis (rls_security_fixes), null-guards em funções security definer, guards em RPCs e WITH CHECK anti-hijack em user_profiles',
    hours = GREATEST(hours, 12)
WHERE system_name = 'infraestrutura' AND feature_name = 'Correções de RLS de segurança';

-- Confirmação rápida (opcional)
-- SELECT system_name, COUNT(*) AS total, SUM(hours) AS horas
-- FROM public.dev_tracker GROUP BY system_name ORDER BY system_name;