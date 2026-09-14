# Ajustar o diálogo de Novo lançamento

## Objetivo
Tornar o diálogo aberto por **+ A receber** e **+ A pagar** mais largo e garantir que os campos de seleção mostrem as informações completas, com rolagem normal pelo mouse e touchpad.

## O que será ajustado

### 1. Diálogo mais largo e melhor distribuído
- Ampliar o diálogo de `max-w-3xl` para uma largura próxima de tela cheia, mantendo margens e adaptação para telas menores.
- Redistribuir os campos para aproveitar a largura adicional sem alterar a ordem, as validações ou as regras do lançamento.
- Manter cabeçalho e rodapé estáveis, com rolagem apenas na área do formulário quando a altura da tela exigir.

### 2. Textos completos em todos os campos de seleção
- Ajustar **Imóvel, Pessoa, Centro de custo, Categoria, Plano de conta e Conta bancária** para não cortar os textos dentro das listas.
- Permitir quebra de linha e altura variável em cada opção, preservando o nome completo.
- No campo já selecionado, permitir a leitura completa sem esconder o final do texto.
- Fazer as listas abrirem com largura suficiente para o conteúdo, respeitando os limites da tela.

### 3. Identificação clara dos imóveis
- Exibir em cada opção o **código, a descrição e o endereço completo** do imóvel.
- Dar destaque à descrição/endereço para diferenciar imóveis que compartilham o mesmo código, como o código 5379.
- Manter a busca por código, descrição e endereço.

### 4. Corrigir a rolagem da lista de imóveis
- Aplicar à lista de imóveis o mesmo tratamento de eventos de roda e toque já presente nos demais seletores.
- Definir uma altura máxima para a lista e rolagem vertical própria, evitando que o diálogo role no lugar da relação de imóveis.
- Validar navegação por mouse, touchpad e teclado.

### 5. Validação
- Conferir o diálogo nos dois acessos: **+ A receber** e **+ A pagar**.
- Testar seleção, busca, limpeza e rolagem de todos os campos com listas longas.
- Conferir em tela ampla e em largura menor para garantir que nenhum texto ou botão se sobreponha.
- Registrar a alteração no histórico de desenvolvimento da página `/dev`.

## Detalhes técnicos
- Alteração principal em `src/components/despesas/LancamentoDialog.tsx`.
- Evolução controlada de `src/components/ui/combobox-select.tsx` para aceitar opções multilinha e listas mais largas, ativada neste diálogo sem alterar visualmente os demais usos do componente.
- Nenhuma alteração em banco de dados ou nas regras de negócio dos lançamentos.
