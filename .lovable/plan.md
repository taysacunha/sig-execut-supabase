
Diagnóstico do porquê isso ainda não aparece

O problema não está mais só no carregamento da `FeriasDialog`. O código realmente busca os `ferias_gozo_periodos` da férias editada, inclusive no bloco de edição de férias flexíveis.

O ponto que quebra a exibição é outro:

1. Em `FeriasDialog.tsx`, ao abrir uma férias com `gozo_flexivel`, o código faz:
- `setExcecaoTipo(...)`
- `setExcDistribuicaoTipo(...)`
- `setExcDiasVendidos(...)`
- busca os períodos em `ferias_gozo_periodos`
- faz `setExcPeriodos(...)`

2. Porém, em `ExcecaoPeriodosSection.tsx`, existem `useEffect`s que reinicializam a interface quando `excecaoTipo`, `distribuicaoTipo` ou `diasVendidos` mudam.

3. Esses efeitos:
- limpam `periodos`
- resetam `distribuicaoTipo`
- recriam períodos vazios
- sobrescrevem os períodos que vieram do banco

Resultado prático:
- os 4 períodos da Taysa até chegam a ser carregados
- mas a própria UI os apaga/reinicializa logo depois
- por isso você não vê nada ao editar

O que precisa ser corrigido

1. Preservar os períodos carregados do banco no modo edição
- adicionar uma proteção em `ExcecaoPeriodosSection.tsx` para não executar os efeitos de reset/inicialização enquanto a tela estiver carregando dados existentes
- a seção não pode recriar períodos automáticos quando já existem `periodos` vindos da edição

2. Separar “inicialização de cadastro novo” de “restauração de edição”
- hoje a seção trata ambos do mesmo jeito
- no modo edição, se já houver:
  - `distribuicaoTipo`
  - `excecaoTipo`
  - `periodos`
  ela deve apenas renderizar, não resetar

3. Ajustar a ordem de hidratação em `FeriasDialog.tsx`
- manter o carregamento dos `ferias_gozo_periodos`
- só liberar a UI reativa depois que:
  - `excecaoTipo`
  - `excDistribuicaoTipo`
  - `excDiasVendidos`
  - `excPeriodos`
  estiverem todos sincronizados

Arquivos a ajustar
- `src/components/ferias/ferias/FeriasDialog.tsx`
- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`

Abordagem de implementação
- introduzir uma flag de hidratação/restauração da edição
- bloquear os `useEffect`s automáticos de:
  - reset por `excecaoTipo`
  - reset por `diasVendidos`
  - geração automática por `distribuicaoTipo`
  quando os dados já vierem do banco
- garantir que a inicialização automática continue funcionando apenas para cadastro novo ou quando o usuário realmente mudar a configuração manualmente

Critério de aceite
- ao clicar em editar a férias da Taysa, os 4 períodos já cadastrados aparecem na tela
- os períodos não somem após alguns milissegundos
- continua funcionando para cadastro novo sem quebrar a lógica automática de distribuição
- editar e salvar novamente mantém os períodos corretos

Detalhe técnico
O bug atual é consistente com um conflito entre estes pontos:
- carregamento assíncrono dos `ferias_gozo_periodos` em `FeriasDialog.tsx`
- `useEffect(() => onDistribuicaoTipoChange(""); onPeriodosChange([]), [excecaoTipo])`
- `useEffect(..., [distribuicaoTipo, excecaoTipo])`
- `useEffect(..., [diasVendidos])`

Esses efeitos tornam a seção “auto-reinicializável” demais e acabam apagando justamente os períodos restaurados da edição.
