

## Plano: Melhorar visualização da Validação

### Problemas atuais
- Informações em lista linear, sem agrupamento por tipo de regra
- Sem filtros (não dá pra ver só erros ou só warnings)
- Sem busca por corretor
- Violações globais e por corretor misturadas
- Trunca em 10 violações sem opção de ver mais
- Sem resumo por tipo de regra (ex: "5x CONSECUTIVOS, 3x DISTRIBUICAO")

### Solução

Reorganizar o `ValidationReportPanel` com:

**1. Painel de resumo por regra (novo)**
Cards clicáveis agrupando violações por tipo de regra. Ex:
```text
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ ❌ CONSECUTIVOS  │ │ ⚠️ INTERNO+EXT   │ │ ⚠️ DISTRIBUIÇÃO  │
│    5 ocorrências │ │    3 ocorrências  │ │    2 ocorrências │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```
Clicar em um card filtra a lista abaixo para mostrar apenas essa regra.

**2. Barra de filtros**
- **Severidade**: Todos | Apenas Erros | Apenas Avisos
- **Regra**: Select com todas as regras que apareceram (populado dinamicamente)
- **Busca**: Input para filtrar por nome do corretor
- **Visualização**: Toggle entre "Por Corretor" (atual) e "Por Regra" (novo)

**3. Visualização "Por Regra" (novo modo)**
Agrupa todas as violações por tipo de regra em vez de por corretor. Cada grupo é um collapsible mostrando:
- Nome da regra + explicação
- Lista dos corretores afetados com datas

**4. Visualização "Por Corretor" (melhorada)**
- Mantém o layout atual mas respeitando os filtros ativos
- Oculta corretores sem violações quando filtro de severidade está ativo
- Badge "OK" mais visível para corretores limpos

### Arquivo alterado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ValidationReportPanel.tsx` | Reescrever com filtros, agrupamento por regra, busca por corretor, toggle de visualização |

### O que NÃO muda
- Tipos/interfaces em `schedulePostValidation.ts`
- Lógica de validação
- Página `Schedules.tsx` (apenas consome o componente)

