# Olho de valores dentro dos diálogos (módulo Despesas)

## Objetivo
Hoje o botão de olho existe apenas no cabeçalho geral do módulo. Ao abrir um diálogo com valores ocultos, é preciso fechá-lo, ligar a exibição e reabrir. A mudança dá a cada diálogo o próprio botão de olho, que alterna os valores daquele diálogo na hora.

## Como vai funcionar
- Cada diálogo com valores monetários ganha um botão de olho no cabeçalho, ao lado do título.
- Ao abrir, o diálogo herda o estado atual do olho geral (por padrão, oculto).
- Alternar dentro do diálogo afeta apenas aquele diálogo; ao fechar e reabrir, ele volta a herdar o estado global.
- O olho do cabeçalho do módulo continua funcionando como está, para as listas e páginas.

## Onde aparece
- Diálogo de repasse (Repasses)
- Diálogo de pagamento/baixa (Calendário)
- Diálogo de imóvel
- Diálogo de veículo
- Alerta de duplicidade (segue o olho do diálogo em que estiver)

## Detalhes técnicos
- `src/contexts/DespesasValuesContext.tsx`: adicionar um provider aninhável (`DespesasValuesScope`) que inicializa `showValues` a partir do contexto pai e mantém estado local próprio, sem escrever em `sessionStorage`. O `useDespesasValues` passa a resolver o contexto mais próximo, então componentes filhos (incluindo `DuplicidadeAlert`) funcionam sem alteração.
- Extrair o botão atual do `DespesasLayout` para um componente reutilizável (`ToggleValuesButton`) exportado, usado tanto no header quanto nos diálogos.
- Em cada diálogo listado, envolver o conteúdo com o scope e inserir o botão no `DialogHeader` (alinhado à direita, antes do X de fechar).
- Sem mudanças de banco, hooks de dados ou regras de negócio.
