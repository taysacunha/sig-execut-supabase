## Problema

Na página `Estoque › Solicitações`, ao clicar em **Confirmar Recebimento**:

1. O toast aparece corretamente, mas o botão **continua visível** na linha.
2. A mensagem do toast tem texto extra ("Obrigado!").
3. O ícone usado (`HandHeart` — mão com coração) destoa do restante.

### Causa do botão persistente

A visibilidade do botão depende apenas de `sol.status === "entregue"`. A confirmação grava `recebido_em` em `estoque_movimentacoes`, mas **não altera o status** da solicitação (que continua "entregue"). Resultado: o botão segue aparecendo até um refresh manual, e mesmo após refresh nunca some, pois o status nunca muda.

## Plano

Mudanças **somente em** `src/pages/estoque/EstoqueSolicitacoes.tsx` (frontend, sem migração de DB):

1. **Carregar status de recebimento por solicitação**
   - Após a query `estoque-solicitacoes`, adicionar uma segunda `useQuery` (`["estoque-recebimentos", ids]`) que busca `estoque_movimentacoes` com `solicitacao_id IN (ids)` selecionando `solicitacao_id, recebido_em`.
   - Montar um `Set<string>` (`recebidasIds`) com as solicitações que têm pelo menos uma movimentação com `recebido_em != null`.

2. **Esconder botão após confirmação**
   - Alterar a condição da linha 655 para:
     ```
     sol.status === "entregue"
       && sol.solicitante_user_id === user?.id
       && !recebidasIds.has(sol.id)
     ```
   - No `onSuccess` da mutation, invalidar também `["estoque-recebimentos"]` para refletir imediatamente.

3. **Simplificar toast** (linha 524)
   - `toast.success("Recebimento confirmado. Obrigado!")` → `toast.success("Recebimento confirmado")`.

4. **Trocar ícone** (linha 657 + import linha 6)
   - Remover `HandHeart` do import.
   - Usar `PackageCheck` (já importado) no botão "Confirmar Recebimento".

## Fora de escopo

- Sem alteração de schema, RLS ou status no banco.
- Sem mudanças em outras telas.
