

# Plano de Correções e Novas Funcionalidades — Módulo de Férias

São 7 itens distintos. Vou detalhar cada um separadamente.

---

## 1. Card "Próximas Férias" no Dashboard — Taysa não aparece

**Problema**: A lógica de resolução de datas já está robusta (`getResolvedVacationPeriods`), mas o filtro server-side com `.or()` pode estar excluindo registros cujas datas de início estão em campos que o filtro não cobre (ex: datas salvas apenas em `ferias_gozo_periodos`). Além disso, o `gozoPeriodosMap` só contém períodos cujo `data_inicio` cai na janela de 30 dias — mas se a férias padrão não tem nenhum campo de início na janela, ela sequer é carregada da query principal.

**Correção**: Inverter a abordagem — primeiro buscar TODOS os `ferias_gozo_periodos` com `data_inicio` na janela + TODOS os `ferias_ferias` com qualquer campo de início na janela. Depois, para cada `ferias_ferias`, carregar também os períodos flexíveis associados (mesmo que fora da janela), para que `getResolvedVacationPeriods` funcione corretamente. Garantir que a query de `ferias_ferias` também busque por registros que NÃO têm campos de início na janela mas TÊM períodos flexíveis na janela (via os IDs vindos de `ferias_gozo_periodos`).

**Arquivo**: `src/pages/ferias/FeriasDashboard.tsx`

---

## 2. ColaboradorDialog — Campos obrigatórios em outras abas não mostram erro

**Problema**: O formulário tem 3 abas (Dados Pessoais, Vínculos, Outros). Campos obrigatórios como `setor_titular_id` ficam na aba "Vínculos". Quando o usuário clica em "Salvar" sem preencher, o Zod valida e bloqueia, mas a UI não navega para a aba com erro nem mostra feedback visível.

**Correção**: 
- Trocar de `defaultValue` para `value` controlado no componente `Tabs`
- Ao submeter com erros, verificar quais campos têm erro e navegar automaticamente para a aba correspondente
- Adicionar indicador visual (badge/ícone vermelho) nas tabs que contêm erros
- Mostrar toast informando "Preencha os campos obrigatórios"

**Arquivo**: `src/components/ferias/colaboradores/ColaboradorDialog.tsx`

---

## 3. FeriasDialog — Editar não carrega dados existentes

**Problema**: O `useEffect` de reset (linha 378-450) já popula o formulário com os dados da férias ao editar. Porém o campo `colaborador_id` é um combobox que filtra apenas colaboradores "disponíveis" (sem férias cadastrada). Como o colaborador já TEM férias, ele é excluído da lista — exceto pela condição `if (isEditing && ferias?.colaborador_id === c.id) return true` na linha 182. O problema real pode ser que o objeto `ferias` passado ao dialog não contém todos os campos necessários, ou os `excPeriodos`/`excecaoTipo` não são restaurados ao editar uma exceção.

**Correção**:
- Garantir que ao editar, os campos de exceção (`excecaoTipo`, `excDistribuicaoTipo`, `excDiasVendidos`, `excPeriodos`) sejam restaurados a partir dos dados da férias e dos `ferias_gozo_periodos`
- Carregar os `ferias_gozo_periodos` da férias sendo editada para popular o estado local
- Verificar que o objeto `ferias` passado ao dialog contém todos os campos (incluindo `gozo_flexivel`, `distribuicao_tipo`, etc.)

**Arquivos**: `src/components/ferias/ferias/FeriasDialog.tsx`, `src/pages/ferias/FeriasFerias.tsx`

---

## 4. Afastamento de colaboradores (funcionalidade nova)

**Problema**: Não existe forma de registrar que um colaborador está afastado (acidente, licença maternidade, etc.).

**Implementação**:
- Criar tabela `ferias_afastamentos` com: `id`, `colaborador_id`, `motivo` (enum: acidente, licenca_maternidade, licenca_paternidade, doenca, outros), `motivo_descricao`, `data_inicio`, `data_fim`, `observacoes`, `created_at`, `created_by`
- Adicionar seção no `ColaboradorDialog` ou `ColaboradorViewDialog` para visualizar/gerenciar afastamentos
- Na geração de folgas, excluir colaboradores afastados no período
- No cadastro de férias, alertar se o período choca com afastamento ativo
- Mostrar badge "Afastado" na tabela de colaboradores quando há afastamento ativo
- Validar: se colaborador já tem férias no período do afastamento, alertar o usuário

**Arquivos novos**: migration SQL, possivelmente `src/components/ferias/colaboradores/AfastamentoDialog.tsx`
**Arquivos modificados**: `ColaboradorDialog.tsx`, `ColaboradorViewDialog.tsx`, `FeriasDialog.tsx`, `FeriasFolgas.tsx`, `FeriasColaboradores.tsx`

---

## 5. Busca por nome sem tratamento de acentos

**Problema**: Em `FeriasFerias.tsx` (linhas 272, 287), a busca usa `.toLowerCase().includes()` sem normalizar acentos. Pesquisar "vanesia" não encontra "vanésia". O mesmo pode ocorrer em `FeriasFolgas.tsx`, `CalendarioFeriasTab.tsx`, e nos comboboxes de seleção de colaborador.

**Correção**: Substituir todas as ocorrências de `.toLowerCase().includes()` por `normalizeText()` (já existente em `src/lib/textUtils.ts`). Localizar e corrigir em:
- `src/pages/ferias/FeriasFerias.tsx` — filteredFerias e filteredFormularios
- `src/pages/ferias/FeriasFolgas.tsx` — qualquer filtro por nome
- `src/components/ferias/calendario/CalendarioFeriasTab.tsx` — filtro por nome
- `src/components/ferias/ferias/FeriasDialog.tsx` — combobox de colaborador
- Qualquer outro local no módulo férias que faça busca textual

**Arquivos**: múltiplos no módulo férias

---

## 6. Controle de envio ao contador (funcionalidade nova)

**Problema**: Não existe forma de marcar que um período de férias foi encaminhado ao contador.

**Implementação**:
- Adicionar coluna `enviado_contador` (boolean, default false) e `enviado_contador_em` (timestamp) na tabela `ferias_ferias`
- Na tabela de férias e na aba do contador, adicionar botão/checkbox para marcar como "Enviado ao contador"
- Ao tentar editar uma férias marcada como enviada, exibir alerta: "Este período já foi encaminhado ao contador. Alterações devem ser feitas apenas internamente."
- Permitir a edição, mas com confirmação explícita

**Arquivos**: migration SQL, `FeriasFerias.tsx`, `FeriasDialog.tsx`, `ContadorPDFGenerator.tsx`

---

## 7. PDF do Contador — Filtro por meses e períodos

**Problema**: O PDF do contador só filtra por ano e setor. O usuário quer selecionar meses específicos e/ou períodos.

**Correção**:
- Adicionar multi-select de meses (janeiro a dezembro)
- Adicionar filtro de período (1º quinzena, 2º quinzena, ambos)
- Aplicar filtros na query e na geração do PDF
- Atualizar o preview da tabela com os mesmos filtros

**Arquivo**: `src/components/ferias/relatorios/ContadorPDFGenerator.tsx`

---

## Ordem de implementação sugerida

1. **Busca com acentos** (rápido, impacto amplo)
2. **ColaboradorDialog — erro em abas** (UX crítico)
3. **FeriasDialog — editar carrega dados** (bug funcional)
4. **Card Próximas Férias** (bug recorrente, Taysa)
5. **PDF Contador — filtros** (melhoria)
6. **Controle envio ao contador** (funcionalidade nova)
7. **Afastamentos** (funcionalidade nova, maior escopo)

