## Diagnóstico

O problema atual está no `GeradorFolgasDialog.tsx`, na consulta e na regra que decide se o colaborador deve ser bloqueado por férias no mês.

Principais falhas encontradas:

1. **Filtro Supabase incorreto para férias do mês**
   - A consulta usa:
     ```ts
     .or(`quinzena1_inicio.lte.${monthEnd},quinzena2_fim.gte.${monthStart}`)
     ```
   - Isso é um `OU`, não uma checagem real de sobreposição.
   - Resultado: pode trazer férias fora do mês e também pode deixar passar férias relevantes dependendo de `quinzena2_fim`, campos nulos, gozo diferente ou subperíodos.

2. **A regra de “férias em dois meses” está invertida no nome/efeito**
   - A função `shouldSkipDueToTwoMonthVacation` retorna `false` justamente quando deveria bloquear e `true` quando deveria liberar, o que deixa a leitura propensa a erro.
   - Para Gabriella, o esperado é: se a maior parte das férias foi em maio e poucos dias em junho, ela deve poder entrar no preview de junho.
   - Para Luciano/Rejane/Amally, se têm férias majoritárias ou normais em junho, devem ser excluídos.

3. **Busca depende demais dos campos agregados das quinzenas**
   - O cálculo final usa `getGozoRanges`, que é correto, mas a consulta inicial pode não trazer todos os registros necessários para o cálculo.
   - A forma mais segura é buscar férias ativas de forma mais ampla no ano/meses próximos e fazer a sobreposição real no client usando os intervalos reais de gozo.

## Plano de correção

1. **Substituir a consulta de férias do gerador de folgas**
   - Buscar férias não canceladas/reprovadas em uma janela segura ao redor do mês selecionado.
   - Incluir todos os campos necessários de gozo normal, gozo diferente e gozo flexível.
   - Evitar o `.or()` atual que não representa sobreposição real.

2. **Criar helpers explícitos para a regra de férias**
   - `getVacationDaysByMonth(colabId)` para contar dias reais de gozo por mês.
   - `isSecondaryMonthForTwoMonthVacation(colabId)` para dizer claramente se o mês atual é o mês com menos dias.
   - `shouldBlockVacationMonth(colabId)` para centralizar a decisão:
     - sem férias no mês: não bloqueia;
     - férias só em um mês: bloqueia;
     - férias em dois meses: bloqueia no mês com mais dias e libera no mês com menos dias;
     - empate: bloqueia por segurança.

3. **Aplicar a regra no preview**
   - Excluir quem estiver de férias no mês principal.
   - Liberar quem tiver férias atravessando dois meses apenas no mês secundário.
   - Manter as demais regras existentes: experiência, perda registrada, afastamento, familiares, chefes e distribuição.

4. **Melhorar o motivo exibido no preview**
   - Quando bloquear por férias, exibir motivo mais claro, por exemplo:
     - `Férias no mês`
     - `Férias no mês principal`
   - Isso ajuda a conferir por que Gabriella foi liberada ou bloqueada.

5. **Validar sem alterar banco de dados**
   - Não será necessária migration.
   - Validar a lógica por inspeção/checagem local do TypeScript e do fluxo do componente.
   - Se possível, usar os dados visíveis no preview depois da implementação para confirmar que Luciano/Rejane/Amally saem e Gabriella entra em junho.