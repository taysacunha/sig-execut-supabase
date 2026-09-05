-- Atualização incremental do dev_tracker com funcionalidades adicionadas
-- após o seed inicial. Idempotente: usa ON CONFLICT DO NOTHING via
-- combinação (system_name, feature_name) — não duplica se rodar de novo.
--
-- Execute no SQL Editor do Supabase.

-- Garantir índice único para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS dev_tracker_system_feature_unique
  ON public.dev_tracker (system_name, feature_name);

-- =============================================
-- INFRAESTRUTURA (continua a partir de display_order = 15)
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('infraestrutura', 'Auditoria por módulo', 'Páginas dedicadas de auditoria para Escalas, Vendas, Estoque e Férias com filtros e exportação', 12, 0, 15),
('infraestrutura', 'Tabela module_audit_logs e função audit_module_changes', 'Função genérica + triggers para registrar INSERT/UPDATE/DELETE de todas as tabelas dos módulos com diff de campos alterados', 16, 0, 16),
('infraestrutura', 'Páginas de Ajuda contextual', 'Help geral (Help.tsx) e FeriasHelp com documentação interna de uso por módulo', 10, 0, 17),
('infraestrutura', 'Guia de Deploy', 'Página DeployGuide com instruções de publicação e migração para self-hosted', 6, 0, 18),
('infraestrutura', 'Página Dev Tracker', 'CRUD de registros de desenvolvimento (funcionalidades, horas, custos) com totais por módulo e edição inline', 10, 0, 19),
('infraestrutura', 'Correções de RLS de segurança', 'Revisão e endurecimento de políticas RLS em tabelas sensíveis (rls_security_fixes)', 8, 0, 20)
ON CONFLICT (system_name, feature_name) DO NOTHING;

-- =============================================
-- ESTOQUE (continua a partir de display_order = 11)
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('estoque', 'CRUD de categorias de materiais', 'Cadastro independente de categorias (estoque_categorias) com vinculação aos materiais', 6, 0, 11),
('estoque', 'Confirmação de recebimento pelo solicitante', 'Botão "Confirmar recebimento" na página de solicitações com registro de data/atesto na movimentação', 8, 0, 12),
('estoque', 'Vínculo de usuários a unidades e setores', 'Tabela estoque_usuarios_unidades para controle granular de acesso por unidade/setor', 8, 0, 13),
('estoque', 'RLS de recebimento do solicitante', 'Política dedicada (is_solicitante_estoque) permitindo UPDATE somente da própria solicitação', 4, 0, 14),
('estoque', 'Notificações automáticas de estoque baixo', 'Helper verificarEstoqueBaixo dispara alerta a gestores quando saldo atinge mínimo configurado', 6, 0, 15),
('estoque', 'Auditoria automática do módulo', 'Triggers AFTER em todas as tabelas estoque_* gravando em module_audit_logs', 4, 0, 16)
ON CONFLICT (system_name, feature_name) DO NOTHING;

-- =============================================
-- FÉRIAS E FOLGAS (continua a partir de display_order = 17)
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('ferias', 'Aba Períodos Aquisitivos', 'Gestão dedicada de períodos aquisitivos com cálculo automático e visualização por colaborador', 14, 0, 17),
('ferias', 'Enviado ao contador (Q1/Q2)', 'Campos enviado_contador_q1/q2 com data, marcação individual por quinzena e geração de PDF do contador', 10, 0, 18),
('ferias', 'Gozo flexível em sub-períodos', 'Tabela ferias_gozo_periodos permitindo múltiplos sub-períodos dentro de cada quinzena', 18, 0, 19),
('ferias', 'Períodos quitados (venda integral)', 'Tabela ferias_periodos_quitados para registrar quitação total do período aquisitivo', 10, 0, 20),
('ferias', 'Afastamentos de colaboradores', 'CRUD ferias_afastamentos com motivo, datas e impacto na contagem do período aquisitivo', 14, 0, 21),
('ferias', 'Premiações de férias (1º e 2º período)', 'Lançamento de premiações por quinzena com regra de ordem obrigatória, atesto e PDF', 18, 0, 22),
('ferias', 'Redução de férias', 'Dialog dedicado (ReducaoFeriasDialog) para reduzir dias com justificativa', 6, 0, 23),
('ferias', 'Quitar período', 'Dialog QuitarPeriodoDialog para registrar quitação completa do aquisitivo', 6, 0, 24),
('ferias', 'Utilização de créditos', 'Dialogs separados para usar créditos em férias e folgas (UtilizarCreditoFerias/Folga)', 8, 0, 25),
('ferias', 'Mover folgas em lote', 'MoverFolgasLoteDialog para realocar várias folgas de sábado de uma vez', 8, 0, 26),
('ferias', 'Perda e troca de folga', 'PerdaFolgaDialog e TrocarFolgaDialog para gestão pontual de folgas', 6, 0, 27),
('ferias', 'Gantt de férias', 'Visualização GanttFeriasView com timeline anual e exportação PDF (GanttFeriasPDFGenerator)', 16, 0, 28),
('ferias', 'PDF Aniversariantes Celebre', 'Layout alternativo de PDF para aniversariantes (AniversariantesCelebrePDFGenerator)', 6, 0, 29),
('ferias', 'Isolamento de dados sensíveis', 'Tabela ferias_colaboradores_dados_sensiveis (CPF) com RLS restrita a editores/admins', 6, 0, 30),
('ferias', 'Auditoria automática do módulo', 'Triggers AFTER em todas as tabelas ferias_* gravando em module_audit_logs', 6, 0, 31),
('ferias', 'Reconciliação determinística de status', 'Reescrita de atualizar_status_ferias cobrindo gozo flexível, diferente e padrão', 12, 0, 32),
('ferias', 'Página de ajuda do módulo', 'FeriasHelp.tsx com documentação interna de regras e fluxos de férias/folgas', 6, 0, 33)
ON CONFLICT (system_name, feature_name) DO NOTHING;

-- Correções pontuais
INSERT INTO public.dev_tracker (system_name, feature_name, description, estimated_hours, actual_hours, display_order) VALUES
('ferias', 'Correção: motivo de perda de folga', 'Constraint ferias_folgas_perdas_motivo_check expandida (atestado_medico, suspensao, outro) e diálogo passa a gravar a chave; tabela exibe rótulo via formatMotivoPerda. Adicionado campo de busca por nome no PerdaFolgaDialog.', 2, 0, 34)
ON CONFLICT (system_name, feature_name) DO NOTHING;

-- Confirmação rápida (opcional)
-- SELECT system_name, COUNT(*) FROM public.dev_tracker GROUP BY system_name ORDER BY system_name;