# Página /dev: acesso restrito, histórico cronológico e registro automático

## O que muda

### 1. Acesso restrito a um único usuário
- Apenas a página `/dev` passa a ser liberada somente para o e-mail `brunumorais@gmail.com`, não mais para todos os admins.
- A restrição vale em dois níveis: na tela (bloqueio de acesso) e no banco (as regras de acesso das tabelas do registro passam a exigir esse e-mail).
- Qualquer outro usuário, mesmo admin, vê a tela de "Acesso Restrito".
- **A página `/dev/deploy-guide` não é tocada**: ela já é pública para qualquer usuário logado e continua assim — fica desvinculada da regra da `/dev`. Na `/dev` permanece apenas o botão que leva até ela.

### 2. Link no menu lateral
- Um item "Registro Dev" aparece no menu lateral (e na tela de seleção de sistemas) **somente** quando o usuário logado é o e-mail autorizado. Para os demais, o item simplesmente não existe.

### 3. Nova aba "Histórico" (cronológico)
A página mantém as abas atuais (Todos / por sistema) e ganha uma aba **Histórico**, com lançamentos em ordem cronológica decrescente contendo:
- Data de início da ação
- Sistema
- Funcionalidade / título da ação
- Descrição detalhada do que foi feito
- Tipo (novo, correção, atualização, ajuste)
- Horas dedicadas
- Valor (horas × valor/hora)

Recursos da aba: agrupamento por mês, filtro por sistema e por período, totais de horas e valor, e ações de adicionar/editar/excluir lançamento manualmente (exclusão com confirmação).

### 4. PDF do histórico
- Novo botão "PDF do Histórico" gera um relatório cronológico com Data, Funcionalidade, Descrição detalhada, Horas e Valor, com subtotais por mês e total geral.
- Em **ambos** os PDFs (o atual e o novo), quando o valor/hora estiver zerado, as colunas e totais de valor são omitidos — sai apenas Funcionalidade, Descrição e Horas.

### 5. Registro automático das ações de desenvolvimento
- Fica registrado como regra permanente do projeto: a cada ação minha que envolva desenvolvimento (nova funcionalidade, correção, ajuste, atualização), eu insiro um lançamento no histórico com data, sistema, título, descrição detalhada e horas estimadas de desenvolvimento.
- Também atualizo o registro consolidado (aba por sistema) quando a ação criar ou alterar uma funcionalidade já listada.
- Essa regra é gravada na memória do projeto para valer em todas as sessões futuras.

## Detalhes técnicos

- Nova tabela `public.dev_tracker_log`: `id`, `occurred_on` (date), `system_name`, `title`, `description`, `change_type`, `hours numeric`, `created_at`, `updated_at` + trigger de `updated_at`.
- GRANTs para `authenticated` e `service_role`; RLS habilitada com política única baseada em `auth.jwt() ->> 'email' = 'brunumorais@gmail.com'`.
- Mesma política aplicada em `public.dev_tracker` (substituindo a atual `is_admin_or_super`).
- Frontend: `src/pages/DevTracker.tsx` passa a validar por e-mail (via `supabase.auth.getUser()`), ganha a aba Histórico e o segundo gerador de PDF; a montagem das colunas de valor no jsPDF fica condicionada a `hourlyRate > 0`.
- Novo hook `src/hooks/useDevTrackerLog.ts` para CRUD do histórico.
- Link no sidebar: `src/components/AppSidebar.tsx` e demais sidebars de módulo (ou apenas na tela de seleção de sistemas, conforme resposta abaixo), com visibilidade condicionada ao e-mail.
- Nenhuma alteração em permissões de outros módulos.
