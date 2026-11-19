# Formulário anual com 3 meses e preferência (caso Ivone)

## Situação atual (verificada)
Ivone: meses Fevereiro, Maio e Outubro, preferência Outubro, formato 15/15, sem datas exatas.

Problemas encontrados:
1. **No gerador, o mês preferido é usado mesmo com conflito.** Ele testa Outubro e fica com a "menos pior" das janelas. Fevereiro e Maio nunca são testados para esse período.
2. **No 2º período, só o primeiro mês restante é testado (Fevereiro).** Se Fevereiro tiver conflito, Maio é ignorado e o sistema procura qualquer data livre no ano.
3. **No formulário, as sugestões de data usam os 2 primeiros meses em ordem cronológica (Fev e Mai).** Outubro, que é o preferido, fica de fora. Por isso parece que só cabem 2 meses.
4. Não há indicação, na prévia, de quais meses do formulário foram atendidos.

## Regra proposta
O gestor transcreve o formulário entregue pelo colaborador: até 3 meses, qual é o preferido, o formato (15/15 ou 30 dias) e datas exatas, se houver (opcionais). O sistema decide a combinação final:

- **15/15:** testa pares de meses diferentes. O par deve incluir o mês preferido. Ordem de escolha:
  1. par com o mês preferido e sem conflito
  2. outro par sem conflito
  3. sugestão livre dentro do período concessivo, sem conflito
  4. se nada estiver livre, o par com o mês preferido e menos conflitos vai para "Com conflitos"
  Para Ivone, a ordem seria: Out+Fev, Out+Mai, Fev+Mai etc. O resultado sempre fica em ordem cronológica (ex.: Fev = 1º, Out = 2º).
- **30 dias:** testa primeiro o mês preferido, depois os outros meses, e só usa conflito se todos falharem.
- **Datas exatas preenchidas** continuam valendo mais que tudo e não são trocadas.
- Os meses escolhidos também precisam respeitar o período concessivo e não podem se sobrepor.

## Ajustes no formulário (Editar Formulário)
- Manter os 3 campos de mês e a escolha do preferido. Nenhum mês é obrigatório; mostrar apenas avisos.
- No 15/15, os campos de data continuam opcionais. A dica de cada campo passa a mostrar "um dos meses: Fevereiro, Maio ou Outubro (preferido)", sem prender um campo a um mês.
- Texto curto explicando: "Sem datas exatas, o sistema escolhe 2 dos meses informados, priorizando o preferido."

## Ajustes na prévia (Gerar Férias)
- Nova informação por colaborador: meses atendidos e se o preferido foi atendido (ex.: "Preferido Out: atendido" ou "não atendido – conflito com X").
- Detalhes do formulário: mostrar os 3 meses e marcar o preferido.

## Detalhes técnicos
- `vacationGenerator.ts`: substituir o loop por mês por avaliação de candidatos (pares de meses no 15/15 e meses únicos no 30 dias). Ordenar por: sem conflito, inclui o preferido, menos conflitos e ordem do formulário. Para cada candidato, usar `generateCandidateWindows` (dias 1, 8, 16 e 23) e validar sobreposição e período concessivo. Manter datas fixas como hoje e a troca cronológica no final. Adicionar `meses_atendidos` e `preferencia_atendida` em `GeneratedVacation`.
- `PreviewFeriasTable.tsx`: mostrar o novo indicador.
- `FormularioAnualDialog.tsx`: atualizar as dicas dos campos de data para a lista de meses e o texto explicativo. A validação de datas continua só cronológica e sem sobreposição.
- `FormularioAnualViewDialog.tsx`: mostrar os 3 meses com o preferido marcado.
- Testes em `src/lib`: preferido livre; preferido com conflito → par alternativo; resultado em ordem cronológica; datas exatas preservadas; 30 dias usa o mês alternativo.
- Registrar a entrega no `dev_tracker_log`.
