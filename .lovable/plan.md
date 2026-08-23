# Corrigir persistência do período histórico da venda

## Diagnóstico confirmado no código

Ao reabrir uma férias cujo 1º período já foi gozado, o diálogo redefine a correção histórica como inativa. Com isso, `q1BloqueadoParaVenda` volta a ser verdadeiro e o seletor exibe obrigatoriamente o **2º período**, mesmo quando o registro recebido possui `quinzena_venda = 1`.

O mesmo bloqueio também entra na montagem do payload. Portanto, além de exibir o valor errado, uma edição posterior de outro campo pode gravar novamente o **2º período**.

A leitura direta do registro de Anderson no banco foi bloqueada pela preferência atual de aprovação. A implementação começará confirmando o valor efetivamente persistido e o evento de auditoria, sem assumir que o banco já contém `1`.

## Correção

1. **Separar valor histórico válido de autorização para alterá-lo**
   - Se o registro já estiver salvo com `quinzena_venda = 1`, o diálogo deve abrir mostrando **1º período**, ainda que o primeiro período já tenha sido gozado.
   - A ação “Corrigir período histórico” continuará obrigatória apenas para mudar um registro bloqueado de **2º para 1º**; não será exigida novamente para apenas visualizar ou preservar uma correção já salva.

2. **Eliminar sobrescritas durante hidratação e salvamento**
   - Ajustar os efeitos que hoje forçam `2` para não alterarem um valor histórico `1` vindo do banco.
   - Usar uma única resolução de `quinzena_venda` no seletor, no payload, no diff e na auditoria.
   - Garantir que editar outro campo não reverta silenciosamente o período da venda.

3. **Sincronizar a reabertura com o dado atualizado**
   - Após salvar, aguardar/usar o registro atualizado para que uma nova abertura não reutilize o objeto anterior em memória.
   - Manter `quinzena_venda`, `dias_vendidos_q1` e `dias_vendidos_q2` coerentes.

4. **Validar o cenário completo de Anderson**
   - Confirmar no banco o valor antes e depois do salvamento e o registro de `CORRECAO_QUINZENA_VENDA`.
   - Testar: ativar correção, escolher 1º, confirmar alterações, salvar, fechar e reabrir.
   - Testar uma segunda edição sem mexer nesse seletor e confirmar que continua no 1º período.
   - Verificar também o fluxo normal em que o 1º período já foi gozado e nenhuma correção histórica existe: nesse caso, o 2º continua sendo obrigatório.

## Arquivos previstos

- `src/components/ferias/ferias/FeriasDialog.tsx`
- `src/pages/ferias/FeriasFerias.tsx`, somente se a sincronização do registro selecionado exigir ajuste
