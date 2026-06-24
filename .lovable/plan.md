## Controle de placas — implementado

Fluxo em três etapas:

1. **Materiais** — cadastra o material "Placa" (com `is_placa=true`). Botão "Nova Placa" pré-cadastra códigos rastreáveis sem afetar saldo.
2. **Saldos** — admin lança entrada/saída de unidades por local de armazenamento.
3. **Placas** — gestão de saída para imóvel, retorno, roubo e perda.

## Sincronização placa ↔ saldo

Feita no código JS via inserts em `estoque_movimentacoes`. Sem trigger SQL adicional (evita duplicação de saldo).

| Ação | Movimentação |
|---|---|
| Instalar / Nova saída unificada | `saida` -1 |
| Retornar ao estoque | `entrada` +1 |
| Roubo / perda | `saida` -1 |
| Pré-cadastro em Materiais | nenhuma |

## Arquivos

- `src/pages/estoque/EstoqueMateriais.tsx` — botão "Nova Placa" (admin/super)
- `src/components/estoque/materiais/NovaPlacaDialog.tsx` — pré-cadastro sem afetar saldo
- `src/pages/estoque/EstoquePlacas.tsx` — 3 abas (Disponíveis / Instaladas / Baixadas) + ações por linha + botão "Nova saída para imóvel"
- `src/components/estoque/placas/NovaSaidaDialog.tsx` — fluxo unificado (selecionar disponível OU criar novo código)
- `src/hooks/useEstoquePlacas.ts` — tipos e queries
- `src/components/estoque/placas/PlacasPDFGenerator.tsx` — relatório PDF
- `.lovable/estoque_placas_migration.sql` + `.lovable/estoque_placas_ajustes.sql` — schema (já executados)
