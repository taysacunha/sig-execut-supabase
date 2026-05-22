## Contexto

A migration anterior (`20260522120000_estoque_view_ferias_estrutura.sql`) já libera leitura de `ferias_unidades` e `ferias_setores` para qualquer usuário com acesso a `estoque`. Isso **resolve globalmente** o problema de "selects vazios" em todas as páginas/dialogs do módulo Estoque para usuários estoque-only — não há mais nada a fazer no backend.

Falta apenas estender a **busca acento-insensível no select de material** para os outros pontos do módulo onde a lista é grande e o usuário precisa rolar muito.

## Mapeamento dos selects de material em Estoque


| Local                                                                | Lista grande?                               | Já tem busca?                             |
| -------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| `EstoqueSaldos.tsx` — dialog **Entrada**                             | sim                                         | ✅ feito                                   |
| `EstoqueSaldos.tsx` — dialogs **Ajuste/Transferência**               | —                                           | vêm pré-preenchidos da linha, não precisa |
| `EstoqueSolicitacoes.tsx` — select de material por item (linha ~728) | **sim**                                     | ❌ falta                                   |
| `EstoqueMovimentacoes.tsx`                                           | só select de tipo (poucas opções)           | n/a                                       |
| `EstoqueMateriais.tsx`                                               | só selects de unidade-de-medida e categoria | n/a                                       |
| `EstoqueLocais.tsx`                                                  | select de "local pai" (pode ser longo)      | ❌ opcional                                |


## Plano

### 1. Criar componente reutilizável `MaterialCombobox`

Novo arquivo `src/components/estoque/MaterialCombobox.tsx`:

- Wrapper de `Popover + Command + CommandInput` (mesmo padrão já aplicado em Saldos).
- Filtro client-side via `normalizeText` de `src/lib/textUtils.ts` (case + acentos).
- Props: `materiais`, `value`, `onChange`, `placeholder?`, `disabled?`.
- Renderiza nome do material selecionado no trigger.

Vantagem: evita duplicação e dá padrão pronto para usar em futuros pontos.

### 2. Refatorar `EstoqueSaldos.tsx` para usar `MaterialCombobox`

Substitui o bloco inline criado anteriormente pela chamada ao novo componente. Mesma UX, código mais limpo.

### 3. Aplicar `MaterialCombobox` em `EstoqueSolicitacoes.tsx`

No dialog de nova/editar solicitação, na linha de cada item (~728), trocar o `<Select>` de material pelo `<MaterialCombobox>`.

### 4. (Opcional, mesmo padrão) Criar `LocalCombobox` para o select "local pai" em `EstoqueLocais.tsx`

Pequeno wrapper análogo. Útil se a árvore de locais crescer. Marcado como opcional — fica fora desta rodada se você preferir.

## Arquivos alterados

- **Novo:** `src/components/estoque/MaterialCombobox.tsx`
- **Editado:** `src/pages/estoque/EstoqueSaldos.tsx` (refatora para usar o componente)
- **Editado:** `src/pages/estoque/EstoqueSolicitacoes.tsx` (substitui select de material)
- *(opcional)* `src/components/estoque/LocalCombobox.tsx` + uso em `EstoqueLocais.tsx`

## Fora de escopo

- Backend / RLS — já resolvido pela migration aplicada.
- Selects pequenos (tipo, unidade-de-medida, categoria, status, unidade-da-empresa) — não há ganho real em adicionar busca.
- Dialogs pré-preenchidos (Ajuste/Transferência) — usuário não escolhe o material.

## Como validar

1. Em `Saldos → +Entrada`: digitar "resma" → encontra "Resma A4". UX idêntica à anterior.
2. Em `Solicitações → Nova solicitação → adicionar item`: digitar "rÉsma" → também encontra "Resma A4".
3. Comportamento de seleção, fechamento do popover e valor persistido inalterados.

Confirma seguir com este escopo, e me diz se quer incluir o opcional do `LocalCombobox` para o select de "local pai".  Não inclua o opcional em locais. 

Quero que você escureça mais a cor do aviso lá em da página saldos de estoque. Hoje mostra um amarelo bem claro. Com o fundo branco, quase não dá para ver o aviso. Ajuste isso. E outra coisa, Gostaria que fosse possível ver o o Nome e o e-mail, abaixo, em fonte menor, no sidebar, acima do botão trocar sistema. Hoje não se consegue ver quem é que está logado, caso gravem a tela para mostrar algum problema.