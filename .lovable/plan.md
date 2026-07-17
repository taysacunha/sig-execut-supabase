## Por que o cron chama via HTTP?

Rápido esclarecimento antes do plano: `pg_cron` roda **dentro do Postgres** e só sabe executar SQL. Ele não consegue "chamar" uma Edge Function diretamente porque Edge Functions rodam em outro runtime (Deno, fora do banco). A ponte entre os dois é o `pg_net`, que faz uma requisição HTTP de dentro do SQL. Ou seja: o "gatilho" é 100% interno (Postgres → Postgres via extensão), mas o "trabalho pesado" (gerar ocorrências, criar notificações, marcar atrasos) mora na Edge Function, que precisa ser acionada por HTTP porque é assim que Edge Functions são invocadas no Supabase. Não há exposição externa: a chamada sai do banco e volta pro mesmo projeto Supabase.

Alternativa se quiser evitar HTTP: mover toda a lógica do scheduler para uma função PL/pgSQL e o cron chama direto via `SELECT despesas_rodar_scheduler();`. Vantagem: sem `pg_net`, sem HTTP. Desvantagem: perde flexibilidade (logs estruturados, testes locais, reaproveitar código TS). Posso fazer essa migração se preferir — só me avise.

---

## Plano — Pendências do módulo Despesas

Ordem sugerida (da que mais destrava uso multi-usuário para a mais cosmética):

### 1. UI de Permissões por Aba (admin)

Já existe `src/pages/despesas/DespesasPermissoes.tsx` implementado com grid usuário × aba (Calendário, Imóveis, Repasses, Cadastros) e níveis Sem acesso / Visualizar / Editar / Excluir, além de restrição por centro de custo. Falta:

- Registrar rota `/despesas/permissoes` em `src/App.tsx` protegida por `RoleGuard` (admin/super_admin).
- Adicionar item "Permissões" no `DespesasSidebar.tsx` visível só para admin.
- Adicionar abas faltantes no grid: **Veículos**, **Recorrências**, **Notificações**, **Auditoria** (o enum `despesas_aba` no banco já suporta ou precisa `ALTER TYPE ADD VALUE` — verificar e migrar se necessário).
- Guards de rota: nas páginas `DespesasImoveis`, `DespesasRepasses`, `DespesasCadastros`, `DespesasCalendario`, `DespesasRecorrencias`, `DespesasNotificacoes` usar `useDespesasPermissions().podeVer(aba)` para redirect/AccessDenied.
- Ocultar itens do sidebar conforme `podeVer`.

### 2. Página de Auditoria

Já existe `src/pages/despesas/DespesasAuditLogs.tsx` reaproveitando `AuditLogsPanel`. Falta:

- Registrar rota `/despesas/auditoria` em `App.tsx`.
- Adicionar item no `DespesasSidebar.tsx` (restrito a admin ou a quem tem `podeVer('auditoria')`).
- Confirmar que `AuditLogsPanel` aceita `defaultModule="despesas"` (o valor já é passado com cast; validar que o filtro do painel reconhece esse módulo — se não, adicionar às opções do enum interno do painel).

### 3. Polish do Calendário — filtro por série

- No `DespesasCalendario.tsx`, ao clicar no badge de recorrência de uma linha, aplicar filtro `serie_recorrencia_id = X` e exibir chip removível "Filtrando série: [descrição]".
- Adicionar botão "Ver todas ocorrências desta série" no `RecorrenciaBlock` / listagem de recorrências que navega para o calendário com o filtro pré-aplicado (querystring `?serie=<id>`).

### 4. Relatórios / Dashboard consolidado

Nova página `/despesas/relatorios` (ou expandir `DespesasDashboard`) com:

- **KPIs do período**: total previsto, total pago, em aberto, atrasado, % inadimplência.
- **Curva mensal** (bar/line chart via `recharts`): previsto vs pago por mês nos últimos 12 meses.
- **Por centro de custo**: barra horizontal com top centros de custo por valor pago.
- **Top fornecedores/pessoas**: tabela com valor pago no período.
- **Repasses**: total previsto, liquidado, pendente por proprietário; alerta de repasses vencidos.
- Filtros globais: período (date range), centro de custo, categoria, status.
- Fonte: queries agregadas em `despesas_lancamentos` + `despesas_lancamento_pagamentos` + `despesas_repasses` (respeitando RLS existente — nenhuma nova policy necessária).

### 5. Exportação CSV/XLSX

- Reaproveitar `src/lib/exportUtils.ts` (já usa `xlsx`).
- Botão `ExportButton` em: `DespesasCalendario` (lançamentos filtrados), `DespesasRepasses` (repasses + itens), `DespesasRecorrencias` (séries ativas), relatórios.
- Novos formatters em `exportUtils.ts` para cada entidade (colunas em PT-BR, datas formatadas, valores em `pt-BR`).

### 6. (Opcional, se pedir) Anexos/comprovantes

Fora deste plano — envolve criar bucket `despesas-anexos`, policies de Storage e UI de upload. Posso propor separado quando quiser.

---

## Detalhes técnicos

**Novas rotas em `src/App.tsx**` (dentro do `DespesasLayout`):

```
/despesas/permissoes   → DespesasPermissoes   (RoleGuard admin)
/despesas/auditoria    → DespesasAuditLogs    (podeVer('auditoria') || admin)
/despesas/relatorios   → DespesasRelatorios   (novo, podeVer('relatorios') ou herdar calendário)
```

**Migration única** (se abas novas precisarem entrar no enum):

```sql
ALTER TYPE despesas_aba ADD VALUE IF NOT EXISTS 'veiculos';
ALTER TYPE despesas_aba ADD VALUE IF NOT EXISTS 'recorrencias';
ALTER TYPE despesas_aba ADD VALUE IF NOT EXISTS 'notificacoes';
ALTER TYPE despesas_aba ADD VALUE IF NOT EXISTS 'auditoria';
ALTER TYPE despesas_aba ADD VALUE IF NOT EXISTS 'relatorios';
```

Verificar antes se o tipo é enum ou text — ajustar constante `ABAS` do `DespesasPermissoes.tsx` acordemente.

**Sidebar**: usar `useDespesasPermissions` para renderização condicional de cada item, exatamente como já é feito no Estoque.

**Sem novos secrets**, sem novas edge functions, sem mudanças de RLS além do enum acima.

---

## Ordem de entrega e ponto de parada

Sugestão de entregar em 2 blocos para você validar entre eles:

- **Bloco A** (destrava operação): itens 1, 2, 3.
- **Bloco B** (analítico): itens 4 e 5.

Confirma se quer nessa ordem, ou prefere priorizar Relatórios/Exportação antes de Permissões? Pode seguir com os dois blocos.  
  
Sobre isso: Rápido esclarecimento antes do plano: `pg_cron` roda **dentro do Postgres** e só sabe executar SQL. Ele não consegue "chamar" uma Edge Function diretamente porque Edge Functions rodam em outro runtime (Deno, fora do banco). A ponte entre os dois é o `pg_net`, que faz uma requisição HTTP de dentro do SQL. Ou seja: o "gatilho" é 100% interno (Postgres → Postgres via extensão), mas o "trabalho pesado" (gerar ocorrências, criar notificações, marcar atrasos) mora na Edge Function, que precisa ser acionada por HTTP porque é assim que Edge Functions são invocadas no Supabase. Não há exposição externa: a chamada sai do banco e volta pro mesmo projeto Supabase.

Alternativa se quiser evitar HTTP: mover toda a lógica do scheduler para uma função PL/pgSQL e o cron chama direto via `SELECT despesas_rodar_scheduler();`. Vantagem: sem `pg_net`, sem HTTP. Desvantagem: perde flexibilidade (logs estruturados, testes locais, reaproveitar código TS). Posso fazer essa migração se preferir — só me avise.  
  
Entendi. E depois de fazer o plano dos dois blocos quero que você me instrua de como fazer exatamente isso, pois não estou sabendo.

&nbsp;