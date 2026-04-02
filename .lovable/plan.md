

## Plano: Corrigir dois bugs — desmarcar dias em locais e permitir corretor sem disponibilidade

### Bug 1: Desmarcar dias no calendário de períodos não funciona

**Causa raiz**: No modo "weekday" (Botanic), ao salvar, o código faz `upsert` nos dias selecionados em `period_specific_day_configs` e `period_day_configs`, mas **nunca deleta** os dias que foram desmarcados. Se o dia 21 estava marcado e o usuário desmarcou, o upsert simplesmente não inclui esse dia — mas o registro antigo permanece no banco.

**Correção em `src/components/LocationPeriodTree.tsx`**:
- Antes do upsert, ao editar (`editingPeriodId` existente), **deletar todos os registros** de `period_specific_day_configs` para aquele `period_id` e depois inserir apenas os selecionados
- Também deletar `period_day_configs` antigos cujos weekdays não estão mais presentes nos dias selecionados
- Isso garante que desmarcar um dia realmente remove o registro do banco

### Bug 2: Não é possível salvar corretor sem nenhuma disponibilidade

**Causa raiz**: O schema Zod em `src/lib/validations/brokerSchema.ts` tem um `.refine()` que exige pelo menos um turno disponível. Isso impede salvar um corretor como "indisponível" temporariamente.

**Correção em `src/lib/validations/brokerSchema.ts`**:
- Remover o `.refine()` que exige pelo menos um turno
- Permitir que todos os dias fiquem vazios (corretor indisponível)
- O corretor continua ativo no sistema, aparece na tabela e no PDF, mas simplesmente não será alocado pelo gerador porque não tem nenhum dia/turno disponível

### Arquivos alterados

1. **`src/components/LocationPeriodTree.tsx`** — No handler de salvar (linhas ~1798-1946), adicionar `DELETE` dos registros antigos de `period_specific_day_configs` e `period_day_configs` antes de fazer upsert dos novos
2. **`src/lib/validations/brokerSchema.ts`** — Remover o `.refine()` do `weekdayShiftAvailabilitySchema` para permitir disponibilidade vazia

