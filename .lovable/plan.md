# Aba Itens do repasse agrupada por imóvel

## Problema
Hoje cada crédito/débito é lançado numa linha única de formulário, e o imóvel precisa ser escolhido de novo a cada lançamento.

## Como fica

### 1. Lista agrupada em dropdown (accordion)
- Os itens da competência passam a ser exibidos agrupados por imóvel, cada imóvel como um bloco recolhível.
- Cabeçalho de cada bloco: código + descrição do imóvel, inquilino (quando houver), e resumo à direita: total de créditos, total de débitos e saldo do imóvel.
- Um bloco extra "Sem imóvel" para itens não vinculados.
- Dentro do bloco, a tabela atual de itens (Tipo, Origem, Descrição, Valor, ações de editar/excluir) — sem a coluna Imóvel, já implícita no grupo.
- Blocos abrem/fecham; por padrão abertos os que têm itens.

### 2. Adicionar imóvel uma vez
- Acima da lista, um seletor "Adicionar imóvel" com os imóveis do proprietário ainda não listados. Ao escolher, o bloco daquele imóvel aparece já aberto e pronto para lançamentos (mesmo sem itens ainda).
- Blocos adicionados e ainda sem nenhum item existem só na tela; nada é gravado até o primeiro lançamento.

### 3. Lançar créditos e débitos dentro do bloco
- Cada bloco tem sua própria linha de inclusão: Tipo | Origem | Descrição | Valor | botão Adicionar.
- O imóvel do bloco é aplicado automaticamente ao item — sem escolher imóvel de novo.
- Após adicionar, a linha limpa os campos e mantém o foco na descrição, permitindo lançar vários itens em sequência.
- A checagem de duplicidade (mesmo tipo + origem + imóvel) continua valendo, com o mesmo aviso.

### 4. Edição
- Editar um item continua inline dentro do bloco. Para mover um item para outro imóvel, o campo Imóvel aparece apenas no modo de edição.

### 5. Modo somente leitura
- Quando o diálogo mostra a visão consolidada (todas as competências, sem competência selecionada), o agrupamento por imóvel é aplicado da mesma forma, sem os controles de edição.

## Detalhes técnicos
- Arquivo único: `src/components/despesas/RepasseDialog.tsx`; nenhuma mudança de banco (itens já têm `imovel_id`).
- Agrupamento derivado de `repasse.itens` + lista de imóveis extras abertos manualmente (estado local `imoveisAbertos: string[]`).
- Estado `novo` passa a ser um mapa por imóvel (`Record<string, NovoItem>`) em vez de um único objeto, para cada bloco ter seu formulário independente.
- Componente `Accordion` do shadcn (`type="multiple"`) para os blocos.
- Totais por imóvel reaproveitam a lógica já existente de `saldosPorImovel`.
