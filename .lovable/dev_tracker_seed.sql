-- Seed: Popular dev_tracker com todas as funcionalidades desenvolvidas
-- Execute no SQL Editor do Supabase

-- Limpar dados existentes (caso queira reinserir)
-- DELETE FROM public.dev_tracker;

-- =============================================
-- 1. LOGIN / INFRAESTRUTURA
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('infraestrutura', 'Autenticação completa', 'Login, registro, recuperação de senha, validação de força de senha, confirmação de e-mail', 16, 0, 1),
('infraestrutura', 'Seleção de sistema', 'Tela multi-sistema com cards de acesso (Escalas, Vendas, Férias, Estoque)', 6, 0, 2),
('infraestrutura', 'Gerenciamento de usuários', 'CRUD completo de usuários, convite por e-mail, ativação/desativação, listagem com filtros', 24, 0, 3),
('infraestrutura', 'Sistema de roles e permissões', '6 níveis de roles (super_admin, admin, manager, supervisor, collaborator, broker) com tabela dedicada', 16, 0, 4),
('infraestrutura', 'Controle de acesso por sistema', 'Tabela system_access com permissões view/view_edit por sistema para cada usuário', 12, 0, 5),
('infraestrutura', 'Componentes de proteção de rotas', 'RoleGuard, ProtectedRoute, SystemGuard para controle granular de acesso', 8, 0, 6),
('infraestrutura', 'Controle de sessão única', 'Hook useSessionControl impedindo login simultâneo do mesmo usuário', 8, 0, 7),
('infraestrutura', 'Logout por inatividade', 'Hook useInactivityLogout com timer configurável para desconexão automática', 4, 0, 8),
('infraestrutura', 'Setup do primeiro administrador', 'Fluxo FirstAdminSetup para configuração inicial quando não há admin cadastrado', 6, 0, 9),
('infraestrutura', 'Edge Functions de usuários', '4 Edge Functions: invite-user, list-users, manage-user, deactivate-expired-notice', 20, 0, 10),
('infraestrutura', 'Perfil do usuário', 'Página de perfil com edição de dados pessoais e avatar', 6, 0, 11),
('infraestrutura', 'Logs de auditoria genérico', 'Componente AuditLogsPanel reutilizável com filtros por ação, ator, período e exportação', 12, 0, 12),
('infraestrutura', 'Code splitting e lazy loading', 'Carregamento sob demanda de todas as páginas com React.lazy e Suspense', 4, 0, 13),
('infraestrutura', 'Componentes reutilizáveis base', 'TableControls, paginação, busca com debounce, ordenação, exportação genérica', 10, 0, 14);

-- =============================================
-- 2. SISTEMA DE ESCALAS (PLANTÕES)
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('escalas', 'Dashboard de escalas', 'Painel com estatísticas, gráficos de distribuição, top corretores e locais mais escalados', 16, 0, 1),
('escalas', 'CRUD de corretores', 'Cadastro completo com CRECI, disponibilidade por dia da semana e turno (manhã/tarde)', 12, 0, 2),
('escalas', 'CRUD de locais/empreendimentos', 'Cadastro de locais internos e externos com endereço, construtora, horários e períodos de vigência', 14, 0, 3),
('escalas', 'Gerador automático de escalas', 'Motor de geração com ~4500 linhas de lógica: rodízio, balanceamento, regras de conflito, validação', 80, 0, 4),
('escalas', 'Calendário de escalas', 'Visualização semanal/mensal com edição inline, drag visual de plantões por dia e turno', 20, 0, 5),
('escalas', 'Substituição e troca de plantões', 'Dialogs para substituir corretores em plantões e trocar escalas entre corretores', 10, 0, 6),
('escalas', 'Fila de rodízio por local', 'Sistema de fila rotativa por empreendimento com posição e histórico de atribuições', 12, 0, 7),
('escalas', 'Fila de rodízio de sábado', 'Rodízio específico para sábados com balanceamento entre corretores', 8, 0, 8),
('escalas', 'Validador de regras de escala', 'Validação pós-geração com relatório de conflitos, sobreposições e regras violadas', 16, 0, 9),
('escalas', 'Relatórios e consultas', '5 abas: consultas básicas, performance de corretor, distribuição, análise temporal, análise por local', 24, 0, 10),
('escalas', 'Exportação PDF de escalas', 'Geração de PDF formatado com escalas semanais para impressão e distribuição', 10, 0, 11),
('escalas', 'Histórico mensal agregado', 'Tabela assignment_history_monthly com contadores por corretor/local/turno para análise', 8, 0, 12);

-- =============================================
-- 3. SISTEMA DE VENDAS
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('vendas', 'Dashboard de vendas', 'Painel com resumo de VGV, total de vendas, propostas, leads e ranking mensal', 16, 0, 1),
('vendas', 'CRUD de equipes de vendas', 'Cadastro de equipes com vinculação de corretores e filtros por equipe', 8, 0, 2),
('vendas', 'CRUD de corretores de vendas', 'Cadastro com CRECI, nome de exibição, equipe, metas individuais de VGV', 10, 0, 3),
('vendas', 'Registro de vendas', 'Cadastro de vendas com valor VGV, participação proporcional entre corretores parceiros', 14, 0, 4),
('vendas', 'Gestão de propostas', 'Registro mensal de propostas por corretor com contagem de propostas e conversões', 8, 0, 5),
('vendas', 'Gestão de leads mensais', 'Registro de leads ativos, novos e visitas realizadas por corretor por mês', 8, 0, 6),
('vendas', 'Avaliações C2S', 'Sistema de avaliação com 14 critérios C2S, 3 de desempenho, cálculo automático de média e classificação', 24, 0, 7),
('vendas', 'Ranking de corretores e equipes', 'Ranking automático por nota média, VGV, vendas com filtros por mês e equipe', 10, 0, 8),
('vendas', 'Relatório individual de corretor (PDF)', 'Relatório completo por corretor com gráficos de evolução, detalhes de vendas, exportação PDF via html2canvas', 20, 0, 9),
('vendas', 'Logs de auditoria de vendas', 'Registro automático de ações no módulo de vendas com visualização filtrada', 6, 0, 10);

-- =============================================
-- 4. SISTEMA DE FÉRIAS / FOLGAS
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('ferias', 'Dashboard de férias', 'Painel com resumo de colaboradores, férias ativas, folgas do mês, próximos aniversariantes', 12, 0, 1),
('ferias', 'Estrutura organizacional', 'CRUD de unidades, setores (com chefes e substitutos), equipes e cargos', 20, 0, 2),
('ferias', 'CRUD de colaboradores', 'Cadastro completo com CPF, admissão, nascimento, setor, equipe, cargo, familiar, aviso prévio, filtros avançados', 18, 0, 3),
('ferias', 'Gestão de férias', 'Programação de férias em quinzenas, aprovação, gozo diferenciado, venda de dias, redução', 24, 0, 4),
('ferias', 'Gerador automático de férias', 'Motor de geração automática respeitando regras de conflito, quinzenas, setores e período aquisitivo', 20, 0, 5),
('ferias', 'Gestão de folgas', 'Gerador de folgas de sábado, mover, trocar, remover folgas, registro de perdas', 18, 0, 6),
('ferias', 'Escala de folgas de sábado por setor', 'Tabela SetoresSabadosTable com visualização mensal de folgas por setor com geração e confirmação', 12, 0, 7),
('ferias', 'Formulário anual de férias', 'Formulário de preferência anual por colaborador com 3 opções de período e venda de dias', 10, 0, 8),
('ferias', 'Calendário de férias, folgas e aniversariantes', '3 abas de calendário: férias programadas, folgas de sábado, aniversariantes do mês', 14, 0, 9),
('ferias', 'Gestão de aniversariantes', 'Listagem mensal de aniversariantes com dados completos e exportação', 6, 0, 10),
('ferias', 'Créditos de folgas', 'Sistema de créditos e débitos de folgas com justificativa, origem e utilização', 10, 0, 11),
('ferias', 'Configurações do sistema de férias', '5 abas: feriados, folgas, quinzenas, regras gerais e configurações avançadas', 14, 0, 12),
('ferias', 'Relatórios e PDFs', 'Consulta geral, PDF de aniversariantes, formulário anual, exceções, contador de férias', 16, 0, 13),
('ferias', 'Exceções de férias e folgas', 'Sistema de marcação de exceções com motivo e justificativa para casos fora das regras', 6, 0, 14),
('ferias', 'Conflitos entre colaboradores', 'Cadastro de conflitos impedindo férias simultâneas de colaboradores específicos', 6, 0, 15),
('ferias', 'Geração de PDF de escalas de folgas', 'Exportação PDF e impressão das escalas de folgas mensais por setor', 8, 0, 16);

-- =============================================
-- 5. SISTEMA DE ESTOQUE
-- =============================================
INSERT INTO public.dev_tracker (system_name, feature_name, description, hours, cost, display_order) VALUES
('estoque', 'Dashboard de estoque', 'Painel com resumo de materiais, saldos críticos, movimentações recentes e solicitações pendentes', 12, 0, 1),
('estoque', 'CRUD de materiais', 'Cadastro de materiais com categoria, unidade de medida, estoque mínimo e descrição', 8, 0, 2),
('estoque', 'CRUD de locais de armazenamento', 'Cadastro hierárquico de depósitos, prateleiras e sublocais por unidade', 10, 0, 3),
('estoque', 'Gestão de saldos', 'Visualização de saldos por material e local com alertas de estoque mínimo', 8, 0, 4),
('estoque', 'Solicitações de materiais', 'Workflow completo: criação, itens, aprovação, atendimento parcial, finalização', 16, 0, 5),
('estoque', 'Movimentações de estoque', 'Registro de entradas, saídas e transferências com rastreabilidade de responsável', 12, 0, 6),
('estoque', 'Notificações de estoque', 'Sistema de notificações por usuário para solicitações, alertas de estoque e atualizações', 8, 0, 7),
('estoque', 'Gestão de gestores', 'Vinculação de usuários como gestores de unidades específicas', 6, 0, 8),
('estoque', 'Logs de auditoria de estoque', 'Registro e visualização de ações no módulo de estoque', 6, 0, 9),
('estoque', 'Controle de acesso por unidade', 'Hook useUsuarioUnidades limitando visualização e ações por unidade vinculada ao usuário', 8, 0, 10);
