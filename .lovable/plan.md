
Objetivo
- Corrigir de forma visível e confiável 3 frentes: edição dos períodos flexíveis da Taysa, card “Próximas Férias” no dashboard, e conflitos entre férias x afastamentos.

O que achei no código
1. Edição ainda falha por restauração incompleta
- Em `src/components/ferias/ferias/FeriasDialog.tsx`, os `ferias_gozo_periodos` são buscados.
- Porém a UI da exceção depende também de `excecaoTipo` e `distribuicaoTipo`.
- Hoje esses valores vêm só de flags do registro principal (`gozo_flexivel`, `gozo_diferente`, `distribuicao_tipo`, `vender_dias`).
- Se essas flags estiverem inconsistentes/incompletas, os períodos até entram em `excPeriodos`, mas a seção continua sem renderizar os blocos certos.
- Isso explica o “não aparece nada” mesmo havendo períodos cadastrados.

2. O caso da Taysa indica dado inconsistente que a UI hoje aceita
- Os períodos citados estão fora de ordem cronológica.
- O sistema atual salva `numero` por ordem do array, não pela ordem real das datas.
- Não existe validação forte para impedir subperíodos fora de sequência ou cronologicamente incoerentes no fluxo flexível.

3. Dashboard ainda pode falhar no caso de datas flexíveis problemáticas
- `src/pages/ferias/FeriasDashboard.tsx` já resolve inícios a partir de `ferias_gozo_periodos`.
- Mas, com períodos inconsistentes, ele pode priorizar uma data errada como “próxima” ou exibir comportamento confuso.
- Precisa ordenar os subperíodos por data real antes de decidir qual é o próximo início.

4. Conflitos com afastamentos não estão integrados no fluxo de férias
- `src/components/ferias/colaboradores/AfastamentosSection.tsx` alerta conflito com férias ao cadastrar afastamento.
- Mas `src/components/ferias/ferias/FeriasDialog.tsx` não busca afastamentos do colaborador para bloquear/alertar novas férias.
- `src/pages/ferias/FeriasFerias.tsx` também não mostra sinalização visual para férias já cadastradas que conflitam com afastamento.

Implementação proposta
1. Blindar a restauração dos períodos no editar férias
- Em `FeriasDialog.tsx`, inferir `excecaoTipo` e `distribuicaoTipo` também a partir dos próprios `ferias_gozo_periodos` carregados, não só dos campos da tabela principal.
- Regra:
  - se houver `tipo=gozo_diferente`, abrir a seção correta;
  - se houver `referencia_periodo` 1 e 2, tratar como `ambos`;
  - se houver vários subperíodos do mesmo período, continuar mostrando a lista;
  - se houver `referencia_periodo=0`, tratar como `livre`.
- Só liberar a UI depois da hidratação completa.

2. Validar e normalizar períodos flexíveis
- No salvar:
  - ordenar subperíodos por `data_inicio`;
  - impedir datas fora de ordem;
  - impedir sobreposição entre subperíodos;
  - impedir sequência “março e depois fevereiro”;
  - validar coerência com os períodos oficiais.
- Mostrar erro claro antes de salvar.

3. Ajustar “Próximas Férias”
- Em `FeriasDashboard.tsx`, ordenar todos os `ferias_gozo_periodos` por `data_inicio` antes de escolher o próximo início.
- Usar sempre a menor data futura válida dentro da janela.
- Assim, o 24/04 passa a ser capturado corretamente se estiver nos subperíodos reais e não houver dado anterior inválido atrapalhando a escolha.

4. Mostrar conflitos de férias com afastamentos
- Em `FeriasDialog.tsx`:
  - buscar afastamentos do colaborador;
  - resolver os intervalos reais de férias;
  - detectar interseção entre férias e afastamentos;
  - exibir alerta forte com os períodos conflitantes;
  - exigir ajuste das datas antes de salvar, ou no mínimo exigir exceção explícita se essa for sua regra.
- Também mostrar todos os afastamentos do colaborador no formulário ao agendar férias.

5. Sinalização na página de férias
- Em `src/pages/ferias/FeriasFerias.tsx`:
  - calcular quais registros de férias conflitam com afastamentos;
  - exibir badge/alerta por linha, algo como “Conflito com afastamento”;
  - opcionalmente destacar a coluna de períodos.
- Isso atende ao pedido de “na página de férias deve ter algo que sinalize isso”.

Arquivos a ajustar
- `src/components/ferias/ferias/FeriasDialog.tsx`
- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`
- `src/pages/ferias/FeriasDashboard.tsx`
- `src/pages/ferias/FeriasFerias.tsx`

Resultado esperado
- Ao editar a Taysa, os 4 períodos aparecem de fato.
- O sistema não deixa salvar subperíodos fora da ordem cronológica.
- O 24/04 aparece no card “Próximas Férias” quando for o próximo início válido.
- Ao cadastrar ou editar férias, os afastamentos do colaborador aparecem e conflitos são sinalizados.
- Na tabela de férias, registros em conflito com afastamento ficam marcados visualmente.

Detalhe importante
- Eu não vou corrigir o dado inconsistente da Taysa neste modo de leitura, porque isso exige alteração de dados/código.
- Na implementação, além da correção da UI, vou deixar o sistema impedir que esse tipo de inconsistência volte a acontecer.
