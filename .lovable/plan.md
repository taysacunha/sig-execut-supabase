

## Plano: Corrigir dashboard para exibir todas as férias agendadas (incluindo pendentes)

### Problema

O dashboard filtra férias por status `["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_gozo", "concluida"]`, mas exclui dois status importantes:

1. **`"pendente"`** — férias agendadas aguardando aprovação
2. **`"ativa"`** — status padrão da coluna (default do banco: `'ativa'::text`)

As férias da Taysa provavelmente estão em um desses dois status, por isso não aparecem.

Além disso, o dashboard **não chama** `atualizar_status_ferias` antes de buscar os dados (diferente da página FeriasFerias.tsx que chama), então os status podem estar desatualizados.

### Correções em `src/pages/ferias/FeriasDashboard.tsx`

#### 1. Incluir `"pendente"` e `"ativa"` nos filtros de status
Nas 3 queries que filtram por status:
- "Férias este Mês" (linha 54)
- "Próximas Férias" (linha 234)
- "Alertas de período aquisitivo" (linha 160)

Adicionar `"pendente"` e `"ativa"` à lista de status.

#### 2. Chamar `atualizar_status_ferias` antes de buscar os dados
Adicionar chamada ao RPC `atualizar_status_ferias` no início da query principal ("Férias este Mês") para garantir que os status estejam atualizados.

### Arquivo alterado

1. **`src/pages/ferias/FeriasDashboard.tsx`** — adicionar status faltantes + chamar RPC de atualização

