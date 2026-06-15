## Problema

O campo de busca atual fica **fora** do Select e não filtra nada útil — o usuário continua precisando rolar a lista do dropdown. O esperado é digitar **dentro** do próprio seletor de colaborador e ver a lista filtrar.

## Solução

Substituir o `Select` por um **Combobox** (Popover + Command do shadcn), padrão já usado em `src/components/estoque/MaterialCombobox.tsx`. Assim a busca acontece dentro do dropdown, com filtro acento-insensitive por nome.

### Mudanças em `src/components/ferias/folgas/PerdaFolgaDialog.tsx`

1. Remover o `<Input>` de busca externo e o estado `searchTerm` que adicionei.
2. Remover o `Select`/`SelectContent`/`SelectItem` para o colaborador.
3. Adicionar `Popover` + `Command` (`CommandInput`, `CommandEmpty`, `CommandGroup`, `CommandItem`):
   - Trigger: `Button variant="outline"` com largura total, mostrando o nome selecionado ou "Selecione o colaborador", ícone `ChevronsUpDown` à direita.
   - `CommandInput` com placeholder "Buscar por nome..." dentro do popover.
   - `CommandEmpty`: "Nenhum colaborador encontrado" (ou "Todos os colaboradores já têm perda registrada" quando a lista base estiver vazia).
   - `CommandItem` para cada colaborador disponível (`!existingPerdas.includes(c.id)`); `value={c.nome}` para o filtro do Command casar com a digitação, `onSelect` define `colaboradorId`.
   - Ícone `Check` ao lado do item atualmente selecionado.
4. Manter toda a lógica existente (afastamento, créditos, motivo, mutation) inalterada.

Sem alterações no banco, RLS, ou outros arquivos.

## Resultado

Ao abrir o seletor de colaborador, o usuário digita o nome e a lista filtra imediatamente dentro do próprio dropdown — sem campo de busca solto acima.
