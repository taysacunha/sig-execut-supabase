Vou corrigir apenas a regra de disponibilidade do preview de folgas de sábado, sem mexer no cadastro de férias nem no card de gozo interno.

Plano:

1. Centralizar a regra de bloqueio por férias no `GeradorFolgasDialog`
- Usar sempre os períodos reais de gozo (`ferias_gozo_periodos`) quando existirem.
- Continuar caindo para `gozo_diferente` ou quinzenas oficiais quando não houver subperíodos reais.
- Mesclar períodos consecutivos/colados do mesmo colaborador para tratar corretamente 15/06–29/06 + 30/06–14/07 como um único bloco contínuo.

2. Ajustar a decisão mensal de bloqueio
- Bloco de férias de 15 dias ou mais dentro de um único mês: bloqueia esse mês.
  - Exemplo: Pedro com 15 dias em julho fica indisponível em julho.
- Bloco contínuo de 30 dias ou mais que cruza meses: bloqueia todos os meses tocados.
  - Exemplo: Amally com 30 dias seguidos de junho a julho fica indisponível em junho e julho.
- Bloco contínuo menor que 30 dias cruzando dois meses: bloqueia apenas o mês com mais dias de férias e libera o mês com menos dias.
  - Exemplo: Vandermberg 20/07–03/08 fica bloqueado em julho e disponível em agosto.
- Blocos curtos no mês, como 1 dia em julho, continuam não bloqueando o mês inteiro.

3. Remover/atualizar a lógica conflitante atual
- A regra atual `>= 15 dias contínuos que toca o mês` está errada para casos como Vandermberg, porque bloqueia também o mês com poucos dias.
- Vou substituir por contagem de dias do bloco em cada mês tocado, mantendo a exceção dos 30 dias contínuos.

4. Atualizar textos do preview/configuração para refletir a regra real
- Trocar mensagens genéricas como “Sem folga em mês com férias” por algo alinhado à regra aplicada, evitando interpretação errada.
- Manter o comportamento configurável existente (`Bloquear em mês com férias` e `Férias em dois meses`) sem criar novas configurações.

5. Validar com cenários explícitos
- Pedro: 15 dias em julho → excluído/bloqueado em julho.
- Amally: 30 dias contínuos atravessando junho/julho → excluída/bloqueada nos dois meses.
- Vandermberg: 20/07–03/08 → bloqueado em julho, disponível em agosto.
- Maria de Lourdes: 1 dia em julho → disponível em julho.