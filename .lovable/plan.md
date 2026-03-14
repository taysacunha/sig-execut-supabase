

## Simplificar tabela: unificar colunas de período

### Problema
A tabela tem duas colunas separadas — "Período(s) de Gozo" e "2º Período" — que criam confusão, especialmente quando o gozo flexível mostra "Ver 1º Período" na segunda coluna.

### Solução
Unificar em uma única coluna **"Períodos"** que mostra todos os períodos de gozo empilhados:

- **Gozo flexível**: lista todos os sub-períodos de `ferias_gozo_periodos` (já funciona na 1ª coluna)
- **Gozo diferente (legado)**: lista os períodos de gozo legado
- **Padrão com 2 períodos**: mostra Q1 e Q2 empilhados
- **Padrão com Q2 pendente**: mostra Q1 + badge "2º pendente"

### Mudança (arquivo único: `FeriasFerias.tsx`)

Remover a coluna "2º Período" do header (linha 484) e do body (linhas 507-513). Ajustar a célula "Período(s) de Gozo" (linhas 497-505) para incluir também o Q2 quando existir:

```
Colaborador | Setor | Períodos | Venda | Status | Origem | Exceção | Ações
```

Na célula "Períodos":
- Se `gozo_flexivel` → listar sub-períodos (como já faz)
- Se `gozo_diferente` → listar gozo1 e gozo2
- Senão → Q1 + (Q2 ou badge "Pendente")

