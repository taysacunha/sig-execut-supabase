# Férias — período da venda que "volta para o 2º" e venda com distribuição de períodos

## O que foi analisado

Li o diálogo de férias (`FeriasDialog.tsx`), a seção de períodos flexíveis (`ExcecaoPeriodosSection.tsx`) e a listagem (`FeriasFerias.tsx`). Não consegui consultar o registro do Anderson no banco (a ferramenta de leitura SQL está bloqueada por preferência de aprovação), então a causa abaixo é a que o código sustenta e a primeira etapa da execução é confirmá-la com uma consulta ao registro dele.

## Problema 1 — a escolha do 1º período não é salva

No momento de montar o payload, quando o cadastro é exceção/venda com gozo flexível, o campo "Período da venda (enviado ao contador)" **não usa o que o gestor selecionou**: ele é derivado da distribuição do gozo.

- Se a distribuição do gozo é "2º período", o sistema grava `quinzena_venda = 2`, ignorando a seleção "1º" feita com a correção histórica ativa.
- O seletor explícito do gestor só é respeitado quando a distribuição é "ambos" ou "livre".

Resultado: salva, reabre e volta a mostrar "2º".

**Correção:** quando a correção histórica estiver ativa (ou, de forma geral, quando o gestor alterar o seletor manualmente), a escolha explícita do gestor tem prioridade sobre a distribuição do gozo. A derivação por distribuição continua valendo apenas como valor padrão quando o gestor não tocou no campo. A mudança segue sendo registrada em auditoria (`CORRECAO_QUINZENA_VENDA`), como já acontece hoje.

Vale para os dois caminhos: venda padrão (≤10 dias) e venda exceção (gozo flexível).

## Problema 2 — "Vender dias de férias" sem estrutura de períodos

Hoje existem duas experiências diferentes:

- **Gozo em datas diferentes (exceção):** escolhe 1º / 2º / ambos / livre e adiciona quantos sub-períodos quiser, com dias e datas por linha e contador de "dias restantes".
- **Vender dias de férias:** só campos fixos de data de início, sem poder fragmentar o gozo.

**Ajuste:** unificar. Ao marcar "Vender dias de férias":

1. Campo **Quantidade de dias a vender (1–30)**.
2. Em seguida, a mesma estrutura de distribuição do gozo: **1º período / 2º período / ambos**, com botão "Adicionar período", dias e datas por linha.
3. Os dias distribuíveis são exatamente os que **sobraram** após a venda (total do período aquisitivo − dias vendidos), respeitando o teto de 15 dias por período oficial.
4. Continua existindo o seletor "Período da venda (enviado ao contador)", que é o dado do relatório do contador — separado da distribuição interna do gozo.

Sobre a sua observação: **concordo** — a opção **"livre" sai** da venda. Distribuição livre significa datas sem vínculo com 1º/2º período, e a venda precisa saber de qual período os dias foram vendidos (é o que vai ao contador). "Livre" permanece disponível apenas em "Gozo em datas diferentes".

Consequência prática: a venda deixa de ter dois formulários distintos (≤10 dias e >10 dias). Passa a ser um só, e o cadastro só é marcado como exceção quando a venda passa de 10 dias — regra que já existe e é mantida.

## Problema 3 — o que aparece na página de férias

A listagem já lê `dias_vendidos_q1` / `dias_vendidos_q2` e os sub-períodos de gozo. Com a venda passando a gravar sub-períodos como o gozo flexível, ajusto a linha do colaborador para mostrar, de forma consistente: os períodos de gozo reais (cada faixa), os dias vendidos por período e o período da venda enviado ao contador.

## Detalhes técnicos

- `FeriasDialog.tsx`
  - `buildPayloadCore`: prioridade da seleção explícita de `quinzena_venda` sobre `excDistribuicaoTipo`; manter derivação apenas como default.
  - Flag de "usuário alterou o seletor" para distinguir default de escolha manual; reset correto ao reabrir o diálogo.
  - Substituir o bloco de venda padrão/exceção por um único bloco que renderiza `ExcecaoPeriodosSection` no modo venda.
- `ExcecaoPeriodosSection.tsx`: aceitar prop para ocultar a opção "livre" quando `excecaoTipo === "vender"`; base de dias distribuíveis = 30 − dias vendidos (ou 15 quando o 1º período já foi gozado).
- Persistência: venda passa a gravar linhas em `ferias_gozo_periodos` com `tipo = 'vender'` (mecanismo já existente), além de manter `gozo_quinzena1/2_*`, `dias_vendidos_q1/q2` e `quinzena_venda` para o relatório do contador e o legado.
- `FeriasFerias.tsx`: exibição das faixas de gozo + venda por período na linha do colaborador.
- Nenhuma migration nova é necessária — as colunas e a tabela de sub-períodos já existem.

## Passos de execução

1. Consultar o registro do Anderson e confirmar `quinzena_venda`, `distribuicao_tipo`, `dias_vendidos_q1/q2` e os sub-períodos gravados.
2. Corrigir a prioridade do "Período da venda" e validar salvando/reabrindo no registro dele.
3. Unificar a interface de venda com a estrutura de períodos (sem "livre").
4. Ajustar a exibição na página de férias.
