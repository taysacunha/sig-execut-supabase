Plano de correção

1. Regras de folga de sábado por férias
- Ajustar `GeradorFolgasDialog` para calcular o bloqueio sempre pelos períodos reais de gozo:
  - `ferias_gozo_periodos` quando existir;
  - senão `gozo_quinzena*_inicio/fim` quando houver gozo diferente;
  - senão `quinzena*_inicio/fim`.
- Unificar períodos contíguos ou sobrepostos antes de decidir o bloqueio.
- Nova regra: se o colaborador tiver 15 dias ou mais seguidos de gozo real, ele fica bloqueado em todos os meses tocados por esse bloco contínuo. Isso cobre o caso Amally: 15/06 a 29/06 + 30/06 a 14/07 vira um bloco único de 30 dias, bloqueando junho e julho.
- Manter liberação para férias curtas no mês: se houver apenas poucos dias de férias reais no mês, como Maria de Lourdes com 1 dia em julho, não bloquear por férias.
- Corrigir o caso Pedro: 15 dias diretos em julho bloqueiam julho.
- Melhorar os motivos mostrados no preview/diagnóstico para diferenciar “15+ dias seguidos”, “30 dias seguidos em dois períodos”, “férias no mês principal” e casos curtos liberados.

2. PDF da página Colaboradores
- Adicionar botão “PDF” na página de colaboradores ao lado de filtros/novo colaborador.
- Gerar PDF usando os dados já filtrados e pesquisados na tela, não a lista completa bruta.
- Colunas: colaborador, setor, cargo e admissão, respeitando a ordenação/filtros atuais.
- Nomear o arquivo com data, por exemplo `colaboradores-filtrados-YYYY-MM-DD.pdf`.

3. Auditoria mais útil
- Ampliar a pesquisa da auditoria de módulos para buscar também por:
  - usuário/e-mail;
  - ação traduzida (`inseriu`, `alterou`, `excluiu` etc.);
  - tabela traduzida (`colaborador`, `férias`, `folga` etc.);
  - valores dentro de `old_data`, `new_data` e campos alterados, incluindo nome de colaborador quando estiver no JSON.
- Traduzir nomes técnicos de campos para rótulos legíveis, evitando mostrar só `id`, `colaborador_id`, `setor_titular_id` etc. quando houver valor mais claro disponível.
- Criar uma coluna/resumo “Registro” para mostrar o alvo tratado, por exemplo `Colaborador: Maria de Lourdes`, quando os dados do log permitirem.
- No detalhe expandido, trocar o JSON bruto por comparação tratada campo a campo, mantendo JSON bruto apenas como fallback quando não houver tradução segura.
- Aumentar a área útil da tabela/remover a altura fixa pequena e permitir visualizar muito mais linhas: manter paginação com opções maiores e adicionar 200 linhas por página, além de carregar até 5000 registros como já existe.

4. Validação
- Criar testes unitários para a função de elegibilidade/bloqueio de folgas cobrindo Amally, Maria de Lourdes e Pedro.
- Conferir no código que a geração usa somente períodos reais de gozo e não confunde período cadastrado, venda ou exceção.
- Validar que o PDF usa exatamente o filtro ativo e que a auditoria pesquisa pelos termos tratados.