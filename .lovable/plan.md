# Repasse: dialog mais largo e aba Beneficiários reorganizada

## Problema
O diálogo está limitado a `max-w-3xl`. A tabela de beneficiários tem 7 colunas (#, Pessoa, Valor, Limite, Recebido em, Observação, ações) e não cabe nessa largura, então aparece barra de rolagem horizontal mesmo com um único beneficiário. O formulário de adição, quebrado em duas grades, ainda ocupa altura demais e gera rolagem vertical.

## O que muda

### 1. Largura do diálogo
- `DialogContent` passa de `max-w-3xl` para `max-w-6xl w-[95vw]`, aproveitando a tela sem estourar (o componente base já limita a altura em 90vh e rola o miolo).

### 2. Cabeçalho mais enxuto
- Os quatro cartões (Bruto, Taxa, Líquido, Status) viram uma faixa compacta em uma linha, com rótulo pequeno e valor ao lado, liberando altura para o conteúdo das abas.

### 3. Tabela de beneficiários sem rolagem horizontal
- Remoção do wrapper `overflow-x-auto` e redistribuição das colunas para caberem na nova largura:
  - **#** estreita
  - **Pessoa** (nome + PF/PJ + documento + marca "recebe a sobra")
  - **Valor**
  - **Limite**
  - **Recebido em**
  - **Observação**
  - **Ações**
- Larguras fixas apenas onde precisa (valores e data); Pessoa e Observação passam a ser flexíveis.
- No modo de edição inline, os campos ocupam 100% da célula, sem larguras mínimas que empurrem a tabela.

### 4. Formulário de novo beneficiário
- Uma única grade de uma linha em telas largas: `Pessoa | Valor (+ botão Restante) | Limite | Recebido em | Observação | Adicionar`, empilhando em telas menores.
- A opção "Recebe a sobra" fica como caixa de seleção alinhada abaixo da observação, sem empurrar o botão Adicionar para fora.
- O bloco continua visível apenas para quem pode editar.

### 5. Abas Itens e Imóveis
- Mesma largura maior aproveitada; tabelas ganham espaçamento coerente e a aba de itens recebe o mesmo tratamento de colunas flexíveis para não gerar rolagem horizontal.

## Detalhes técnicos
- Arquivo único: `src/components/despesas/RepasseDialog.tsx`.
- Nenhuma mudança de banco, hooks ou regra de negócio: apenas classes de layout e reorganização de JSX.
