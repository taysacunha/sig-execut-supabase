# Atualizar registro em /dev

Objetivo: refletir na tabela `dev_tracker` o que foi implementado desde a última atualização e revisar itens que evoluíram.

## Como será feito
Um único script SQL idempotente (usa `ON CONFLICT (system_name, feature_name)`) executado via ferramenta de migração:
1. `INSERT ... ON CONFLICT DO NOTHING` para as novas funcionalidades.
2. `UPDATE` para revisar descrição/horas dos itens antigos que ganharam funcionalidade nova.

Nada existente é apagado.

## Novos itens a inserir

### Infraestrutura
- Guards de autorização em RPCs (`rpc_authorization_guards`) — proteção server-side de funções sensíveis.
- Null-guards em `is_admin_or_super` e política de DELETE (`security_null_guards_and_delete_policy`).
- Correção de política INSERT em `module_audit_logs`.
- Correção de segurança em `user_profiles` (WITH CHECK anti-hijack).
- View `estoque_view_ferias_estrutura` — leitura da estrutura de Férias pelo Estoque.

### Estoque — módulo de Placas (grande adição)
- CRUD de placas de imóveis (`estoque_placas`, `estoque_placas_historico`).
- Atribuição de código à placa.
- Saída de placa para imóvel com baixa automática de saldo do material.
- Fluxo de reparo de placa (histórico e retorno ao estoque).
- Categoria e código opcional em placas.
- Atributos de material como placa (`estoque_materiais_placa_atributos`).
- Geração de PDF de placas.
- Estado de recebimento da solicitação (`estoque_solicitacao_recebimento_state`) — refinamento do workflow.
- RPC dedicada `confirmar_recebimento` para solicitante.
- Restrição admin-only em `estoque_saldos` (RLS).

### Férias
- Módulo de Premiações de férias (1º e 2º período) com ordem obrigatória e atesto (`ferias_premiacoes`, `premiacao_recebimento`) — expandir descrição do item existente com regras finalizadas.
- Validação de range em `period_specific_day_configs`.
- Correção do check de motivo de afastamento (`ferias_afastamentos_motivo_check_fix`).
- Isolamento reforçado de dados sensíveis (`ferias_colaboradores_dados_sensiveis`) — revisar horas do item existente.
- Backfill de quinzena de venda default 2.

## Revisões de itens existentes
- **Estoque › Solicitações de materiais**: descrição atualizada para incluir novo estado de recebimento + RPC.
- **Estoque › Gestão de saldos**: descrição atualizada para RLS admin-only.
- **Férias › Premiações**: descrição consolidada com regra de ordem, atesto e PDF.
- **Infraestrutura › Correções de RLS de segurança**: adicionar menção aos null-guards, RPC guards e WITH CHECK de user_profiles.

## Detalhes técnicos
- Um arquivo SQL será criado via migration tool (mesmo padrão dos seeds anteriores em `.lovable/dev_tracker_update_seed.sql`).
- Horas estimadas seguem a mesma escala/heurística dos seeds anteriores (2h–20h por item conforme complexidade). Custo fica em 0 — o valor/hora é aplicado no frontend.
- `display_order` continua na sequência de cada sistema.
- Idempotente: rodar de novo não duplica nem sobrescreve.

## Fora de escopo
- Mudanças na UI da página /dev.
- Alterar `hourly_rate` (permanece controlado pelo usuário no frontend).
- Excluir itens antigos.
