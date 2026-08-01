# Reabertura e confirmações no repasse

## Problema
No rodapé do diálogo de repasse, o botão "Reabrir" só aparece quando a competência está **paga**. Ao fechar uma competência (status "fechado"), o botão some e no lugar aparece "Excluir" — não há como voltar ao status "aberto". Além disso, "Fechar" e "Marcar como pago" executam direto, sem confirmação.

## O que será feito

1. **Reabrir competência fechada**
   - O botão "Reabrir <mês>" passa a aparecer para status "fechado" e "pago".
   - Fechado → volta para "aberto" (justificativa opcional).
   - Pago → volta para "aberto" e limpa a data de pagamento, mantendo a justificativa obrigatória (mínimo 10 caracteres), como já é hoje.
   - "Excluir competência" continua disponível apenas quando aberta.

2. **Confirmação ao fechar**
   - "Fechar <mês>" abre uma caixa de confirmação: explica que itens e beneficiários ficam bloqueados para edição e que a ação pode ser desfeita pelo botão Reabrir.

3. **Confirmação ao marcar como pago**
   - "Marcar <mês> como pago" abre uma confirmação com o resumo (líquido e total distribuído), avisando que será criado o lançamento no calendário. As validações atuais (beneficiário definido, soma dentro do líquido) rodam antes de abrir a confirmação.

4. **Ambas reversíveis**
   - Toda reabertura registra um carimbo na observação da competência (data + justificativa quando informada), preservando o histórico.

## Detalhes técnicos
- `src/components/despesas/RepasseDialog.tsx`: condição do botão Reabrir, novos estados de confirmação (`confirmFechar`, `confirmPago`) com AlertDialogs; `confirmarReabertura` exige justificativa apenas quando o status é "pago".
- `src/hooks/useDespesasRepasses.ts`: `useUpdateRepasseStatus` passa a aceitar `data_pagamento: null` para limpar a data ao reabrir uma competência paga.
- Sem migration: o trigger do banco só bloqueia edições enquanto o status é "pago"/"cancelado"; voltar para "aberto" é permitido.