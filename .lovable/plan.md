

## Plano: Corrigir visibilidade dos botões, filtrar inativos e melhorar textos

### Resumo das mudanças

**4 problemas a resolver:**

1. Botões "Vínculos" e "Por que não alocou" só aparecem quando há dados em memória (condicionais `&& length > 0`). Devem aparecer sempre, como "Por Corretor" e "Por Regra".
2. Remover o botão "Forense" e todo o código da `ForensicView`.
3. Corretores inativos aparecem nos vínculos porque a query de `location_brokers` no gerador não filtra `brokers.is_active`.
4. Textos das razões de exclusão são técnicos demais (ex: `DIA: monday não está em available_weekdays`, `GLOBAL: sem disponibilidade para morning em tuesday`).

---

### Arquivo 1: `src/components/ValidationReportPanel.tsx`

**a) Botões sempre visíveis:**
- Remover as condições `{brokerDiagnostics && brokerDiagnostics.length > 0 && (` e `{brokerEligibilityMap && brokerEligibilityMap.length > 0 && (` dos botões "Por que não alocou" e "Vínculos".
- Mostrar sempre, iguais a "Por Corretor" e "Por Regra".

**b) Remover Forense:**
- Remover o botão "Forense", o `viewMode === "forensic"` do render, a `ForensicView` inteira (linhas ~1008-1157), e o tipo `"forensic"` do `ViewMode`.
- Remover `SubAllocatedForensic` da interface de props e dos imports.

**c) Melhorar textos na `EligibilityView`:**
- Traduzir as razões de exclusão para português claro. Ex:
  - `DIA: monday não está em available_weekdays` → `Corretor não trabalha às segundas`
  - `GLOBAL: sem disponibilidade para morning em tuesday` → `Sem disponibilidade pela manhã às terças`
  - `LOCAL: weekday_shift_availability não inclui afternoon em wednesday` → `Vínculo local não permite turno da tarde às quartas`
  - `LEGACY: available_morning = false` → `Turno da manhã desabilitado neste local`
- Criar uma função `humanizeExclusionReason(reason: string)` que faz essa tradução via regex/mapeamento.
- Aplicar também na `DiagnosticView` para as razões de rejeição.

**d) Melhorar textos na `DiagnosticView`:**
- Trocar "Diagnóstico Forense" → "Corretores que não atingiram a meta de externos"
- Trocar "rejeições" → "vezes que foi considerado mas não pôde ser alocado"
- Trocar labels técnicos das regras por descrições curtas usando o mapa `ruleExplanations` já existente.

**e) Melhorar labels gerais:**
- Badges: `ext` → `externos`, `locais` → `locais vinculados`
- Datas: usar `formatDateBR` nas datas da `EligibilityView` (hoje mostra `yyyy-MM-dd`)
- Turnos: `M` → `Manhã`, `T` → `Tarde`

### Arquivo 2: `src/lib/scheduleGenerator.ts`

**Filtrar corretores inativos no mapa de elegibilidade:**
- Na construção do `brokerEligibilityBuilder` (linha ~3226), verificar se o broker do `location_brokers` está na `brokerQueue` (que já é filtrada por `is_active`). Se não estiver, pular.
- Alternativa mais direta: checar `lb.brokers?.is_active !== false` antes de adicionar ao builder. Mas como a query não traz `is_active` do broker, a abordagem correta é verificar se o `broker_id` existe no set de brokers ativos já carregado.

### Arquivo 3: `src/pages/Schedules.tsx`

- Remover `subAllocatedForensics` da prop passada ao `ValidationReportPanel`.
- Manter `brokerDiagnostics` e `eligibilityExclusions` (usados por "Por que não alocou").
- Manter `brokerEligibilityMap` com persistência (usada por "Vínculos").

