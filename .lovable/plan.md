## Ajustes no cadastro de Imóveis (Despesas)

**1. Renomear "Matrícula" → "RIP"**
- `src/components/despesas/ImovelDialog.tsx` (linha 169): alterar o `<Label>` de `Matrícula` para `RIP`. O campo interno (`matricula`) permanece com o mesmo nome no banco — apenas o rótulo muda.

**2. Adicionar situação "Em aquisição"**
- `src/hooks/useDespesasImoveis.ts`: incluir `"em_aquisicao"` no tipo `ImovelSituacao`.
- `src/components/despesas/ImovelDialog.tsx`: adicionar a opção `{ v: "em_aquisicao", l: "Em aquisição" }` na lista de situações.
- `src/pages/despesas/DespesasImoveis.tsx`: incluir `em_aquisicao: "Em aquisição"` no `situacaoLabel` e no `Select` de filtros.
- `src/components/AuditLogsPanel.tsx`: mapear `em_aquisicao: "Em aquisição"` no dicionário de rótulos de auditoria.

Como `despesas_imoveis.situacao` é `text` (livre, sem enum no banco), **não há migration** — só ajustes de UI/tipagem.

### Observações
- KPIs atuais mostram Alugados/Desocupados/Vendidos; a nova situação será contabilizada apenas no filtro e na tabela, sem novo card (posso adicionar se desejar).