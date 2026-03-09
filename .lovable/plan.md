

## Plano: 4 Correções

### 1. Interno + Externo no mesmo dia: permitir seg-sex, erro apenas no sábado

**Gerador (`scheduleGenerator.ts`)**:
- Linhas 499-515: mudar bloqueio para aplicar apenas quando `getDay(date) === 6` (sábado). Dias de semana: permitir se turno diferente.
- Linhas 678-693: mesma mudança na função de relaxamento.

**Validador (`schedulePostValidation.ts`)**:
- Linhas 175-194: verificar `getDay(date)` — se sábado → `severity: "error"`, se dia de semana → `severity: "warning"`.

**Painel de validação (`ValidationReportPanel.tsx`)**:
- Atualizar explicação da regra `INTERNO_EXTERNO_MESMO_DIA` para: "Interno e externo no mesmo dia é permitido seg-sex (turnos diferentes), mas proibido aos sábados."

### 2. Garantir alocação de todos os externos

**Gerador (`scheduleGenerator.ts`)**: Após a etapa 9 (linha ~3774), adicionar um **passe final conservador** para demandas externas ainda não alocadas:
1. Tentar alocar relaxando apenas a regra `INTERNO_EXTERNO_MESMO_DIA` (já permitida seg-sex pelo item 1)
2. Se ainda falhar, relaxar regra de consecutivos + gate 2-antes-3 simultaneamente
3. Registrar cada alocação em `relaxedAllocations` com a regra específica quebrada
4. **Nunca** relaxar: disponibilidade de dia/turno, vínculo ao local, hard cap de externos

O validador continuará reportando cada violação como warning, dando visibilidade total ao usuário.

### 3. Observações: botão salvar manual

**`ScheduleCalendarView.tsx`** (linhas 79-86, 548-565):
- Remover lógica de `saveTimeout` e auto-save por debounce
- `onChange` apenas atualiza `observationText` (state local)
- Adicionar botão "Salvar" ao lado do textarea que chama `saveMutation.mutate(observationText)`
- Feedback: "Salvo ✓" após sucesso, "Salvando..." durante pending

### 4. PDF de corretores ativos (Vendas)

**`SalesBrokers.tsx`**: Adicionar botão "Exportar PDF" no header do card. Ao clicar:
- Usa `jsPDF` para gerar PDF com:
  - **Cabeçalho**: Logo Execut (do `src/assets/execut-logo.jpg`) + "Execut Negócios Imobiliários" + "Lista de Corretores"
  - **Total**: "Total: XX corretores ativos"
  - **Tabela**: # | Nome | CRECI — todos os corretores ativos ordenados por nome
- Carrega a imagem do logo via `fetch` + `FileReader` para converter em base64 para o jsPDF

### Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/scheduleGenerator.ts` | Regra interno+externo só sábado + passe final para externos |
| `src/lib/schedulePostValidation.ts` | Severity condicional (sábado=error, semana=warning) |
| `src/components/ValidationReportPanel.tsx` | Atualizar explicação da regra |
| `src/components/ScheduleCalendarView.tsx` | Trocar auto-save por botão salvar |
| `src/pages/vendas/SalesBrokers.tsx` | Botão + geração PDF corretores ativos |

