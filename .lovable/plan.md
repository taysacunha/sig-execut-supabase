Plano de correção cirúrgica para o preview de folgas:

1. Corrigir a origem dos dados de férias no gerador de folgas
- O preview hoje busca `ferias_ferias` filtrando primeiro pelas datas oficiais (`quinzena1/quinzena2`). Isso pode deixar de trazer férias cujo gozo interno real foi alterado para outro mês.
- Vou trocar essa busca para carregar as férias não-terminais do período amplo necessário e decidir a sobreposição no client com os períodos reais de gozo.
- Assim, Pedro com 15 dias reais em julho será considerado em julho mesmo que o oficial enviado ao contador seja diferente.

2. Consolidar uma única regra de bloqueio mensal
- Usar sempre `ferias_gozo_periodos` quando houver períodos internos reais.
- Se não houver subperíodos, cair para `gozo_quinzena*` e depois para `quinzena*`.
- Bloquear o mês quando houver 15 ou mais dias reais de férias dentro daquele mês.
- Para férias contínuas cruzando meses com menos de 30 dias, bloquear só o mês com mais dias e liberar o mês com menos dias.
- Para férias contínuas de 30 dias ou mais, bloquear todos os meses tocados pelo bloco.
- Férias curtas no mês, como 1 dia, não bloqueiam o mês inteiro; bloqueiam apenas o sábado dentro do período se houver.

3. Evitar preview gerado com dados incompletos
- Adicionar os estados de carregamento das queries de férias e `ferias_gozo_periodos`.
- Desabilitar “Gerar Preview” enquanto esses dados ainda estiverem carregando.
- Isso evita o gerador cair no fallback errado antes dos períodos internos chegarem.

4. Ajustar motivos exibidos no preview
- Mostrar motivo claro quando alguém for excluído por férias, por exemplo: `Férias 15 dias no mês (01/07–15/07)`.
- Manter os demais motivos existentes sem alterar cadastro, migrations ou o card de gozo interno.