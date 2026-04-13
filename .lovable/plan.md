

## Problemas identificados

1. **Status "Encerrado" incorreto**: A função `isActive` compara com `new Date()` — se hoje está antes do período, retorna `false`, e o código mostra "Encerrado". Falta distinguir 3 estados: **Futuro** (ainda não começou), **Ativo** (em andamento), **Encerrado** (já terminou).

2. **Sem validação de conflito entre afastamentos**: Ao registrar um novo afastamento, não há verificação se o período se sobrepõe a outro afastamento já existente do mesmo colaborador.

## Correções

**Arquivo**: `src/components/ferias/colaboradores/AfastamentosSection.tsx`

### 1. Corrigir lógica de status

Substituir a função `isActive` por uma função `getStatus` que retorna 3 estados:

```
Se hoje < data_inicio → "futuro" (badge azul/outline "Agendado")
Se hoje >= data_inicio E hoje <= data_fim → "ativo" (badge destructive "Ativo")  
Se hoje > data_fim → "encerrado" (badge secondary "Encerrado")
```

Atualizar o card para usar o novo status (cor do border, badge).

### 2. Validação de conflito entre períodos

Antes de salvar, verificar se o novo período se sobrepõe a algum afastamento existente (excluindo o próprio registro se for edição). Usar a lista `afastamentos` já carregada:

- Para cada afastamento existente, checar se `novoInicio <= existenteFim && novoFim >= existenteInicio`
- Se houver conflito, mostrar erro e bloquear o salvamento

