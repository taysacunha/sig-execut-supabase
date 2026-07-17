# Módulo Gestão de Despesas — Plano em Fases

Novo módulo `/despesas` no mesmo padrão dos módulos existentes (Escalas, Vendas, Férias, Estoque): rota base + layout próprio + `DespesasSidebar` + `SystemGuard` com `system="despesas"`. Todas as tabelas em `public.despesas_*` com o padrão do projeto (GRANTs explícitos, RLS via `can_view_system`/`can_edit_system('despesas')`, triggers de auditoria em `module_audit_logs`, `updated_at`, PT-BR, AlertDialog para exclusões críticas).

O plano abaixo é a versão consolidada. Cada fase é entregável de forma independente — implementamos uma por vez, você valida, seguimos.

---

## Fase 1 — Fundação, permissões e navegação

**Objetivo:** deixar o módulo acessível, com menu, guards, cadastros auxiliares mínimos e a matriz de permissões pronta antes de abrir qualquer formulário financeiro.

**Banco (migração):**

- Estender enum `system_name` (ou o valor de texto usado hoje em `system_access`) com `'despesas'`. `system_access` continua sendo a fonte única de "vê o módulo" + `permission_type` (`view_only`/`view_edit`), consistente com os demais módulos.
- Nova tabela `despesas_aba_permissoes` — nível 1 (por aba): `user_id`, `aba` (`calendario`|`imoveis`|`repasses`|`cadastros`), `nivel` (`sem_acesso`|`view`|`edit`|`delete`). Uma linha por usuário/aba. Default para usuário com acesso ao módulo mas sem linha específica = `view` na aba `calendario`, `sem_acesso` nas demais (definido em helper SQL).
- Nova tabela `despesas_centros_custo_permissoes` — nível 2 (por centro de custo): `user_id`, `centro_custo_id`. Regra: se o usuário tem pelo menos uma linha, os SELECTs de lançamentos são filtrados por ela; se não tem nenhuma, enxerga todos os centros permitidos pela aba.
- Nível 3 (Público/Privado) fica como coluna `acesso` no próprio lançamento (Fase 2) + `perfil_acesso_id` para restringir "privado".
- Cadastros auxiliares base (schema completo, telas de gestão nesta fase):
  - `despesas_centros_custo` (nome, ativo)
  - `despesas_planos_conta` (nome, tipo pagar/receber, ativo)
  - `despesas_subcategorias` (plano_id, nome, ativo)
  - `despesas_categorias` (nome, ativo) — categorias amplas (IPTU, Condomínio, Aluguel, etc.)
  - `despesas_contas_bancarias` (nome — "Execut", "Ocean"…, banco, agência, conta, centro_custo_id, ativo)
  - `despesas_perfis_acesso` (nome, descricao) — usado no campo "Perfil de acesso" do formulário
  - `despesas_pessoas` (tipo pessoa/empresa, nome, cpf_cnpj, oab, creci, papel proprietario/locatario/fornecedor/motorista, ativo)
  - `despesas_veiculos` (modelo, placa, data_aquisicao, nota_fiscal, motorista_id, proprietario_id, data_venda, comprador_id, ativo)
- Funções SQL:
  - `despesas_nivel_aba(_user_id, _aba)` — retorna `text` (`sem_acesso`/`view`/`edit`/`delete`).
  - `despesas_pode_ver_aba/editar_aba/excluir_aba(_user_id, _aba)` — booleans que as políticas RLS consomem.
  - `despesas_centros_permitidos(_user_id) returns setof uuid`.
- RLS: policies padrão em todas as tabelas usando os helpers acima. GRANTs para `authenticated`/`service_role`.
- Triggers `audit_module_changes` com `v_module_name := 'despesas'` para todas as tabelas do módulo.

**Frontend:**

- `src/layouts/DespesasLayout.tsx`, `src/components/DespesasSidebar.tsx`, rotas `/despesas`, `/despesas/calendario`, `/despesas/imoveis`, `/despesas/repasses`, `/despesas/cadastros`, `/despesas/permissoes`, `/despesas/perfil`, `/despesas/usuarios`, `/despesas/auditoria`, `/despesas/ajuda`, todos dentro de `SystemGuard system="despesas"`.
- Card "Despesas" na `SelectSystem`.
- Hook `useDespesasPermissions()` que carrega o nível por aba do usuário logado, e o sidebar oculta abas com nível `sem_acesso` (regra do prompt: "não vê nem a aba").
- Página `/despesas/permissoes` (só admins): matriz usuários × 4 abas com dropdown de nível, mais lista de centros de custo permitidos por usuário. Reaproveita padrão da tela de UserManagement.
- Página `/despesas/cadastros` com abas internas: Categorias, Centros de custo, Planos de conta + Subcategorias, Contas bancárias, Perfis de acesso, Pessoas, Veículos. CRUD padrão com AlertDialog nas exclusões.
- Componente reutilizável `<ComboboxCriar>` (combobox pesquisável com opção "+ Adicionar '[texto]'" que insere na tabela auxiliar correspondente e retorna o id). Respeita permissão de edição do cadastro auxiliar alvo. Usado em toda Fase 2/3/4.

**Fora desta fase:** formulário Conta a Pagar/Receber, recorrências, notificações, PDFs.

---

## Fase 2 — Aba Calendário de Despesas + formulário Conta a Pagar/Receber

**Objetivo:** entregar o coração do módulo: lançamento avulso funcional, listagem, filtros, exportação e o formulário multi-forma-de-pagamento fiel aos prints do GIMOB.

**Banco:**

- `despesas_lancamentos` (base do formulário DADOS GERAIS): `id`, `codigo` (serial exibido), `tipo` (`pagar`|`receber`), `perfil_acesso_id`, `status` (`a_vencer`|`pago`|`vencido`|`cancelado`|`agendado`|`quitado`), `acesso` (`publico`|`privado`), `valor`, `data_vencimento`, `data_pagamento`, `descricao`, `numero_pasta`, `conta_imobiliaria_id` (→ contas_bancarias), `cod_venda`, `imovel_id` (nullable até Fase 3; texto livre até lá), `pessoa_id`, `centro_custo_id`, `plano_conta_id`, `subcategoria_id`, `categoria_id`, `observacao`, `serie_recorrencia_id` (nullable, Fase 4), `criado_por`, `pago_confirmado_por`, `created_at`, `updated_at`.
- `despesas_lancamento_pagamentos` (a tabela "Forma de pagamento" com botão Adicionar do print): `id`, `lancamento_id`, `forma` (`boleto_debito`|`cheque`|`deposito_transferencia`|`especie`|`pix`), `valor`, e campos condicionais de cheque quando `forma='cheque'`: `cheque_conta_imobiliaria_id`, `cheque_nominal`, `cheque_bom_para`, `cheque_cod_identificacao`, `cheque_numero`, `cheque_status` (`preenchido`|`emitido`|`compensado`|`cancelado`). Constraint: `SUM(valor) do lancamento = despesas_lancamentos.valor` (validado no client + trigger).
- View `despesas_lancamentos_visiveis` que aplica os 3 níveis de acesso (aba `calendario`, centros permitidos, público/privado por `perfil_acesso_id`) via `security_invoker` + policies.
- RPC `get_despesas_dashboard_stats(mes text)` → total pendente, total pago no mês, próximos 7 dias.

**Frontend `/despesas/calendario`:**

- Header com 3 KPI cards (total pendente, total pago no mês, próximos vencimentos) + botão "Nova Conta a Pagar/Receber".
- Tabela paginada com filtros (período, status, tipo, categoria, centro de custo, conta bancária, imóvel, texto livre), colunas: código, tipo, vencimento, descrição, imóvel/pessoa, valor, forma pagto (badge), status. Ações por linha: ver, editar, confirmar pagamento, cancelar, excluir — cada uma condicionada ao nível na aba.
- `ExportButton` reaproveitado (Excel) com o filtro atual.
- **Dialog `LancamentoDialog**` — reproduz os dois cards do print (fiel ao GIMOB):
  1. **DADOS GERAIS**: Tipo (radio Pagar/Receber com legenda "Pagar = imobiliária paga / Receber = imobiliária recebe"), Perfil acesso (combobox), Status, Acesso (radio Público/Privado), Valor (com sugestões de valores recentes como no print — autocomplete numérico), Data vencimento, Nº cópias (gera N lançamentos irmãos com vencimentos incrementados por 1 mês; default 1), Descrição, Nº pasta, Cód venda, Cód imóvel, Pessoa, Centro de custo, Plano de contas, Subcategoria (filtra por plano).
  2. **SELECIONE A FORMA DE PAGAMENTO**: radios com as 5 formas. Ao escolher `Cheque`, expande os campos (Conta da imobiliária, Nominal, Bom para, Valor, Cód identificação, Número, Status cheque). Botão **Adicionar** insere na tabela "Forma de pagamento / Dados complementares / Valor" abaixo — permite múltiplas linhas somando o valor total. Validação: soma tem que fechar com Valor.
  - Todos os selects são `<ComboboxCriar>` (criam categoria/subcategoria/pessoa/centro/conta on-the-fly, respeitando permissão).
  - Botões Salvar / Fechar como no print (verde/vermelho, mas usando tokens semânticos do design system, não cores hardcoded).
- Alerta simples de possível duplicidade nesta fase: ao abrir Salvar, se existir lançamento com mesmo `valor + imovel_id/pessoa_id + vencimento ±3 dias`, exibe AlertDialog "Possível duplicidade encontrada. Deseja continuar?".

**Fora desta fase:** recorrência automática mensal/anual/fixa (Fase 4), notificações, edição de ocorrência isolada de série.

---

## Fase 3 — Aba Imóveis (IPTU/TCR/SPU) + Aba Repasses de Aluguel

**Objetivo:** entregar as duas abas de negócio específico da imobiliária, já plugadas ao Calendário via `imovel_id` e `pessoa_id`.

**Banco:**

- `despesas_imoveis`: registro, inscricao_iptu, rip_spu, endereco, quadra_lote, proprietario_id (→ pessoas), valor_iptu, valor_tcr, situacao (`alugado`|`vendendo`|`vendido`|`para_alugar`|`em_locacao`|`em_venda`|`temporada`), garantia_tipo (`valores`|`seguro`|`fiador`), garantia_detalhe, responsavel_pagamento (`proprietario`|`locatario`), ativo_no_controle (bool — "ativar/desativar caso volte a ser alugado"), observacao.
- `despesas_imoveis_situacao_historico`: imovel_id, situacao_anterior, situacao_nova, data, alterado_por — trigger grava a cada UPDATE de situação.
- `despesas_repasses`: mes_referencia (yyyy-mm), imovel_id, locatario_id, proprietario_id, valor_aluguel, valor_multa_juros, taxa_adm_percentual, taxa_adm_valor, valor_repassado (calculado), data_repasse, valor_limite_alerta, status (`pendente`|`repassado`).
- `despesas_repasse_creditos` (linhas): repasse_id, categoria_id, descricao, valor.
- `despesas_repasse_debitos` (linhas): repasse_id, categoria_id, descricao, valor.
- Trigger que recalcula `valor_repassado = aluguel + multa_juros + Σcréditos − Σdébitos − taxa_adm_valor` em cada change.
- RPCs de relatório: `get_repasses_por_proprietario(mes, cpf_cnpj)`, `get_repasses_por_locatario(mes, cpf_cnpj)`, `get_imoveis_por_situacao()`.

**Frontend `/despesas/imoveis`:**

- Tabela de imóveis com filtros (situação, responsável de pagamento, proprietário). Colunas: registro, endereço, proprietário, IPTU, TCR, situação (badge), ativo. Toggle "ativo no controle" na linha (AlertDialog).
- `ImovelDialog` com dados cadastrais + garantia. Aba "Histórico de situação" no dialog de visualização.
- Relatório PDF/Excel: alugados × não alugados × vendidos.

**Frontend `/despesas/repasses`:**

- Filtros: mês, proprietário, locatário, status.
- Tabela mensal com valor líquido calculado.
- `RepasseDialog` com header (imóvel, locatário, mês, aluguel, multa/juros, taxa adm) + duas seções em linhas editáveis: **Outros Créditos** e **Outros Débitos** (combobox de categoria + descrição + valor, botão "+ adicionar linha"). Campo `valor_repassado` readonly (calculado ao vivo) e `valor_limite_alerta` com badge visual quando ultrapassado.
- Exportação PDF por proprietário e por locatário, mês a mês.

---

## Fase 4 — Recorrências, notificações, duplicidade avançada e polish de auditoria

**Objetivo:** automatizar as regras que o prompt exige após o núcleo estar sólido.

**Recorrências:**

- Nova tabela `despesas_recorrencias`: tipo (`mensal`|`anual`|`fixa`|`intercalada`), data_inicio, data_fim (nullable = indefinido), dia_vencimento, template completo do lançamento (valor, categoria, imovel, pessoa, forma_pagto_padrão…).
- Edge function `despesas-gerar-recorrencias` (cron diário via `pg_cron` ou trigger em INSERT/UPDATE): gera lançamentos futuros da série até janela de 12 meses e vincula em `serie_recorrencia_id`. Editar/excluir apenas uma ocorrência não afeta a série; editar a série oferece opção "esta e futuras" vs "só esta". `is_manual` marca ocorrências editadas para não serem sobrescritas.

**Notificações:**

- Tabela `despesas_notificacoes_preferencias`: user_id, dias_antecedencia int[] (default `{7,1}`), canal (`sistema`). Editável em `/despesas/perfil` → seção Notificações.
- Tabela `despesas_notificacoes`: user_id, lancamento_id, tipo (`proximidade`|`vencido`), lida, created_at. Populada por edge function diária que respeita a view `despesas_lancamentos_visiveis` (usuário só recebe notificação do que ele pode ver — aba + centro + público/privado).
- Job diário atualiza status `a_vencer` → `vencido` quando `data_vencimento < today AND status = 'a_vencer'`.
- Sino no header do layout com contador de não lidas (reaproveita o padrão de `useEstoqueNotificacoes`).

**Duplicidade avançada:**

- Regra da Fase 2 expandida: também compara `conta_bancaria_id`, `plano_conta_id` e janela configurável.
- Modal mostra os lançamentos candidatos com link "abrir existente".

**Auditoria & polish:**

- `/despesas/auditoria` reaproveita `AuditLogsPanel` filtrado por `module_name='despesas'`. Confere que criador, editor e quem confirmou pagamento aparecem por linha do calendário.
- `/despesas/ajuda` com o passo a passo do módulo.
- Testes manuais de matriz de permissão (usuário sem aba não vê, usuário só de "Ocean" não vê "Execut", lançamento privado escondido de perfis diferentes).

---

## Detalhes técnicos (para o dev)

```text
Rotas
/despesas
 ├─ index (dashboard com KPIs + últimos lançamentos)
 ├─ /calendario     [Fase 2]
 ├─ /imoveis        [Fase 3]
 ├─ /repasses       [Fase 3]
 ├─ /cadastros      [Fase 1] (sub-tabs: categorias, centros, planos, contas, perfis, pessoas, veículos)
 ├─ /permissoes     [Fase 1] (admin: matriz + centros por usuário)
 ├─ /perfil         [Fase 1 stub, Fase 4 preferências de notificação]
 ├─ /usuarios       [reaproveita UserManagement]
 ├─ /auditoria      [Fase 4]
 └─ /ajuda          [Fase 4]
```

- **Padrão de acesso**: cada policy do módulo chama `despesas_pode_ver_aba(auth.uid(),'calendario')` etc. Nada de lógica de permissão duplicada no client — o client apenas esconde UI baseando-se em `useDespesasPermissions()`.
- **Combobox pesquisável com criação rápida**: componente único em `src/components/despesas/ComboboxCriar.tsx`, aceita `tabela`, `campoLabel`, `permissaoCriar`. Cria via insert direto no Supabase (respeitando RLS de edição do cadastro auxiliar).
- **Sem hardcode de cores**: tudo via tokens `--primary`, `--destructive`, `--muted`, badges com `variant`. O verde/vermelho do GIMOB é referência visual; usamos os tokens do projeto.
- **Reuso**: `ExportButton`, `AuditLogsPanel`, `RoleGuard`, `SystemGuard`, `ProtectedRoute`, `useDebounceSearch`, `usePagination`, `TableControls`.
- **PT-BR** em toda a UI, mensagens de toast, textos de AlertDialog.

## Dentro desse plano quero que você entenda que, parecido como é no sistema de estoque, quero poder escolher qual usuário vai ver ou editar cada aba desse módulo. Entende? Tipo o usuário 1 vai poder ver a aba de iptu. O usuário 2 pode ver a aba de veículos. Hoje eu só habilito se os usuários podem ver ou editar cada módulo, mas nesse módulo de despesas preciso que funcione assim.