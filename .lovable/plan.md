## Ajuste no bloco de Conflitos Detectados

**Problemas relatados:**
1. O botão "Recarregar" no `AlertTitle` ficou desalinhado/feio.
2. O `checkConflicts` está rodando a cada alteração de campo (com debounce de 500ms), o que dá a sensação de "recarregando o tempo todo".

**Mudanças em `src/components/ferias/ferias/FeriasDialog.tsx`:**

1. **Remover o botão "Recarregar"** do `AlertTitle` — voltar ao título simples "Conflitos Detectados". Manter o `motivo_vinculo` exibido em texto secundário abaixo de cada item (já implementado).

2. **Trocar o `useEffect` que dispara `checkConflicts` por uma execução única ao abrir o dialog:**
   - Hoje (linhas ~931-939) o efeito depende de `watchedFields`, `excecaoTipo`, `excPeriodos`, `opcaoAdicional`, `diasVendidos`, `quinzenaVendaEfetiva`, `gozoVendaInicio`, `gozoVendaFim`, `q1JaGozada`, `open`, `ferias?.id` — qualquer digitação re-dispara.
   - Substituir por um `useEffect` com dependências apenas `[open, ferias?.id]`: quando `open === true`, aguardar a hidratação do form (próximo tick) e chamar `checkConflicts(form.getValues())` uma única vez. Se `colaborador_id` ou as datas ainda não estiverem preenchidas (cadastro novo), apenas zerar `conflicts` e não chamar.
   - Garantir reset de `conflicts` para `[]` quando o dialog fecha (`open === false`), evitando "lixo" de uma abertura anterior.

3. **Não rodar verificação durante a digitação** — qualquer mudança de período/exceção será revalidada apenas no submit (a função `onSubmit` em ~linha 1256 já trata `conflicts.length > 0` como gate de exceção; manter esse caminho intacto). Se ao salvar houver novos conflitos, o usuário verá no próximo open. Aceitável dado o pedido explícito.

**Arquivo a modificar:**
- `src/components/ferias/ferias/FeriasDialog.tsx`

Sem mudanças de schema, RLS ou outros componentes.
