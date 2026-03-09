
Objetivo: remover totalmente o `INTERNO_EXTERNO_MESMO_DIA` em dias úteis (sem erro e sem warning), mantendo essa regra apenas para sábado.

Plano de implementação:

1) Ajustar validação pós-geração (`src/lib/schedulePostValidation.ts`)
- No bloco da regra `INTERNO_EXTERNO_MESMO_DIA`, alterar a condição para:
  - Só criar violação quando `isSaturday === true`.
  - Não avaliar mais “same shift” para dias úteis.
- Resultado esperado:
  - Seg–sex: nunca gera `INTERNO_EXTERNO_MESMO_DIA`.
  - Sábado: continua gerando como `severity: "error"`.

2) Ajustar texto explicativo da regra (`src/components/ValidationReportPanel.tsx`)
- Atualizar `ruleExplanations["INTERNO_EXTERNO_MESMO_DIA"]` para refletir a regra real:
  - Ex.: “Interno e externo no mesmo dia só é proibido no sábado.”
- Isso evita interpretação errada na interface.

3) Alinhar bloqueio no gerador para consistência (`src/lib/scheduleGenerator.ts`)
- Nos dois pontos de checagem da regra (fluxo normal e fluxo com relaxamento), remover o bloqueio de “mesmo turno” em dias úteis para essa regra.
- Manter apenas o bloqueio de sábado com `rule: "INTERNO_EXTERNO_MESMO_DIA"`.
- Observação: conflitos físicos de mesmo turno continuam protegidos pela regra física já existente.

4) Validação funcional após ajuste
- Gerar uma escala com casos de interno+externo em seg–sex: não deve aparecer erro/warning dessa regra.
- Gerar caso com interno+externo no sábado: deve aparecer erro `INTERNO_EXTERNO_MESMO_DIA`.
- Confirmar no painel de validação que contadores de warning/error não sobem indevidamente por casos de dias úteis.

Arquivos impactados:
- `src/lib/schedulePostValidation.ts`
- `src/components/ValidationReportPanel.tsx`
- `src/lib/scheduleGenerator.ts`
