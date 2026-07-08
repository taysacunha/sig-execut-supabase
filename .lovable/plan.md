## Entendimento correto

A placa pode sair para imóvel por dois caminhos:

1. **Já existe uma placa disponível com código**
  - O campo **Selecionar disponível** deve mostrar esses códigos.
  - Ao confirmar, essa placa vai para o imóvel.
2. **Só existem placas disponíveis sem código**
  - O sistema não deve listar `(sem código) — id` como opção.
  - Deve permitir **Criar novo código**.
  - Ao confirmar, o sistema deve pegar **uma placa física disponível sem código** daquele material/local, atribuir o novo código a ela e então instalar no imóvel.

Regra principal: **nenhuma placa sai para imóvel sem código cadastrado**. Mas uma placa sem código pode ser usada na saída se, no mesmo processo, o novo código for atribuído a ela.

E também se todas já tiverem códigos, não deve ser possível cadastrar um novo código, afinal não terá onde colocá-lo já que não tem placa disponível para vincular esse código.

## Correção proposta

Arquivo: `src/components/estoque/placas/NovaSaidaDialog.tsx`

### 1. Separar placas disponíveis em duas listas

- `disponiveisComCodigo`: placas `disponivel` do material/local com `codigo` preenchido.
- `disponiveisSemCodigo`: placas `disponivel` do material/local sem `codigo`.

### 2. Campo “Selecionar disponível”

- Mostrar apenas `disponiveisComCodigo`.
- Nunca mostrar `(sem código) — id`.
- O contador do radio deve contar apenas códigos reais disponíveis.

### 3. Caminho “Criar novo código”

- Ao confirmar, primeiro tentar usar uma placa de `disponiveisSemCodigo`.
- Se existir, atualizar essa placa com:
  - `codigo: novoCodigo`
  - `status: instalada`
  - imóvel e data da instalação
- Se não existir placa física sem código, aí sim criar uma nova linha em `estoque_placas` com esse código e instalar.

### 4. Validações

- Não permitir confirmar sem código no caminho “Criar novo código”.
- Manter verificação de duplicidade do código.
- Manter consumo de 1 unidade do saldo como já ocorre.

### 5. UI

- Se houver código existente, permitir selecionar.
- Se não houver código existente, deixar o usuário em “Criar novo código”.
- A informação de tipo/tamanho continua somente leitura, derivada do material selecionado.

## Resultado esperado

Com 60 placas disponíveis sem código:

- O select não mostra 60 itens sem código.
- O usuário digita um novo código.
- O sistema pega uma dessas 60 placas, vincula o código digitado e instala no imóvel.

Com placas disponíveis com código:

- O select mostra apenas os códigos cadastrados.
- O usuário escolhe um código e instala no imóvel.