## Status atual

Fases 1 a 4 do módulo Despesas estão com backend (migrations) e frontend implementados. Falta apenas ativar os automatismos operacionais e revisar pontas soltas antes de considerar o módulo "pronto para produção".

## O que ainda falta

### 1. Geração automática de ocorrências e notificações (cron)
Hoje `despesas_gerar_ocorrencias` e a criação de notificações de vencimento existem como RPC/funções, mas só rodam se alguém disparar manualmente. Precisamos:
- Criar edge function `despesas-scheduler` que:
  - Chama `despesas_gerar_ocorrencias` para todas as séries ativas (horizonte de 90 dias).
  - Varre `despesas_lancamentos` com vencimento próximo e insere em `despesas_notificacoes` respeitando `despesas_notificacoes_preferencias`.
  - Marca lançamentos vencidos como `atrasado`.
- Agendar via `pg_cron` diariamente (06:00 BRT).

### 2. Tela de permissões por aba (Despesas)
A tabela `despesas_aba_permissoes` existe, mas ainda não há UI para o admin configurar quem vê/edita cada aba (Calendário, Imóveis, Veículos, Repasses, Recorrências, Cadastros, Auditoria). Plano:
- Nova aba "Permissões" dentro de `/despesas/cadastros` (ou página `/despesas/permissoes`) restrita a admins.
- Grid usuário × aba com toggles Ver / Editar, similar ao padrão do Estoque.
- Hook `useDespesasAbaPermissoes` + guards nas rotas/sidebar para ocultar abas sem permissão.

### 3. Página de Auditoria
`module_audit_logs` já grava eventos de todas as tabelas do módulo, mas não há tela dedicada. Plano:
- Página `/despesas/auditoria` com filtros por tabela, usuário, ação e período.
- Exibir diff antes/depois quando aplicável.

### 4. Ajustes finos no Calendário
- Colunas "Criado por" / "Editado por" na listagem de lançamentos (dados já existem em `module_audit_logs`).
- Badge visual para lançamentos originados de série (`serie_recorrencia_id not null`) com link para a série.
- Ação rápida "Pular esta ocorrência" e "Encerrar série a partir daqui".

### 5. Página de Ajuda (PT-BR)
Rota `/despesas/ajuda` com explicações curtas de cada aba, fluxo de recorrências, notificações e permissões.

### 6. Validações finais
- Testar RLS com um usuário não-admin com permissão parcial (ex.: só Veículos).
- Confirmar que o sino de notificações atualiza em tempo real (Realtime na tabela `despesas_notificacoes`).
- Conferir que `despesas_detectar_duplicidades` não bloqueia salvar, apenas alerta.

## Ordem sugerida de execução

1. Permissões por aba (destrava o uso multi-usuário).
2. Página de Auditoria (visibilidade de mudanças).
3. Edge function + cron de ocorrências/notificações.
4. Ajustes finos no Calendário.
5. Página de Ajuda.
6. QA final com usuário de teste.

## Detalhes técnicos

- Migration adicional só será necessária para: (a) `ALTER PUBLICATION supabase_realtime ADD TABLE public.despesas_notificacoes;` e (b) `cron.schedule` do scheduler (usa dados sensíveis, então roda via ferramenta de insert do Supabase, não migration).
- Edge function usa `SUPABASE_SERVICE_ROLE_KEY` internamente; nenhum secret novo precisa ser adicionado.
- Guards de permissão reaproveitam o padrão de `can_view_system` / `can_edit_system` combinados com `despesas_aba_permissoes`.

Confirme se quer que eu siga nessa ordem ou prefere priorizar algo específico (ex.: cron primeiro).