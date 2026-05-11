## Objetivo

Adicionar, na aba **Gantt** do calendário de férias (`viewMode === "gantt"` em `CalendarioFeriasTab`), um botão **"Gerar PDF"** que exporta o Gantt de **um mês** (mês selecionado, com ano vigente em `ganttYear`).

## Mudanças

### 1. Novo arquivo: `src/components/ferias/calendario/GanttFeriasPDFGenerator.tsx`

Componente isolado que recebe:
- `ferias: Ferias[]` (já filtradas, com `_gozoPeriodos`)
- `year: number`
- `month: number` (1–12)

Comportamento:
- Botão `<Button variant="outline" size="sm">` com ícone `Download` e label **"Gerar PDF do mês"**.
- Ao clicar, abre um pequeno popover/dropdown com os 12 meses (Janeiro–Dezembro) baseados em `ganttYear` para o usuário escolher qual mês exportar — assim o PDF é sempre **um mês**, mesmo se o Gantt estiver mostrando vários ou o ano inteiro.
  - Alternativa mais simples: usar `Select` inline com os 12 meses, default = mês atual selecionado no Gantt. (Vamos por essa para evitar dependência de Popover.)
- Geração via `jsPDF` (já usado em `FolgasPDFGenerator.tsx`):
  - Orientação **paisagem** (`landscape`), formato A4.
  - Cabeçalho: "Calendário de Férias — {Mês Por extenso} {ano}".
  - Subcabeçalho: data de geração, total de colaboradores.
  - Tabela Gantt:
    - Coluna fixa à esquerda: nome do colaborador + setor/unidade.
    - Cabeçalho com dias do mês (1..N).
    - Linhas com barras horizontais coloridas por setor (mesma paleta `SETOR_COLORS` do `GanttFeriasView`), preenchendo as células dos dias do gozo.
    - Fins de semana com fundo cinza claro.
    - Sobreposições no mesmo setor: borda direita vermelha + ponto vermelho ao lado do nome.
  - Rodapé: numeração de página `Página X de Y`.
- Filtra `ferias` para mostrar apenas quem tem **gozo dentro do mês**.
- Salva como `ferias-gantt-{ano}-{mes2digitos}.pdf`.

### 2. Edição: `src/components/ferias/calendario/CalendarioFeriasTab.tsx`

- Importar `GanttFeriasPDFGenerator`.
- Dentro do bloco `viewMode === "gantt"` (logo antes do `<GanttFeriasView>`, na mesma faixa de filtros ou em um header acima do Gantt), renderizar:
  ```tsx
  <GanttFeriasPDFGenerator
    ferias={feriasFiltradas}
    year={ganttYear}
    month={/* default */}
  />
  ```
- O default de mês passado ao componente: primeiro mês selecionado em `ganttMonths` (parseado), ou mês atual de `calendarMonth` se nenhum for selecionado, ou mês atual real se "year" estiver ativo. O `Select` interno do componente permite o usuário trocar antes de gerar.

## Detalhes técnicos

- **Reuso**: copiar a lógica de `getGozoIntervals`, `setorColorMap` e detecção de overlaps do próprio `GanttFeriasView.tsx` para o gerador (extrair também não é necessário; manter local mantém o componente autocontido).
- **Cálculo de larguras** no PDF: `pageWidth - margem - colNomes` dividido por número de dias do mês.
- **Fontes**: jsPDF padrão (helvetica), tamanhos 7–9 pt para caber.
- **Sem mudanças** em schema, RLS, queries ou demais abas.

## Não-alterações

- A view Gantt na tela continua idêntica.
- Nenhuma outra aba é tocada.
- Sem nova dependência (jsPDF já está no projeto).
