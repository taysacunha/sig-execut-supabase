## Correção de rumo

Você está certo: o pedido era só fazer as placas aparecerem e fazer o filtro funcionar. Eu não deveria ter refeito a aba nem removido campos/ações da página.

## Objetivo

Na página **Placas**:

- Mostrar as **67 placas disponíveis** que existem no estoque.
- Manter os campos, colunas, códigos e ações da página como estavam.
- Fazer os filtros funcionarem corretamente, principalmente **Tipo = Aluga**.
- Não mudar regras de negócio fora disso.

## Plano

### 1. Restaurar a interface da tabela de placas
- Recolocar a listagem de placas com os campos de placa/código que foram removidos.
- Manter ações existentes da linha, como editar/atribuir código, instalar, histórico, baixar/remover, conforme já existiam.
- Remover a tabela agregada por saldo que substituiu a tabela original.

### 2. Corrigir a origem dos dados para aparecerem as 67 placas
- A página deve continuar exibindo placas como itens individuais.
- Se existem 67 unidades no saldo mas só 23 registros físicos em `estoque_placas`, a correção deve materializar/considerar essas unidades sem apagar os códigos existentes.
- As placas já cadastradas com código permanecem como estão.
- As unidades que existem em saldo e ainda não têm código individual devem aparecer como placas disponíveis sem código, para poderem receber código depois.

### 3. Corrigir filtros
- O filtro **Tipo** deve usar o tipo real do material da placa (`venda` ou `aluga`).
- O filtro **Tamanho** deve usar o tamanho real do material.
- O filtro **Material** e **Local** devem continuar funcionando.
- Ao selecionar **Aluga**, as placas Aluga devem aparecer, mesmo que ainda estejam sem código.

### 4. Preservar total e ações
- O total disponível deve bater com as 67 unidades.
- A tabela deve listar essas 67 unidades disponíveis, não só as 23 com código.
- As placas sem código devem permitir atribuir código sem alterar saldo indevidamente.
- Não mexer em instalação/baixa/histórico além do necessário para continuar funcionando com placas sem código.

### 5. Validar
- Conferir a tela `/estoque/placas`.
- Confirmar que aparecem 67 disponíveis.
- Confirmar que filtro **Tipo = Aluga** mostra as placas Aluga.
- Confirmar que os campos de código/ações continuam visíveis.
- Rodar verificação TypeScript.

## Limite do ajuste

Não vou redesenhar a página, não vou remover campos, não vou trocar a lógica da tela por saldo agregado e não vou mexer em outras páginas além do necessário para corrigir a listagem/filtros de placas.