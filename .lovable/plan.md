## Ajustes em `src/pages/ferias/FeriasFerias.tsx`

### 1. Reposicionar botão "Exportar PDF" da Tabela do Contador

Hoje o botão fica ao lado do bloco de filtros (à direita), criando uma área vazia gigante embaixo dele. Mudança:

- Remover o botão de fora do bloco de filtros.
- Colocá-lo **dentro do header do bloco de filtros**, alinhado à direita, ao lado do botão "Limpar filtros". O header passa a ter: `[ícone Filtros + label]` à esquerda e `[Limpar filtros] [Exportar PDF]` à direita.
- Bloco de filtros volta a ocupar 100% da largura (sem o `flex-1` que existia para conviver com o botão externo).

Resultado: layout compacto, sem espaço morto, e a ação fica próxima dos filtros que controlam o conteúdo do PDF.

### 2. Setor cortado no PDF do Contador

Em `generateContadorPDF` o nome do setor é truncado em 15 caracteres (`substring(0, 15)`) e a coluna tem 28mm (ambos períodos) / 32mm (um período). "Cadastro de Imóvel" e similares ficam cortados.

Mudanças:

- Aumentar a coluna **Setor** e redistribuir as larguras mantendo o total dentro da página A4 paisagem (267mm úteis):
  - `showP1 && showP2`: `[48, 28, 28, 42, 42, 42, 35]` → `[46, 26, 42, 40, 40, 40, 33]`
  - Só um período: `[52, 32, 32, 48, 52, 40]` → `[52, 30, 46, 46, 56, 37]`
- Substituir `substring(0, 15)` por **quebra de linha automática** usando `pdf.splitTextToSize(nomeSetor, larguraSetor - 4)`, exibindo até 2 linhas. Quando a célula tem 2 linhas, ajustar a altura da linha (`yPos`) localmente para não sobrepor a linha seguinte (incrementar `yPos` em +3 para essa linha).
- Aplicar a mesma técnica também ao **nome do colaborador** (que hoje também é truncado em 28 chars), para evitar regressões equivalentes em nomes longos.
- Recalcular o gatilho de quebra de página (`if (yPos > 190)`) considerando que linhas com 2 linhas de texto ocupam mais espaço.

### Detalhes técnicos

- Arquivo único: `src/pages/ferias/FeriasFerias.tsx`.
- Sem alterações em queries, hooks ou outros componentes.
- `splitTextToSize` já é usado em outros geradores de PDF do projeto (ex.: `GanttFeriasPDFGenerator`).
- Manter ordem das colunas e cabeçalhos atuais (`Dias Vendidos`, etc.).
