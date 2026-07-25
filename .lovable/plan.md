# Correções no Calendário de Despesas

## Problemas identificados

### 1. Duplicação ao ativar "Repetir automaticamente"
Ao salvar um novo lançamento com recorrência ativa, o `LancamentoDialog` cria **dois registros**:
- um lançamento manual (via `saveMut`) na data escolhida;
- uma recorrência (via `saveRecMut`) cujo trigger `despesas_gerar_ocorrencias` **também** gera a primeira ocorrência no mesmo mês/dia.

Resultado: duas linhas com o mesmo dia/mês/ano na tabela. Quando o índice único `uq_desp_lanc_serie_venc` bloqueia, o `ON CONFLICT DO NOTHING` faz o segundo ficar de fora, mas o manual (sem `serie_recorrencia_id`) permanece — dando a impressão de que a recorrência "não avançou os meses".

### 2. Não há como reverter status "quitado", "gimob" ou "pago"
Uma vez marcado como terminal, não existe caminho de volta. A função `despesas_recalcular_lancamento` protege explicitamente esses estados. Falta um botão de **estorno com justificativa auditada**.

## Correções propostas

### Frontend — `src/components/despesas/LancamentoDialog.tsx`
Quando **for um novo lançamento** e `rec.ativa === true`, **não** chamar `saveMut`. Criar somente a recorrência — o trigger cuida da primeira ocorrência. Credenciais também não são gravadas neste caminho (não há lançamento manual para associar; ficam disponíveis ao editar cada ocorrência gerada).

Edição continua idêntica (nunca cria série).

### Frontend — `src/hooks/useDespesasLancamentos.ts`
Novo hook `useEstornarLancamento`:
1. Recebe `{ id, justificativa }` (mín. 10 caracteres).
2. `UPDATE despesas_lancamentos SET status='a_vencer', valor_pago=0 WHERE id=?` (destrava o estado terminal antes de mexer nos pagamentos).
3. `DELETE FROM despesas_lancamento_pagamentos WHERE lancamento_id=?` — o trigger `despesas_recalcular_lancamento` recalcula corretamente (agora em estado não-terminal).
4. `INSERT INTO module_audit_logs` com `action='ESTORNO_LANCAMENTO'`, `old_data={status, valor_pago}`, `new_data={justificativa}`.
5. Invalida `LANC_KEY`.

### Frontend — `src/pages/despesas/DespesasCalendario.tsx`
Novo botão "Estornar" (ícone `RotateCcw`) visível quando `status ∈ {pago, quitado, gimob}` e `canEdit`. Abre `AlertDialog` com `Textarea` obrigatório (mín. 10 chars) e confirmação.

## Fora do escopo

- Não alteramos a função SQL `despesas_gerar_ocorrencias` — o loop mensal já está correto; o bug estava só no dialog.
- Não mexemos em pagamentos de outros módulos (repasses).

## Detalhes técnicos

- Nenhuma migration nova necessária (a tabela `module_audit_logs` já existe e o trigger de recálculo já reage a `DELETE` em `despesas_lancamento_pagamentos`).
- Toast de sucesso do caminho "criando série" passa a explicar que a ocorrência do mês atual também é criada automaticamente.
