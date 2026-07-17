# Fase 4 — Recorrências, notificações, duplicidade avançada e auditoria

Fecha o módulo Despesas automatizando as regras que sobraram do escopo original. As Fases 1–3 já entregaram calendário, imóveis, veículos, repasses e a matriz de permissões por aba (`despesas_aba_permissoes`) — que é exatamente o modelo "usuário X vê aba Y" que você reforçou, no mesmo padrão do Estoque; nesta fase só a consumimos.

## 1. Recorrências de lançamentos

Tabela `despesas_recorrencias` com os campos que definem a série:
`tipo` (mensal | anual | fixa_meses | intercalada), `data_inicio`, `data_fim` (null = indefinida), `dia_vencimento`, `meses_fixos` (int[] para "fixa"/"intercalada"), `janela_geracao_meses` (default 12) e todo o template do lançamento (tipo, valor, descrição, categoria, subcategoria, plano, centro, conta bancária, pessoa, imóvel, perfil de acesso, forma de pagamento padrão).

Coluna nova em `despesas_lancamentos`:
- `serie_recorrencia_id uuid null references despesas_recorrencias(id) on delete set null`
- `is_manual boolean default false` — marca lançamentos editados individualmente para não serem sobrescritos por regeneração.

Função `despesas_gerar_ocorrencias(_serie uuid, _ate date)`:
- Percorre a série do último vencimento gerado até `_ate` (default `now() + janela_geracao_meses`).
- Insere lançamentos com `serie_recorrencia_id`, status `a_vencer`, respeitando `is_manual` (não recria uma ocorrência já existente na mesma data).
- Idempotente: `on conflict do nothing` por `(serie_recorrencia_id, data_vencimento)`.

Trigger `after insert` em `despesas_recorrencias` chama a função com a janela padrão.

Edge function `despesas-gerar-recorrencias` (rodar diariamente via `pg_cron`): itera todas as séries ativas e chama a RPC. Cron agendado via `supabase--insert` (não migration).

Regras de edição:
- Editar/excluir uma ocorrência individual não afeta a série e marca `is_manual = true`.
- Editar a série abre AlertDialog com opções "só esta ocorrência" vs "esta e futuras" vs "toda a série" (regenera destruindo ocorrências futuras que não sejam `is_manual`).

Frontend:
- Em `LancamentoDialog`, novo bloco "Recorrência" (checkbox "Recorrente" + tipo + dia + fim). Ao salvar, cria a série e a primeira ocorrência.
- Ícone de "série" na tabela do calendário para lançamentos com `serie_recorrencia_id`.
- Nova página `/despesas/recorrencias` (dentro da aba Calendário, sub-tab): lista as séries ativas, permite pausar/reativar/editar/excluir a série toda.

## 2. Notificações

Novas tabelas:
- `despesas_notificacoes_preferencias`: `user_id pk`, `dias_antecedencia int[] default '{7,1}'`, `notificar_vencidos bool default true`, `notificar_pagos bool default false`.
- `despesas_notificacoes`: `id`, `user_id`, `lancamento_id`, `tipo` (proximidade | vencido | pago | cancelado), `dias_para_vencer`, `lida bool default false`, `created_at`.

Regras:
- Índice único parcial por `(user_id, lancamento_id, tipo, dias_para_vencer)` para evitar duplicatas.
- RLS: cada usuário só vê as próprias notificações; INSERT feito por edge function via service_role.

Job diário `despesas-notificar-vencimentos` (edge function + cron):
- Para cada preferência ativa, cruza com a view `despesas_lancamentos_visiveis` **por usuário** (respeita aba + centros permitidos + público/privado) e insere linhas em `despesas_notificacoes`.
- Atualiza status `a_vencer → vencido` quando `data_vencimento < today`.

Frontend:
- Sino no header do `DespesasLayout` (padrão do `useEstoqueNotificacoes`) com contador de não lidas, popover com últimas 10 e link "ver todas".
- Nova página `/despesas/notificacoes` com lista completa + marcar como lida / marcar todas.
- Seção "Notificações" em `/despesas/perfil` para editar preferências (multi-select dos dias, toggles).

## 3. Duplicidade avançada

Sobe a validação simples da Fase 2 para uma RPC:
`despesas_detectar_duplicidades(_lancamento jsonb, _janela_dias int default 3)` que retorna os candidatos comparando `valor + imovel_id/pessoa_id + centro_custo_id + plano_conta_id + conta_imobiliaria_id` dentro da janela e status ≠ cancelado.

No `LancamentoDialog`:
- Ao clicar Salvar, chama a RPC antes do insert.
- Se houver candidatos, abre AlertDialog listando cada um com link "abrir existente" (fecha o dialog atual e reabre no lançamento clicado) e botões "Cancelar" / "Salvar mesmo assim".
- Janela configurável via input no próprio dialog (default 3 dias).

## 4. Auditoria e polish

- `/despesas/auditoria`: reaproveita `AuditLogsPanel` filtrado por `module_name='despesas'`, com filtros extras por aba (tabela → aba) e por usuário. Já temos triggers gravando em `module_audit_logs` desde a Fase 1.
- Adiciona nas colunas da tabela do calendário: "criado por", "editado por", "pagamento confirmado por" (join com `user_profiles`), controlados por um toggle "Mostrar auditoria".
- `/despesas/ajuda`: página estática em PT-BR com passo a passo por aba (mesmo padrão da ajuda do Estoque).
- Atualização de `dev_tracker` com todas as entregas da Fase 4.

## Detalhes técnicos

Migração `db/migrations/20260719120000_despesas_fase4.sql` cria/altera nesta ordem:
1. `despesas_recorrencias` + GRANTs + RLS (helpers `despesas_pode_*_aba('calendario', ...)`).
2. `ALTER TABLE despesas_lancamentos ADD COLUMN serie_recorrencia_id`, `is_manual` + índice.
3. `despesas_notificacoes_preferencias`, `despesas_notificacoes` + GRANTs + RLS por `user_id = auth.uid()`.
4. Funções: `despesas_gerar_ocorrencias`, `despesas_detectar_duplicidades`, `despesas_marcar_vencidos`.
5. Trigger `after insert` em `despesas_recorrencias`.
6. Extensão da função de auditoria para as novas tabelas (segue padrão do bloco `CASE table_name`).

Cron/pg_net agendados via `supabase--insert` (contém URL e anon key, portanto não vai para migration):
- `despesas-gerar-recorrencias` — diário 03:00.
- `despesas-notificar-vencimentos` — diário 06:00.

Novos componentes/hooks:
- `src/hooks/useDespesasRecorrencias.ts`, `useDespesasNotificacoes.ts`, `useDespesasDuplicidades.ts`.
- `src/components/despesas/RecorrenciaBlock.tsx` (dentro do `LancamentoDialog`), `DuplicidadeAlert.tsx`, `NotificacoesBell.tsx`.
- Páginas: `src/pages/despesas/DespesasRecorrencias.tsx`, `DespesasNotificacoes.tsx`, `DespesasAuditoria.tsx`, `DespesasPerfil.tsx` (upgrade), `DespesasAjuda.tsx`.

Sem hardcode de cores — badges via `variant`, cores via tokens `--primary`/`--destructive`/`--muted`. Toda UI e toasts em PT-BR. Exclusões críticas (série, preferência) protegidas por `AlertDialog`.

Sobre permissões por aba: nada muda no schema — o `useDespesasPermissions()` já entrega `podeVer/podeEditar/podeExcluir` por aba e a tela `/despesas/permissoes` já expõe a matriz por usuário. As novas rotas (`recorrencias`, `notificacoes`, `auditoria`, `ajuda`) reutilizam a permissão da aba pai correspondente (`calendario` para as duas primeiras, admin-only para auditoria, aberta para ajuda).

## Ordem de execução sugerida

1. Migration Fase 4 + GRANTs + RLS.
2. Hooks e componentes de recorrência + integração no `LancamentoDialog`.
3. Duplicidade avançada (RPC + AlertDialog).
4. Notificações (tabelas, edge functions, sino, página de preferências).
5. Auditoria e ajuda.
6. Cron via `supabase--insert`.
7. Atualização do `dev_tracker`.
