# Venda de férias: 5 dias no 1º período + 5 no 2º

## Escopo confirmado

Adicionar a opção **“5 dias no 1º + 5 dias no 2º” apenas quando a venda total for exatamente 10 dias**, mantendo as opções atuais de 10 dias no 1º ou no 2º. Vendas menores ou maiores não ganham uma nova regra de divisão.

## O que a investigação confirmou

- O seletor, a consolidação do formulário e o relatório do contador tratam a alocação oficial como um único período. Só adicionar uma opção visual deixaria o relatório incorreto.
- O banco já possui `dias_vendidos_q1` e `dias_vendidos_q2`, mas `quinzena_venda` aceita somente 1 ou 2. Não há, nos gatilhos consultados dessa tabela, validação específica da divisão da venda.
- Nas vendas acima de 10 dias, os campos de dias por período também representam a distribuição interna real. Portanto, não podem ser reutilizados indiscriminadamente para alterar a alocação contábil dessas exceções.
- A distribuição do gozo é separada da alocação enviada ao contador. A nova escolha não deve apagar datas, redistribuir o descanso automaticamente nem modificar as datas oficiais.
- Existem proteções para primeiro período já concluído, correção histórica justificada e datas já enviadas ao contador. O cancelamento do segundo período atualmente verifica uma venda atribuída apenas ao segundo; precisará reconhecer também a divisão.
- O bloqueio de folgas depende das datas de descanso. Há leitores de férias em calendários e na tabela de sábados que ainda interpretam a venda como pertencente a um único período.

## Solução proposta

### 1. Nova opção, sem transformar o cadastro em exceção

- Com quantidade igual a 10, oferecer três escolhas: **10 no 1º**, **10 no 2º** e **5 no 1º + 5 no 2º**.
- Mostrar no resumo e na confirmação: total de 10 dias, sendo 5 em cada período.
- Ao mudar a quantidade para um valor diferente de 10, solicitar uma alocação válida antes de salvar; não converter silenciosamente a divisão em venda de um único período.
- Usar “1º/2º período de férias” no texto dessa escolha para não confundir esses períodos com o intervalo aquisitivo anual.

### 2. Separar alocação contábil e descanso efetivo

- Consolidar a venda em uma única preparação dos dados, usada pela confirmação, gravação e reabertura.
- Na venda padrão dividida, gravar total 10 e dias por período 5/5, com identificação explícita de alocação em ambos.
- Preservar o formulário de gozo, as datas preenchidas e a distinção entre datas oficiais e datas efetivas.
- Continuar validando o saldo total, os limites de distribuição de gozo, a ordem cronológica, sobreposições, afastamentos e conflitos aplicáveis.
- A escolha contábil 5/5 não força automaticamente gozo de 10/10. Quando o descanso também for distribuído assim, validar 20 dias de gozo + 10 vendidos, sem contar a venda duas vezes.

### 3. Respeitar bloqueios e histórico

- Não permitir uma nova alocação no primeiro período já concluído pelo fluxo comum. Manter a correção histórica existente com justificativa e confirmação, incluindo a divisão quando autorizada.
- Reconhecer uma divisão histórica já gravada ao reabrir, sem convertê-la para o segundo período ou perder os 5 dias do primeiro.
- Conferir as marcações de envio ao contador de ambos os períodos. Alterações em alocação já enviada não poderão contornar as proteções: orientar a correção pelo fluxo autorizado, com registro do antes/depois.
- Não oferecer a divisão quando o segundo período estiver cancelado ou ausente.
- Se houver venda dividida ao cancelar o segundo período, exigir resolução explícita da alocação antes de concluir; não remover os 5 dias silenciosamente nem mover os 10 para outro período.

### 4. Relatório e demais telas

- No relatório do contador, o filtro **1º período** mostrará 5 vendidos; **2º período**, 5; **Ambos**, total 10 com identificação de 5 + 5.
- Calcular os dias contábeis de gozo descontando 5 de cada período, sem descontar novamente das datas de gozo efetivo. Para períodos oficiais de 15 dias, o resultado será 10 dias em cada um.
- Ajustar a visualização e o PDF, incluindo a apresentação completa da divisão.
- Conferir listagem de férias, detalhes, Consulta Geral, comparativo de alterações, auditoria, premiações, calendários e PDF do calendário para não tratarem a divisão como 10/0 ou 0/10.
- Preservar os resultados dos registros antigos e das vendas acima de 10 dias.

### 5. Folgas

- Conferir os caminhos de geração e visualização de folgas que interpretam férias, incluindo a tabela de sábados.
- Garantir que usem os períodos efetivos de ausência, inclusive os subperíodos, sem inferir toda a venda em apenas um lado.
- Manter as regras configuradas de bloqueio por mês de férias e férias atravessando dois meses; não criar direito a uma folga apenas por existir um dia vendido.

## Detalhes técnicos

- Ampliar `quinzena_venda` com um valor explícito para **alocação em ambos**, documentado como modo de alocação, não como um terceiro período. Manter 1/2 para compatibilidade.
- Ajustar a restrição do banco e adicionar validação por gatilho: o novo modo exige venda ativa, total exatamente 10 e distribuição 5/5; rejeitar combinações incoerentes e segundo período cancelado/ausente. Não normalizar nem reescrever registros antigos em massa.
- Para o relatório, resolver separadamente a alocação contábil: modos existentes mantêm seu comportamento, incluindo o limite atual de 10 nas exceções; o novo modo retorna 5/5. Não usar os campos internos das exceções como substitutos indiscriminados dessa regra.
- Atualizar os leitores binários de `quinzena_venda`, a hidratação do formulário e a auditoria histórica. Reaproveitar a lógica compartilhada de venda para evitar cálculos divergentes.
- Preservar permissões atuais; registrar o desenvolvimento em `/dev` e a decisão estrutural em `AGENTS.md` durante a implementação.

## Validação antes de concluir

- Testes concretos para 10/0, 0/10 e 5/5; nova opção rejeitada para 5, 9, 11 e 15 dias vendidos.
- Relatório: filtros individuais retornam 5, filtro conjunto retorna 10, gozo contábil 10/10 em períodos oficiais de 15 dias.
- Confirmar salvamento no primeiro clique sem alterar datas oficiais, reabertura mantendo 5/5 e troca entre as três opções sem perder datas de gozo.
- Cobrir primeiro período concluído, correção histórica, envio ao contador, segundo período cancelado e conservação dos registros legados/exceções.
- Testar validação no banco, saldo aquisitivo, premiações e bloqueios de folgas com ausência real em um ou dois meses.
- Conferir a sequência completa na interface quando houver sessão de teste disponível. Neste Supabase externo, a validação visual autenticada não está disponível automaticamente; resultados de testes de lógica/banco serão informados separadamente, sem alegar uma conferência visual não realizada.