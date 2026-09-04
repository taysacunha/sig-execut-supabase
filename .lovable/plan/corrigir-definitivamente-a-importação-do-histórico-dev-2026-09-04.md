# Corrigir definitivamente a importação do histórico `/dev`

## Problema confirmado

O script atual calcula quanto importar separadamente por `system_name`, mas valida o resultado pelo total geral. Com os dados atuais, essa diferença de critério permite importar **804h** sobre o histórico existente, chegando a **1.381h**, embora o saldo global disponível seja apenas **618h** para fechar em **1.195h**.

A transação foi abortada corretamente e, conforme a própria mensagem, **nada dessa tentativa foi persistido**.

## Correção

1. **Descartar a limitação por sistema** do script atual, pois ela é a origem do estouro.
2. Tirar uma fotografia somente leitura antes da importação, mostrando:
   - total atual de `dev_tracker`;
   - total atual de `dev_tracker_log`;
   - saldo global exato disponível;
   - totais agrupados pelos nomes reais dos sistemas, para deixar qualquer divergência nominal visível.
3. Calcular um único orçamento global:
   - `saldo = SUM(dev_tracker.hours) - SUM(dev_tracker_log.hours)`;
   - abortar antes de inserir se o histórico já estiver acima do acervo;
   - distribuir no máximo esse saldo entre os itens legados ainda não marcados.
4. Importar **todos os itens legados ainda ausentes**:
   - itens que couberem no saldo recebem suas horas integrais;
   - o item de fechamento recebe somente o saldo restante;
   - os demais entram com `0h`, para preservar a lista completa do que foi desenvolvido sem inflar o total;
   - cada item mantém `legacy_key` única, garantindo idempotência.
5. Manter a operação estritamente aditiva: nenhum `DELETE`, `TRUNCATE`, redução ou alteração dos registros históricos existentes.
6. Validar dentro da mesma transação que o total final é exatamente **1.195h**; qualquer valor diferente aborta tudo.
7. Após a execução bem-sucedida, validar na página `/dev`:
   - total geral de 1.195h;
   - ausência do alerta de divergência;
   - itens históricos visíveis em ordem cronológica;
   - segunda execução do script sem duplicar ou alterar o total.

## Detalhes técnicos

- O script será refeito com janela acumulada global, sem `PARTITION BY system_name`.
- A ordenação será determinística para produzir sempre a mesma distribuição de horas.
- A data, origem e bloqueio de edição dos itens legados serão mantidos.
- O script antigo não deverá ser executado novamente.
