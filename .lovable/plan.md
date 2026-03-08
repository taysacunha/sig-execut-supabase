

## Plano: Reordenar seções e eliminar espaços em branco no PDF

### Problema
A ordem atual no relatório é: Cards → Vendas (PDF) → Avaliação (PDF) → Gráficos. Isso gera espaços em branco porque cada seção é capturada individualmente e colocada em página separada quando não cabe.

### Alterações em `BrokerIndividualReport.tsx`

1. **Reordenar as seções no JSX** (dentro do `reportRef`):
   - Header
   - Summary Cards (4 cards)
   - **Avaliação** (mover para antes das vendas)
   - **Vendas** (depois da avaliação)
   - Gráficos (por último)

2. **Agrupar seções menores**: Envolver cards + avaliação + vendas em `div`s que agrupem logicamente o conteúdo, para que o algoritmo de paginação por seção não crie páginas com pouco conteúdo e muito espaço vazio. Reduzir o gap entre seções de 3mm para 2mm.

| Arquivo | Alteração |
|---------|-----------|
| `BrokerIndividualReport.tsx` linhas ~719-813 | Trocar a ordem: Avaliação vem antes de Vendas |
| `BrokerIndividualReport.tsx` linhas ~599 | Agrupar seções relacionadas em wrappers para melhor paginação |

