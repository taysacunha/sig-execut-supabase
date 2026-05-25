## Objetivo

Atualizar a tabela `dev_tracker` com todas as funcionalidades desenvolvidas após a criação inicial do seed, sem apagar nada do que já existe.

## Como vou aplicar

Via **insert tool** (não migration — é dado, não schema), com `INSERT` simples por módulo, `display_order` continuando a partir do último valor existente em cada `system_name`.

Horas e custo seguirão o mesmo padrão do seed original (estimativas conservadoras, custo 0 — você ajusta depois pela própria UI do Dev Tracker se quiser).

## O que será adicionado

### Estoque (continua a partir de display_order = 11)
- CRUD de categorias de materiais
- Confirmação de recebimento pelo solicitante (com data de atesto)
- Vínculo de usuários a unidades e setores (controle granular)
- Política de recebimento (RLS dedicada para solicitantes)
- Notificações de estoque baixo automáticas
- Auditoria automática via triggers em todas as tabelas `estoque_*`

### Férias e Folgas (continua a partir de display_order = 17)
- Aba Períodos Aquisitivos (gestão dedicada)
- Campo "Enviado ao contador" por quinzena (Q1/Q2) + PDF do contador
- Períodos de gozo flexível (sub-períodos via `ferias_gozo_periodos`)
- Períodos quitados / venda integral (`ferias_periodos_quitados`)
- Afastamentos de colaboradores (CRUD + impacto no aquisitivo)
- Premiações de férias (1º e 2º período, ordem obrigatória, atesto, PDF)
- Redução de férias e Quitar período (dialogs dedicados)
- Utilização de créditos (férias e folgas) em dialogs separados
- Mover folgas em lote, Perda de folga, Trocar folga
- Visualização Gantt de férias + exportação PDF
- Aniversariantes "Celebre" (PDF alternativo)
- Dados sensíveis isolados (`ferias_colaboradores_dados_sensiveis` com RLS própria)
- Auditoria automática via triggers em todas as tabelas `ferias_*`
- Reconciliação determinística de status (`atualizar_status_ferias` reescrita)
- Página de ajuda do módulo (`FeriasHelp`)

### Infraestrutura (continua a partir de display_order = 15)
- Páginas de Auditoria por módulo (Escalas, Vendas, Estoque, Férias)
- Help / Ajuda contextual por módulo
- Guia de Deploy (`DeployGuide`)
- Página Dev Tracker (registro de funcionalidades — esta mesma)
- Correções de RLS de segurança (`rls_security_fixes`)
- Tabela de logs de auditoria de módulos (`module_audit_logs`) + função `audit_module_changes`

## Fora de escopo

- Lembretes por e-mail (Resend) — conforme combinado, fica para depois.
- Não vou alterar nada já cadastrado, só acrescentar.

## Ordem de execução ao aprovar

1. `SELECT` rápido para confirmar o último `display_order` de cada módulo.
2. `INSERT` único por módulo (4 inserts) com todos os itens acima.
3. Confirmação na chat com a contagem total adicionada.
