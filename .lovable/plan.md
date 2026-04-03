

## Plano: Corrigir cache de corretores e limpeza de inativos nos locais

### Bug 1: Inativos somem ao desativar corretor

**Causa raiz**: `Brokers.tsx` e `Locations.tsx` usam a mesma `queryKey: ["brokers"]` mas com queries diferentes:
- `Brokers.tsx`: busca TODOS os corretores (sem filtro `is_active`)
- `Locations.tsx`: busca apenas ativos (`is_active: true`)

Quando React Query invalida `["brokers"]`, pode refazer a query errada ou retornar dados cacheados inconsistentes. Por isso, ao desativar um corretor, a lista "perde" os inativos.

**Correcao**: Separar as query keys:
- `Brokers.tsx`: `queryKey: ["brokers", "all"]`
- `Locations.tsx`: `queryKey: ["brokers", "active"]`
- No `toggleActiveMutation`, invalidar ambas: `["brokers"]` (prefix match ja cobre as duas)

### Bug 2: Inativos ainda aparecem no dialog de editar local

**Causa raiz**: A limpeza de `location_brokers` ao desativar funciona para desativacoes FUTURAS, mas Joao Marcos e Daniella foram desativados ANTES desse codigo existir. Seus registros residuais em `location_brokers` ainda existem. O filtro `activeBrokerIds` no `openEditDialog` deveria resolver, mas como a query `["brokers"]` esta contaminada (bug 1), o Set de IDs ativos pode estar incorreto.

**Correcao**:
1. Corrigir a query key resolve o filtro automaticamente
2. Executar SQL de limpeza para remover registros residuais:
```sql
DELETE FROM location_brokers 
WHERE broker_id IN (SELECT id FROM brokers WHERE is_active = false);
```

### Alteracoes

1. **`src/pages/Brokers.tsx`**: Mudar queryKey para `["brokers", "all"]`
2. **`src/pages/Locations.tsx`**: Mudar queryKey para `["brokers", "active"]`
3. **SQL de limpeza**: Deletar `location_brokers` de corretores inativos existentes

