## Renomear "Vago" → "Desocupado" e adicionar Combobox de busca em selects extensos

### 1. Renomear "Vago" para "Desocupado" (apenas rótulos)
Manter o valor do enum no banco como `vago` (sem migration). Alterar apenas os textos exibidos:
- `src/components/despesas/ImovelDialog.tsx` — opção de situação.
- `src/pages/despesas/DespesasImoveis.tsx` — mapa de rótulos, KPI "Vagos" → "Desocupados", item do filtro.
- `src/components/AuditLogsPanel.tsx` — rótulo de auditoria.
- `src/pages/despesas/DespesasHelp.tsx` — texto explicativo.

### 2. Combobox pesquisável para campos com muitos itens
Substituir o `Select` atual por Popover + Command (mesmo padrão já aplicado no seletor de Imóvel do LancamentoDialog) nos campos que podem crescer bastante:
- Centro de custo
- Categoria
- Plano de conta
- Subcategoria
- Conta bancária
- Pessoa
- Imóvel (onde ainda for Select)

Arquivos a ajustar:
- `src/components/despesas/LancamentoDialog.tsx` — centro/categoria/plano/subcategoria/conta (o seletor de imóvel já é combobox; pessoa também).
- `src/components/despesas/PagamentoDialog.tsx` — conta bancária e demais lookups presentes.
- `src/components/despesas/VeiculoDialog.tsx` — centro de custo e outros lookups.
- `src/components/despesas/ImovelDialog.tsx` — centro de custo e outros lookups.
- `src/pages/despesas/DespesasRepasses.tsx` — filtros/seletores baseados nos lookups.
- `src/pages/despesas/DespesasCalendario.tsx` — filtros que usam `centros/categorias/planos/contas/pessoas/imoveis`.

Manter `Select` simples apenas para campos com poucas opções fixas (Tipo, Situação, Mês etc.).

### 3. Implementação do combobox
Criar um componente reutilizável `src/components/despesas/ComboboxField.tsx` (ou `src/components/ui/combobox-select.tsx`) que aceita:
- `options: { value: string; label: string; keywords?: string[] }[]`
- `value`, `onChange`, `placeholder`, `emptyText`, `allowClear`, `disabled`.

Assim evitamos duplicação Popover+Command em cada arquivo e mantemos comportamento consistente (busca por label + keywords, "— Limpar —" quando `allowClear`).

### 4. Verificação
- Rodar typecheck.
- Abrir os diálogos ajustados no preview e confirmar:
  - Selects viram inputs de busca com filtro por texto.
  - Rótulo "Desocupado" aparece na página de Imóveis, filtros e KPIs.
  - Nenhum quebra de layout dentro dos diálogos.
