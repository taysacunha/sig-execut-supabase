## Diagnóstico

O problema provavelmente voltou porque a tela decide se deve esconder o botão olhando para `estoque_movimentacoes.recebido_em`, não para a própria solicitação.

Isso deixa o fluxo frágil em dois cenários:

1. A RPC confirma o recebimento, mas não encontra nenhuma movimentação vinculada à solicitação (`updated_count = 0`). Nesse caso o botão continua aparecendo.
2. A confirmação é gravada em `estoque_movimentacoes`, mas o usuário não consegue enxergar essa movimentação por RLS/filtro/consulta. A tela não detecta o recebimento e mantém o botão.

Ou seja: a correção anterior melhorou a permissão da atualização, mas ainda deixou o estado visual dependente de uma tabela secundária. O recebimento precisa ser um estado da própria `estoque_solicitacoes`.

## Plano de correção

### 1. Criar campos definitivos na solicitação
Adicionar em `public.estoque_solicitacoes`:

- `recebimento_confirmado_em timestamptz null`
- `recebimento_confirmado_por_user_id uuid null`

Esses campos serão a fonte oficial para saber se o recebimento foi confirmado.

### 2. Atualizar a RPC `confirmar_recebimento_solicitacao`
A função passará a:

- Validar usuário autenticado.
- Validar que o usuário é o solicitante.
- Validar que a solicitação está `entregue`.
- Atualizar sempre a própria solicitação com `recebimento_confirmado_em` e `recebimento_confirmado_por_user_id`.
- Atualizar também `estoque_movimentacoes.recebido_em` quando houver movimentações vinculadas, mas sem depender disso para considerar sucesso.
- Retornar algo como:

```json
{
  "solicitacao_id": "...",
  "solicitacao_updated": true,
  "movimentacoes_updated": 1
}
```

### 3. Backfill de dados antigos
Para solicitações já confirmadas via movimentação, preencher os novos campos da solicitação com base em `estoque_movimentacoes.recebido_em` e `recebido_por_user_id`.

Assim registros antigos não voltarão a exibir o botão.

### 4. Ajustar a tela de Solicitações
Na página `EstoqueSolicitacoes.tsx`:

- Remover a dependência da consulta separada `estoque-recebimentos` para esconder o botão.
- Mostrar o botão apenas quando:

```ts
sol.status === "entregue" &&
sol.solicitante_user_id === user?.id &&
!sol.recebimento_confirmado_em
```

- Após confirmar, invalidar `estoque-solicitacoes` e fechar o diálogo.
- Melhorar a mensagem quando a RPC retornar erro.

### 5. Ajustar detalhes da solicitação
No dialog de detalhes, mostrar quando já houve confirmação:

- Data/hora da confirmação.
- Indicação “Recebimento confirmado”.

### 6. Validação esperada
Depois da correção:

- Ruan clica em “Confirmar Recebimento”.
- A RPC atualiza `estoque_solicitacoes` diretamente.
- A lista recarrega.
- O botão desaparece mesmo se não houver movimentação vinculada ou se a leitura de movimentações for bloqueada por RLS.

## Resultado esperado

A confirmação deixa de depender de `estoque_movimentacoes` para controlar o botão. A movimentação continua recebendo o carimbo quando existir, mas a solicitação passa a ter seu próprio estado oficial de recebimento.