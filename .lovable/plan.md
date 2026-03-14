

## Plano: Tornar seção "Turnos Não Alocados" retrátil (collapsible)

### Mudança

Envolver a `UnallocatedSection` em um `Collapsible` com estado inicialmente aberto, permitindo ao usuário retrair/expandir a lista. O header com o título e contagem vira o trigger, com ícone de chevron indicando o estado.

### Arquivo: `src/components/ValidationReportPanel.tsx`

Alterar a função `UnallocatedSection` (linhas 504-530):

- Adicionar `useState(true)` para controle de aberto/fechado
- Wrappear com `<Collapsible>` (já importado no arquivo)
- Header (`h4`) vira `<CollapsibleTrigger>` com chevron animado
- Lista `<ul>` fica dentro de `<CollapsibleContent>`
- Manter estilos visuais existentes

