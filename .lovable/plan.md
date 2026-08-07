# Desempate no card "Propostas por Corretor"

## Problema
No dashboard de Vendas, a lista de propostas por corretor é ordenada apenas pela quantidade total de propostas. Quando há empate (ex.: julho/2026, Tânia e Hugo com 7 propostas cada), a ordem final fica indefinida — não considera quem converteu mais.

## Correção
Ordenar por total de propostas (desc) e, em caso de empate, por propostas convertidas (desc). Persistindo o empate, ordenar por nome do corretor (A–Z) para ter uma ordem estável.

No exemplo citado, Hugo passa a aparecer antes de Tânia.

## Detalhes técnicos
- Arquivo: `src/pages/vendas/VendasDashboard.tsx`, query `vendas-proposals-by-broker`.
- Trocar `sort((a, b) => b.count - a.count)` por comparação em cascata: `count` desc, depois `converted` desc, depois `name` localeCompare.
- Sem alterações de banco de dados nem de layout.
