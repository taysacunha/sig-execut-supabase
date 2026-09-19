# Corrigir venda de dias na edição de férias

## Diagnóstico confirmado no código

O formulário mantém a venda em dois estados diferentes: o campo visível começa em `dias_vendidos` do formulário, mas a confirmação e a gravação usam `excDiasVendidos`. Ao marcar “Vender dias” e informar 10 pela primeira vez, o bloco estruturado pode abrir antes de esses estados estarem sincronizados; assim, o resumo visual já mostra a venda, mas o payload usado na confirmação ainda pode sair com zero ou com valores anteriores. Isso explica por que alterar outro dado e salvar novamente faz a venda aparecer.

Há também dois riscos relacionados na distribuição dos períodos: efeitos automáticos podem reconstruir períodos com datas vazias, e a troca para “Ambos” pode reaproveitar a data do 2º período no 1º. Esses caminhos podem provocar perdas ou combinações incorretas em outros casos futuros.

Não foi possível confirmar os valores atuais de Taysa e Germana no banco porque a leitura está bloqueada pela preferência de aprovação. A correção não dependerá de alterar os registros delas manualmente.

## Correção

1. **Uma fonte única para a venda**
   - Sincronizar imediatamente a primeira digitação de “Quantidade de dias a vender” com o estado estruturado.
   - Montar confirmação e salvamento a partir de um único objeto consolidado, evitando diferença entre o que aparece no formulário e o que é enviado.
   - Garantir que `vender_dias`, `dias_vendidos`, `quinzena_venda`, `dias_vendidos_q1/q2`, distribuição e períodos sejam calculados juntos.

2. **Distribuição correta no cenário apresentado**
   - Venda de 10 dias no 2º período + gozo de 5 dias no 2º período em 22/09/2026–26/09/2026 deve gerar, já no primeiro clique em Salvar:
     - “Vende dias: Não → Sim”;
     - “Dias vendidos: —/0 → 10”;
     - venda atribuída ao 2º período;
     - período real de gozo de 5 dias exibido na confirmação.
   - Manter as datas oficiais 22/09/2026–06/10/2026 não poderá esconder a alteração.

3. **Impedir sobrescritas automáticas**
   - Ajustar a inicialização/reconciliação de períodos para não apagar datas preenchidas nem copiar a data do 2º período para o 1º.
   - Preservar períodos existentes quando os dias vendidos ou a distribuição forem atualizados.
   - Validar a distribuição por período sem depender da alteração artificial das datas oficiais.

4. **Persistência e atualização da tela**
   - Salvar de forma coerente o registro principal e os períodos de gozo.
   - Atualizar também os dados dos períodos após o salvamento, evitando que a tabela ou uma reabertura usem informação anterior em memória.
   - Conferir a exibição “Vendido: 10 dias” no 2º período e a reabertura do diálogo.

5. **Testes de regressão**
   - Adicionar testes para a montagem do payload e do comparativo “antes → depois”.
   - Cobrir: primeira edição sem mudar datas oficiais; venda no 1º e 2º períodos; distribuição em um ou ambos; reabertura e segunda edição; registros antigos sem subperíodos.
   - Reproduzir o cenário da Taysa na interface e verificar confirmação, salvamento, tabela e reabertura.

6. **Histórico de desenvolvimento**
   - Registrar esta correção de forma aditiva e idempotente em `dev_tracker_log`, sem alterar registros existentes.

## Detalhes técnicos

- Refatorar a preparação dos dados em `FeriasDialog.tsx` para receber explicitamente o estado consolidado, em vez de ler estados paralelos durante o submit.
- Simplificar os efeitos de `ExcecaoPeriodosSection.tsx`, deixando mudanças destrutivas somente em ações explícitas do usuário.
- Ajustar a invalidação do cache de `ferias_gozo_periodos` junto com `ferias_ferias`.
- Extrair a lógica pura necessária para testes sem depender da renderização completa do diálogo.
- Nenhuma mudança de estrutura do banco é prevista para corrigir o comportamento funcional.
