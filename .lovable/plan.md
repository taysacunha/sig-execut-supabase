## Problema

No dialog "Mover Folgas em Lote" (`src/components/ferias/folgas/MoverFolgasLoteDialog.tsx`), cada item da lista de colaboradores tem dois handlers de seleção que se anulam:

- O `<div>` envolvente tem `onClick={() => toggleSelection(colab.id)}`
- O `<input type="checkbox">` filho tem `onChange={() => toggleSelection(colab.id)}`

Quando o usuário clica no checkbox, dispara o `onChange` do input **e** o `onClick` do div pai (event bubbling). O resultado é dois `toggleSelection` em sequência — o estado marca e desmarca no mesmo clique, parecendo que "não responde". Clicar no nome funciona porque dispara apenas o handler do div.

## Correção

Impedir a propagação do clique no checkbox para o div pai, mantendo um único toggle por interação.

No item da lista (linhas ~287-318):

```tsx
<input
  type="checkbox"
  checked={isSelected}
  onChange={() => toggleSelection(colab.id)}
  onClick={(e) => e.stopPropagation()}
  className="h-4 w-4 rounded border-input cursor-pointer"
/>
```

Com `stopPropagation` no `onClick` do input, o clique direto no checkbox executa só o `onChange`. O clique em qualquer outra área do item continua acionando o handler do div.

## Validação

Testar em `/ferias/folgas` → abrir "Mover Folgas em Lote" → selecionar sábado destino → clicar nos checkboxes e nos nomes alternadamente, conferindo que cada clique alterna o estado uma única vez e o contador no rodapé reflete corretamente.
