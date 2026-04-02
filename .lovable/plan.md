

## Plano: Garantir que corretores inativos nao aparecem nos locais

### Problema

Joao Marcos esta inativo mas ainda aparece no campo de corretores disponiveis ao editar locais. Isso acontece porque:

1. Ele foi desativado ANTES do codigo de limpeza automatica ser adicionado, entao seus registros em `location_brokers` ainda existem
2. A query de corretores em `Locations.tsx` ja filtra `is_active: true` (linha 213), mas os `location_brokers` existentes carregam o broker_id dele ao editar — e o `BrokerAvailabilityForm` itera sobre `brokers` (ativos), entao ele nao deveria aparecer na lista. Porem, se os registros em `location_brokers` existem, ao salvar, sao re-inseridos

### Correcoes

**1. Limpeza de dados existentes (migration)**

Executar um DELETE para remover todos os registros de `location_brokers` cujo `broker_id` referencia um corretor inativo:

```sql
DELETE FROM location_brokers 
WHERE broker_id IN (
  SELECT id FROM brokers WHERE is_active = false
);
```

**2. Filtrar selectedBrokers ao carregar para edicao (`src/pages/Locations.tsx`, linha ~444-456)**

Ao carregar os corretores associados de um local para edicao, filtrar apenas os que pertencem a corretores ativos:

```typescript
// Ao carregar location_brokers para edicao, filtrar inativos
const activeBrokerIds = new Set(brokers?.map(b => b.id) || []);
setSelectedBrokers(
  brokers_data
    ?.filter(b => activeBrokerIds.has(b.broker_id))
    ?.map(b => ({ ... })) || []
);
```

Isso garante que mesmo que existam registros residuais em `location_brokers`, eles nao aparecem ao editar.

**3. Ao reativar corretor: pre-popular disponibilidade ao vincular (`src/pages/Locations.tsx`)**

Isso ja funciona naturalmente: ao marcar um corretor no `BrokerAvailabilityForm`, o `toggleBroker` cria a entrada com a disponibilidade vinda do cadastro do corretor (via `brokerAvailabilityMap`). Nenhuma alteracao necessaria aqui.

### Arquivos alterados

1. **Migration SQL** — limpeza de `location_brokers` de corretores inativos
2. **`src/pages/Locations.tsx`** — filtrar `selectedBrokers` por corretores ativos ao carregar para edicao

