## Objetivo

Permitir ocultar/exibir todos os valores monetários do módulo Despesas com um botão único (ícone de olho), padrão **oculto**. A preferência do usuário persiste durante a sessão em todas as páginas.

## Abordagem

Criar um estado global de visibilidade no `DespesasLayout` (via Context) e um helper de formatação que respeita esse estado. Todas as páginas e componentes que exibem valores passam a usar o helper em vez de `formatCurrency` diretamente.

## Passos

### 1. Contexto global — `src/contexts/DespesasValuesContext.tsx` (novo)
- `useState` com `showValues` (default `false`), persistido em `sessionStorage` (chave `despesas:showValues`).
- Expõe: `showValues`, `toggleValues`, `formatValue(n)` que retorna `formatCurrency(n)` quando visível ou `"R$ ******"` quando oculto.
- Hook `useDespesasValues()`.

### 2. Botão no cabeçalho — `src/layouts/DespesasLayout.tsx`
- Envolver o `<Outlet />` no `DespesasValuesProvider`.
- No header, ao lado do sino de notificações, adicionar botão com ícones `Eye`/`EyeOff` (lucide) e `title` "Mostrar/Ocultar valores". Único ponto de controle do módulo.

### 3. Páginas/componentes a adaptar
Substituir exibições de valor por `formatValue(...)` do contexto:

- `src/pages/despesas/DespesasDashboard.tsx` — KPIs, fluxo de caixa, top 5 CC, próximos vencimentos.
- `src/hooks/useDespesasDashboard.ts` — apenas retorna números; a máscara é aplicada na renderização.
- `src/pages/despesas/DespesasCalendario.tsx` — valores nos cards/dias e listagens.
- `src/pages/despesas/DespesasRecorrencias.tsx` — valor por parcela e total.
- `src/pages/despesas/DespesasRepasses.tsx` — totais de repasse, itens, limites de beneficiário.
- `src/pages/despesas/DespesasImoveis.tsx` — valor de aluguel / IPTU quando exibido em card/tabela.
- `src/pages/despesas/DespesasRelatorios.tsx` — KPIs, séries, tabelas, tooltips do Recharts (função `formatter` sensível ao toggle).
- `src/components/despesas/LancamentoDialog.tsx`, `PagamentoDialog.tsx`, `RepasseDialog.tsx` — mostram valores somente em resumos/labels informativos; **inputs de valor permanecem sempre visíveis** (o usuário precisa digitar/conferir).

### 4. Regras de aplicação
- Aplicar máscara apenas em **exibição** (cards, tabelas, badges, tooltips, gráficos).
- **Não aplicar** em campos de formulário (`Input type="number"`, valor sendo editado), pois quebraria a operação.
- Gráficos Recharts: usar `tickFormatter` e `Tooltip formatter` que consultam `showValues` — quando oculto, retorna `"***"` no eixo Y e `"R$ ******"` no tooltip.
- Contagens (ex: "3 lançamentos") permanecem visíveis; apenas o valor em R$ é mascarado.

### 5. Página de Ajuda
- Adicionar nota curta em `DespesasHelp.tsx` (aba "Visão geral") explicando o botão do olho no cabeçalho.

## Detalhes técnicos

- Nenhuma migration de banco necessária.
- Persistência via `sessionStorage` para não vazar entre usuários no mesmo navegador após logout.
- Reaproveita `formatCurrency` já existente em `src/lib/utils` (ou onde estiver definido no módulo).
- Ícones `Eye`/`EyeOff` de `lucide-react`, mesmo padrão já usado em Vendas.

## Fora de escopo

- Ocultar valores em outros módulos (Vendas já tem toggle próprio; Escala/Estoque/Férias não pedidos).
- Persistência entre sessões/usuário logado (sessionStorage é suficiente).
