## Refazer página de Auditoria

Reescrever `src/components/AuditLogsPanel.tsx` para funcionar como uma auditoria de verdade: ver tudo o que cada usuário fez, em qual campo/registro, com busca livre e detalhes legíveis.

### O que sai

- Coluna "Registro / Campos" (a linha que mostra só o nome do registro + lista de nomes de campos truncados — confusa e inútil).
- Seletor "Carregar últimos" (200/500/1000…) — não vai mais existir.
- Filtros de data "De / Até" no topo — não foram pedidos e estão poluindo a barra. (Se você quiser manter, me diga.)

### O que entra

**Tabela única de "Alterações nos Módulos" (uma linha por log)**, colunas:

1. Data/Hora
2. Usuário (nome + email; busca por nome funciona)
3. Ação (badge: Inseriu / Atualizou / Removeu)
4. Módulo
5. Tabela (rótulo amigável: Colaboradores, Férias, Folgas…)
6. Registro (nome do colaborador / data do sábado / etc. — extraído de `new_data`/`old_data`)
7. Resumo da alteração (ex.: "Atualizou Status, Nome" — só os rótulos legíveis dos campos mudados)
8. Seta para expandir

**Busca única (server-side)** — um único campo "Buscar por nome de usuário, ação, campo ou conteúdo…":
- nome/email do usuário (`changed_by_email` + join com `profiles` para nome)
- palavra-chave de ação ("inseriu", "alterou", "removeu" → INSERT/UPDATE/DELETE)
- nome de campo (ex. "status", "nome")
- conteúdo de qualquer campo (busca dentro de `old_data`/`new_data` via `ilike` em texto JSON)
- nome do registro (ex. "Pedro")

A busca usa debounce (300ms) e roda no Supabase com `.or(...)` sobre `changed_by_email`, `table_name`, `action` e `cast(new_data as text) ilike` / `cast(old_data as text) ilike`.

**Sem limite artificial — paginação real no servidor:**
- `range(from, to)` + `count: 'exact'` para mostrar "Página X de Y — total de N registros".
- 50 registros por página, com seletor 25/50/100/200.
- Nada de `limit(500)` no cliente.

**Detalhe expandido (corrigido):**
- **UPDATE**: lista cada campo alterado em uma linha com rótulo amigável + valor antigo (vermelho riscado) → valor novo (verde). Datas formatadas dd/MM/yyyy, booleanos como Sim/Não, FKs (uuid) resolvidas para nome quando possível (colaborador, setor, unidade, cargo, equipe).
- **INSERT**: tabela "campo → valor criado" (não JSON cru), pulando campos técnicos (`id`, `created_at`, `updated_at`, `created_by`).
- **DELETE**: tabela "campo → valor removido", mesma formatação.
- Sem `<pre>JSON</pre>` exposto para o usuário final.

**Filtros adicionais (já úteis):**
- Módulo (Todos / Escalas / Vendas / Estoque / Férias e Folgas / Sistema)
- Tabela (dependente do módulo, com rótulos amigáveis)
- Ação (Todas / Inseriu / Atualizou / Removeu)

A aba "Ações Administrativas" continua existindo apenas onde `showAdminTab=true` (página global de auditoria), sem alteração funcional além de também ganhar paginação server-side e remover o "Carregar últimos".

### Detalhes técnicos

- Arquivo único alterado: `src/components/AuditLogsPanel.tsx` (rewrite). Páginas que usam (`FeriasAuditLogs`, `EscalasAuditLogs`, `VendasAuditLogs`, `EstoqueAuditLogs`) não mudam.
- Para resolver UUIDs em nomes nos detalhes, faço lookups sob demanda em `ferias_colaboradores`, `ferias_setores`, `ferias_unidades`, `ferias_cargos`, `ferias_equipes` e `brokers`, com cache em memória por id (evita N+1).
- Para nome do usuário (não só email), faço join via RPC ou consulta em `profiles` com cache. Se `profiles` não tiver o nome, cai no email.
- Mantém o tema/design tokens existentes (sem cores cruas).
- Sem mudanças de schema, sem migrations.

### Fora de escopo

- Exportação CSV/PDF da auditoria.
- Filtro por usuário específico em dropdown (a busca por nome já cobre).
- Logs de leitura (apenas escrita continua sendo auditada como hoje).