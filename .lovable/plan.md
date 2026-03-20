

## Plano: Melhorar Vínculos/Diagnóstico + Gantt de Férias

### Problema 1: Vínculos e "Por que não alocou" confusos

**O que está errado:**
- Termos como "elegíveis", "excluídos", "demandas" são jargão técnico do gerador, não linguagem de negócio
- Ao expandir um corretor nos Vínculos, o usuário vê uma lista de datas verdes/amarelas sem contexto claro
- Falta mostrar: "em quais locais este corretor FOI efetivamente alocado" vs "onde ele poderia ir mas não foi"

**Solução — Reescrever textos e reorganizar a EligibilityView:**

**Arquivo: `src/components/ValidationReportPanel.tsx`**

- **Labels da listagem (sem expandir):**
  - `13/2 externos` → `13 plantões externos (meta: 2)` 
  - `3 locais vinculados` → `Vinculado a 3 locais`
  - `12 elegíveis` → `Disponível em 12 turnos`
  - `5 excluídos` → `Bloqueado em 5 turnos`

- **Conteúdo expandido — reorganizar por local:**
  - Título do local com ícone
  - Seção "Turnos disponíveis" (verde) — listar dia + turno
  - Seção "Turnos bloqueados" (amarelo) — listar dia + turno + motivo traduzido
  - Cada motivo já usa `humanizeExclusionReason`, manter

- **DiagnosticView (Por que não alocou):**
  - `{count} vezes bloqueado` → `Considerado {count} vezes, não alocado`
  - Nos detalhes, trocar `{regra}: {reason}` por apenas a explicação da regra já traduzida

### Problema 2: Calendário de Férias → Gráfico de Gantt

**O que o usuário quer:** visualização tipo Gantt onde cada linha é um colaborador e barras horizontais mostram os períodos de gozo, permitindo ver sobreposições visuais entre colaboradores.

**Implementação — CSS puro (sem biblioteca extra):**

**Novo arquivo: `src/components/ferias/calendario/GanttFeriasView.tsx`**

- Componente que recebe a lista de férias filtradas e renderiza um Gantt horizontal
- **Eixo Y:** nome do colaborador (com badge de setor)
- **Eixo X:** dias do período selecionado (mês ou meses)
- **Barras:** intervalos de gozo coloridos por setor, com tooltip mostrando detalhes
- **Sobreposições:** quando dois colaboradores do mesmo setor têm férias sobrepostas, destacar com borda vermelha
- Header com dias numerados e marcação de fins de semana

**Filtros (no componente pai):**
- Busca por nome (um ou mais colaboradores)
- Filtro por setor (multi-select ou select simples, um ou mais)
- Seletor de período: mês/meses ou ano inteiro
- Os filtros já existem parcialmente no `CalendarioFeriasTab`, serão expandidos

**Arquivo: `src/components/ferias/calendario/CalendarioFeriasTab.tsx`**

- Adicionar toggle "Lista | Gantt" para alternar entre a visualização atual e o Gantt
- Adicionar filtro de busca por nome
- Manter filtros existentes (setor, unidade)
- Adicionar seletor de intervalo de datas (mês único ou range de meses)
- Passar dados filtrados para o `GanttFeriasView`

**Detalhes técnicos do Gantt:**
- Cada dia = uma célula de largura fixa (~28px), scroll horizontal para períodos longos
- Barras posicionadas com CSS absolute dentro de uma grid
- Cores por setor (reutilizar `SETOR_COLORS` do aniversariantes ou criar paleta)
- Linhas zebradas para legibilidade
- Ao passar o mouse sobre uma barra: tooltip com nome, setor, período, dias vendidos
- Ao clicar: abrir o dialog de detalhes existente

### Arquivos alterados
1. `src/components/ValidationReportPanel.tsx` — reescrever labels e textos
2. `src/components/ferias/calendario/GanttFeriasView.tsx` — novo componente Gantt
3. `src/components/ferias/calendario/CalendarioFeriasTab.tsx` — adicionar toggle Gantt + filtro por nome

