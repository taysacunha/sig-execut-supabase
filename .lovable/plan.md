## Ajustes em `src/pages/ferias/FeriasFerias.tsx`

Arquivo único afetado: `src/pages/ferias/FeriasFerias.tsx` (e geração de PDF do contador no mesmo arquivo).

### 1. Filtros com labels + botão "Limpar filtros" (Tabela de Férias)

Hoje (linhas ~648-656) os filtros são 3 inputs em grid sem labels. Padronizar igual à aba Calendário → Férias:

- Envolver em um bloco `rounded-lg border bg-muted/40 p-3` com cabeçalho "Filtros" (ícone `SlidersHorizontal`).
- Para cada filtro, adicionar `<Label className="text-xs font-medium text-muted-foreground">` acima:
  - Buscar colaborador
  - Status
  - Setor
- Acima/ao lado do bloco, exibir o botão **Limpar filtros** (mesmo estilo do Calendário: `variant="outline"`, borda/ texto destrutivo, ícone `X`) somente quando houver filtro ativo (`searchTerm`, `statusFilter !== "all"` ou `setorFilter !== "all"`).
- Handler `resetFeriasFilters` zera os 3 estados.

### 2. Filtros com labels + botão "Limpar filtros" (Tabela do Contador)

Linhas ~895-903. Mesma padronização para os 4 filtros: Buscar colaborador, Setor, Mês, Período. O botão "Exportar PDF" continua à direita, fora do bloco de filtros. Mostrar "Limpar filtros" quando qualquer um (`searchTerm`, `setorFilter`, `contadorMesFilter`, `contadorPeriodoFilter`) estiver diferente do default. Handler `resetContadorFilters` zera os 4.

> Observação: `searchTerm` e `setorFilter` são compartilhados com a Tabela de Férias; manteremos esse comportamento (o "Limpar filtros" do Contador também limpa os dois). Isso já é o comportamento atual de filtragem.

### 3. Lógica de filtro Mês × Período no Contador

Hoje `contadorDataFiltered` (linhas 440-457) inclui o colaborador se Q1 OU Q2 cair no mês — mas a tabela e o PDF continuam mostrando AMBOS os períodos do colaborador, mesmo que um deles não esteja em junho.

Mudança: definir, por linha, quais períodos exibir conforme o mês e o filtro de período.

```text
para cada férias f:
  q1Match = mes == "all" || mês(q1_inicio) == mes
  q2Match = mes == "all" || (q2_inicio && mês(q2_inicio) == mes)

  showQ1Row = (periodo == "all" || periodo == "1") && q1Match
  showQ2Row = (periodo == "all" || periodo == "2") && q2Match && tem q2

  manter f apenas se showQ1Row || showQ2Row
  guardar f._showQ1, f._showQ2 para a renderização
```

Efeitos:
- Mês=Junho + Período=Ambos: traz colaboradores com Q1 OU Q2 em junho, e cada linha exibe só a quinzena que cai em junho (a outra fica "—" ou simplesmente não preenchida); colunas 1º/2º Período permanecem visíveis quando Período=Ambos.
- Mês=Junho + Período=1ª: traz só quem tem Q1 em junho; só coluna 1º Período.
- Mês=Junho + Período=2ª: traz só quem tem Q2 em junho; só coluna 2º Período.
- Mês=Todos: comportamento atual.

A coluna **Dias Vendidos** também passa a respeitar `_showQ1/_showQ2` (mostrar "—" se a venda for em uma quinzena que não está sendo exibida naquela linha).

### 4. PDF do Contador (`generateContadorPDF`)

Linhas 478-579:

- Cabeçalho da coluna: trocar `"Dias V."` por `"Dias Vendidos"` e ampliar a largura dessa coluna para acomodar o texto (ajustar `colWidths` proporcionalmente).
- Valor da célula de dias vendidos: trocar formato `"${diasVendExibir}${sufixoVenda}"` (hoje gera `10 (2º)`) por `"${diasVendExibir} dias (${qVenda}º período)"`, igualando ao badge da tela (`10 dias (2º período)`).
- Aplicar a mesma regra do item 3: para cada linha, se a quinzena do mês não corresponde, escrever "—" na coluna desse período (em vez do range completo).
- Rodapé: manter o aviso "Dias vendidos limitados a 10".

### Detalhes técnicos

- Sem mudanças em SQL, RLS, hooks ou outros componentes.
- Usar `Label` (`@/components/ui/label`) e `SlidersHorizontal`/`X` (`lucide-react`, já importados na codebase).
- Manter paginação, ordenação e queries existentes inalteradas.
- `_showQ1/_showQ2` calculados via `useMemo` dentro de `contadorDataFiltered` (retornar array de objetos `{ ferias, showQ1, showQ2 }` ou anexar como propriedades não persistidas) e propagados para a renderização da tabela e do PDF.
