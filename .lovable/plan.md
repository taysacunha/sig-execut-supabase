

## Plano: Auditoria de férias + cascata de créditos confiável

### Problemas confirmados

**1. Auditoria não mostra nada do módulo de férias**
- A página `FeriasAuditLogs` usa `AuditLogsPanel`, que lê apenas de `admin_audit_logs` e `module_audit_logs`.
- O código de férias grava em `ferias_audit_logs` (tabela separada que nunca é exibida).
- Vendas/Escalas/Estoque não gravam manualmente — usam **triggers de banco** (`audit_module_changes`) que populam `module_audit_logs` automaticamente em qualquer INSERT/UPDATE/DELETE. As tabelas de férias **não têm esses triggers**.
- Resultado: nada do módulo de férias aparece na auditoria, mesmo quando o código tenta logar.

**2. Cascata do crédito da Taysa não disparou**
- A query `monthCredits` busca `tipo='folga'` com `origem_data` entre o início e fim do mês selecionado.
- A causa mais provável é que a query estava **stale/em cache** ou ainda não havia retornado quando o usuário abriu o diálogo (não há `enabled` guard nem `refetchOnMount`). Em alguns cenários a query nem rodou (chave dependente de `[year, month]` que não mudaram desde a última visita).
- Secundariamente: o aviso só aparece se `monthCredits.length > 0` no momento do render — sem revalidação ao abrir o diálogo, dados desatualizados causam silêncio total.

### Solução

#### 1. Trigger no banco para auditoria automática (espelha o padrão de Escalas/Vendas)

Criar migração que:
- Estende `audit_module_changes` para mapear tabelas `ferias_*` ao módulo `'ferias'`.
- Anexa o trigger `AFTER INSERT OR UPDATE OR DELETE` nas tabelas principais:
  `ferias_colaboradores`, `ferias_ferias`, `ferias_folgas`, `ferias_folgas_escala`, `ferias_folgas_creditos`, `ferias_folgas_perdas`, `ferias_afastamentos`, `ferias_setores`, `ferias_equipes`, `ferias_cargos`, `ferias_unidades`, `ferias_feriados`.
- A partir daí, **toda** alteração em férias entra em `module_audit_logs` automaticamente, igual aos demais módulos. Sem código manual, sem chance de esquecer log.

#### 2. Atualizar `AuditLogsPanel` para reconhecer férias

- Adicionar `ferias: "Férias e Folgas"` em `moduleLabels`.
- Adicionar rótulos amigáveis em `tableLabels` para as principais tabelas (`ferias_colaboradores: "Colaboradores"`, `ferias_ferias: "Períodos de Férias"`, `ferias_folgas: "Folgas de Sábado"`, `ferias_folgas_creditos: "Créditos"`, `ferias_folgas_perdas: "Perdas de Folga"`, etc.).
- Incluir `"ferias"` no filtro de módulos (já é aceito no tipo `defaultModule`, só precisa aparecer no select).

#### 3. Cascata confiável + justificativa visível mesmo sem créditos

Em `FeriasFolgas.tsx`:
- Adicionar `refetchOnMount: "always"` + `staleTime: 0` na query `ferias-creditos-mes` para garantir dados frescos.
- Antes de abrir o `AlertDialog` "Apagar Escala", chamar `queryClient.refetchQueries(["ferias-creditos-mes", year, month])` e aguardar — só então abrir o diálogo (botão `onClick` async).
- Tornar a busca mais ampla: além de `origem_data` no mês, também buscar créditos cujo `utilizado_referencia` aponte para o mês (defesa em profundidade contra origem_data divergente).
- Manter o pedido de justificativa quando há créditos a cascatear (já implementado).
- A mutation continuará deletando créditos, escala e folgas; com o trigger do passo 1, cada DELETE individual em `ferias_folgas_creditos` / `ferias_folgas` / `ferias_folgas_escala` registra automaticamente em `module_audit_logs`. O insert manual em `ferias_audit_logs` pode ser removido (passa a ser redundante) ou mantido como nota explicativa de cascata — vou **remover** para evitar duplicidade e ruído.

#### 4. Limpeza dos logs manuais redundantes

Após o trigger entrar em vigor, os `INSERT INTO ferias_audit_logs` espalhados pelo código (em `FeriasCreditos.delete` e `FeriasFolgas.deleteAllFolgasMutation`) ficam redundantes — o trigger já registra cada DELETE/UPDATE automaticamente em `module_audit_logs`. Vou **remover** esses inserts manuais para o sistema convergir num único ponto de verdade.

A justificativa do usuário (motivo da exclusão) continua importante: vou armazená-la em `module_audit_logs.new_data` como `{ justificativa: "..." }` num INSERT manual complementar **uma única vez** na ação de cascata, ou alternativamente passá-la via uma coluna `details` no log automático (não existe hoje em `module_audit_logs`, então vou usar a primeira opção: depois do delete, inserir manualmente um log de "justificativa de cascata" no `module_audit_logs` com `action='DELETE_CASCADE_NOTE'`, `table_name='ferias_folgas_escala'`, `new_data={ justificativa, ano, mes, creditos_apagados: [...] }`).

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| **Nova migração SQL** | Estender `audit_module_changes` para mapear tabelas `ferias_*`; criar triggers `AFTER INSERT OR UPDATE OR DELETE` em todas as tabelas de férias |
| `src/components/AuditLogsPanel.tsx` | `moduleLabels` + `tableLabels` recebem entradas de férias; opção "Férias" no filtro de módulos |
| `src/pages/ferias/FeriasFolgas.tsx` | Query `ferias-creditos-mes` com `staleTime: 0` + `refetchOnMount: "always"`; botão "Apagar Escala" faz `await queryClient.refetchQueries(...)` antes de abrir o diálogo; busca também por `utilizado_referencia`; remover insert manual em `ferias_audit_logs` (substituído pelo trigger + log de justificativa em `module_audit_logs`) |
| `src/pages/ferias/FeriasCreditos.tsx` | Remover insert manual em `ferias_audit_logs` (trigger cobre); manter o pedido de justificativa via `module_audit_logs` complementar com `action='DELETE_NOTE'` carregando o motivo |

### Observação ao usuário
O crédito da Taysa que ficou órfão precisa ser **excluído manualmente** depois desta correção — o sistema só passará a fazer cascata e auditar a partir das próximas operações. Posso deixar isso para você fazer pela tela de Créditos (botão Excluir) com a justificativa apropriada.

