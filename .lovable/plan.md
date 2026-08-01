# Compactar topo e reorganizar aba Beneficiários no dialog de Repasse

## Problema
O dialog de repasse (`src/components/despesas/RepasseDialog.tsx`) desperdiça espaço vertical na aba Beneficiários:
- Um texto explicativo longo ocupa uma faixa desnecessária abaixo do título.
- Uma seção colapsável "Limites anuais de 2026" duplica informações que já aparecem por beneficiário.
- O bloco "Saldo por imóvel" fica no topo, empurrando a tabela de beneficiários para baixo.
- A faixa de resumo (Bruto, Taxa, Líquido, Status) fica solta abaixo da barra de competências, ocupando mais altura.

## O que muda

### 1. Resumo financeiro no cabeçalho
- Mover os valores Bruto, Taxa admin., Líquido e Status para a direita do título do dialog, dentro do `DialogHeader`.
- Usar layout compacto em uma linha (ou duas linhas em telas pequenas), com rótulo pequeno e valor destacado.
- Remover a faixa de resumo atual (`<div className="shrink-0 flex flex-wrap...">`) para economizar altura.

### 2. Remover texto explicativo
- Excluir o parágrafo de explicação dos campos Valor, Limite mês, Limite ano e Sobra.
- O conteúdo de ajuda já pode ser mantido no tooltip de cada coluna ou no manual, mas não como texto fixo no dialog.

### 3. Remover seção "Limites anuais"
- Remover o bloco colapsável "Limites anuais de ..." por completo.
- Manter a edição de limite anual no próprio formulário de adicionar/editar beneficiário (campo "Limite ano" já existente), sem duplicação.

### 4. Mover "Saldo por imóvel" para o final da aba
- Reposicionar o bloco de saldo por imóvel para o final da aba Beneficiários, depois da tabela/formulário de beneficiários.
- Preservar o botão "Mostrar/Ocultar imóveis sem saldo" e a filtragem de imóveis zerados.

### 5. Ajustes de layout geral
- Aproveitar a altura liberada para a tabela de beneficiários e o formulário de novos pagamentos.
- Manter a largura expandida do dialog (`max-w-[98vw]`, `h-[95vh]`) e o scroll interno.
- Garantir que o cabeçalho reorganizado não quebre em viewports de 1024px (empilhar título e resumo abaixo de 768px se necessário).

## Detalhes técnicos
- Arquivo único: `src/components/despesas/RepasseDialog.tsx`.
- Nenhuma alteração de regra de negócio, banco ou hooks: apenas remoção de JSX e reorganização de elementos.
- Validar visualmente após a mudança: abrir o dialog em uma conta com competências e verificar que não há scroll vertical com apenas um beneficiário.
