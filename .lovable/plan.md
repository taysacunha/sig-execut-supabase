
Objetivo: parar de gastar crédito à toa e corrigir só os 3 pontos que ainda estão realmente quebrados.

O que está errado de verdade
1. Edição da Taysa ainda falha porque o carregamento dos subperíodos depende de flags do registro principal (`gozo_flexivel`, `vender_dias`, `gozo_diferente`). Se essas flags estiverem inconsistentes, o dialog não monta a seção certa, mesmo existindo linhas em `ferias_gozo_periodos`.
2. O dashboard ainda não é confiável para “Próximas Férias” porque continua dependendo de uma combinação de status/flags. Para o seu caso, ele precisa simplesmente olhar as datas reais cadastradas e listar a próxima data futura válida.
3. O filtro do PDF/tabela do contador que você está usando fica em `src/pages/ferias/FeriasFerias.tsx`, não no componente separado de relatórios. Ou seja: parte da correção anterior foi feita no lugar errado para o fluxo que você está usando em `/ferias/ferias`.

Plano de correção
1. Corrigir a edição para sempre carregar os períodos reais
- Arquivo: `src/components/ferias/ferias/FeriasDialog.tsx`
- Ao editar, buscar `ferias_gozo_periodos` sempre, independentemente de `gozo_flexivel`.
- Se existirem subperíodos:
  - forçar abertura do modo exceção;
  - inferir `excecaoTipo` pelo campo `tipo`;
  - inferir `distribuicaoTipo` pelos `referencia_periodo`;
  - popular `excPeriodos` com todos os períodos em ordem cronológica.
- Resultado esperado: a Taysa abre com os 4 períodos visíveis, sendo 3 no 1º período e 1 no 2º.

2. Blindar a UI para não esconder os períodos carregados
- Arquivo: `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`
- Manter a proteção de hidratação, mas impedir reinicialização quando já existem períodos carregados da edição.
- Garantir renderização correta quando houver múltiplos subperíodos no mesmo `referencia_periodo`.

3. Corrigir “Próximas Férias” com base nas datas reais cadastradas
- Arquivo: `src/pages/ferias/FeriasDashboard.tsx`
- Montar a lista de inícios futuros a partir de:
  - todos os `ferias_gozo_periodos.data_inicio`;
  - fallback para datas oficiais só quando um período não tiver subperíodo correspondente.
- Ordenar tudo cronologicamente e pegar a menor data futura dentro da janela.
- Não deixar o card depender de flag inconsistente para decidir se mostra ou não.
- Resultado esperado: 24/04 da Taysa passa a aparecer.

4. Corrigir a tabela/PDF do contador no lugar certo
- Arquivo: `src/pages/ferias/FeriasFerias.tsx`
- Aplicar o filtro de período na tabela da aba “Contador” e no PDF dessa mesma página:
  - filtro “1” = mostrar/exportar só 1º período;
  - filtro “2” = mostrar/exportar só 2º período;
  - “Ambos” = mostrar/exportar os dois.
- Ajustar cabeçalhos, colunas e conteúdo do PDF para seguirem exatamente a seleção atual.
- Isso evita o comportamento atual de sempre trazer os dois períodos.

5. Impedir repetição do erro de fevereiro depois de março
- Arquivo: `src/components/ferias/ferias/FeriasDialog.tsx`
- No salvar:
  - ordenar por `data_inicio`;
  - bloquear subperíodos fora de ordem;
  - bloquear sobreposição;
  - bloquear sequência cronológica inválida.
- Observação importante: eu não vou “adivinhar” a data correta do período errado de fevereiro. O que dá para fazer com segurança é: fazer ele aparecer na edição e impedir que isso volte a ser salvo assim.

Arquivos exatos
- `src/components/ferias/ferias/FeriasDialog.tsx`
- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`
- `src/pages/ferias/FeriasDashboard.tsx`
- `src/pages/ferias/FeriasFerias.tsx`

Critérios de aceite
- Editar Taysa mostra os 4 períodos cadastrados.
- A seção correta (“Gozo em datas diferentes”/exceção) já abre preenchida.
- Dashboard mostra Taysa em “Próximas Férias” com 24/04.
- Na aba Contador em `/ferias/ferias`, escolher 1, 2 ou ambos muda a tabela e o PDF de forma consistente.
- Não é mais possível salvar subperíodos fora da ordem cronológica.

Sobre os créditos
- Eu não consigo devolver/refundar créditos por aqui.
- O que eu consigo fazer agora é evitar mais desperdício: a próxima implementação tem que ser um patch único nesses 4 arquivos, sem mexer em caminhos paralelos.
