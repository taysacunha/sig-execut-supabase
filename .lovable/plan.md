

## Corrigir detecção de plantões não alocados na validação

### Problema

Existem **dois furos** na validação que explicam por que o Setai domingo/tarde não gerou erro:

1. **Na re-validação**: `handleRevalidateSchedule` passa `[]` (array vazio) como `unallocatedDemands` para o pós-validador (linha 912 de `Schedules.tsx`). Ou seja, ao re-validar uma escala existente, **nunca detecta turnos faltando**.

2. **O pós-validador (`schedulePostValidation.ts`) não verifica gaps por conta própria** — ele apenas reporta o que recebe via parâmetro. Se o gerador não passou a demanda como "missing", ela é invisível.

### Solução

Fazer o pós-validador **verificar independentemente** todos os turnos configurados vs. alocações existentes, sem depender de dados passados externamente. Isso garante que tanto na geração quanto na re-validação, gaps sejam detectados.

### Mudanças

| # | Arquivo | O que muda |
|---|---------|-----------|
| 1 | `src/lib/schedulePostValidation.ts` | Adicionar função `detectUnallocatedDemands(assignments, dateRange)` que consulta Supabase para buscar todas as configurações de locais/períodos/turnos e compara com as alocações existentes. Retornar `UnallocatedDemand[]`. |
| 2 | `src/pages/Schedules.tsx` — `handleRevalidateSchedule` | Chamar `detectUnallocatedDemands()` antes de passar ao pós-validador, em vez de `[]`. Isso faz a re-validação detectar plantões faltando. |
| 3 | `src/pages/Schedules.tsx` — geração | Substituir a chamada a `validateGeneratedSchedule` do generator por `detectUnallocatedDemands()` para unificar a lógica (evitar duplicação). |

### Detalhes da função `detectUnallocatedDemands`

Mesma lógica que já existe em `scheduleGenerator.ts` linhas 4064-4142 (`validateGeneratedSchedule`), mas extraída para `schedulePostValidation.ts` como função reutilizável:

- Busca locais ativos com períodos e configs (weekday + specific_date)
- Para cada data no range, verifica se há config esperando turno
- Compara com alocações existentes
- Retorna array de `UnallocatedDemand` para turnos sem cobertura

Isso resolve ambos os cenários: geração e re-validação mostrarão corretamente os plantões faltando na seção laranja do painel de validação.

