

## Plano: Corrigir visibilidade de corretores inativos

### Bug 1: Corretores inativos sumiram da pagina Corretores

A query em `src/pages/Brokers.tsx` (linha 103-106) busca TODOS os corretores sem filtro de `is_active`. O codigo esta correto — nao ha filtro escondendo inativos. Possibilidades:
- Pode ser um problema de paginacao (com 25 por pagina, os inativos podem estar em outra pagina)
- Ou a ordenacao por `created_at DESC` os empurra para o final

**Correcao**: Adicionar um filtro visual (dropdown/tabs) para "Todos / Ativos / Inativos" na pagina, com default "Todos". Isso garante que o usuario sempre encontre os inativos facilmente, independente da paginacao.

### Bug 2: Corretores inativos continuam aparecendo nos locais

Quando um corretor e desativado (`toggleActiveMutation`), apenas o campo `is_active` na tabela `brokers` e atualizado. Os registros em `location_brokers` permanecem intactos, entao o corretor inativo continua vinculado e visivel nos locais.

**Correcao**: No `toggleActiveMutation` de `src/pages/Brokers.tsx`, quando o corretor for desativado (`is_active` passa de `true` para `false`), deletar todos os registros de `location_brokers` desse corretor. Quando reativado, nao restaurar automaticamente — o usuario precisara vincular novamente nos locais desejados. Tambem invalidar a query `["locations"]`.

### Arquivos alterados

1. **`src/pages/Brokers.tsx`**:
   - Adicionar estado `statusFilter` com opcoes "all" / "active" / "inactive"
   - Adicionar botoes/tabs de filtro acima da tabela (junto aos controles de paginacao)
   - Aplicar filtro no `filteredBrokers`
   - No `toggleActiveMutation`, ao desativar: deletar registros de `location_brokers` do corretor
   - Invalidar query `["locations"]` no `onSuccess` do toggle

2. **`src/pages/Locations.tsx`** — sem alteracao necessaria (o dropdown de corretores ja filtra `is_active: true`)

