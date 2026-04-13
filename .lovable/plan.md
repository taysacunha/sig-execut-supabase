

## Diagnóstico

O problema é uma **condição de corrida entre useEffects**. Quando o dialog abre em modo de edição:

1. O `useEffect` principal (linha 378) executa `form.reset(...)` com todos os valores corretos da férias (colaborador, datas, opção adicional, etc.)
2. Porém, o `form.reset()` dispara mudanças em todos os campos `watch()`
3. O `useEffect` da linha 346, que observa `opcaoAdicional`, é acionado logo em seguida
4. Esse efeito **limpa** todos os campos de gozo/venda que acabaram de ser preenchidos
5. Da mesma forma, o efeito da linha 237 recalcula `quinzena1_fim` a partir de `q1Inicio`, sobrescrevendo o valor salvo no banco

Resultado: o formulário abre aparentemente vazio — os campos foram preenchidos e imediatamente limpos pelos efeitos subsequentes.

## Correção

Adicionar uma flag `isResetting` (ref) que bloqueia os useEffects "limpadores" durante o reset inicial.

**Arquivo**: `src/components/ferias/ferias/FeriasDialog.tsx`

### Mudanças:

1. Criar `const isResettingRef = useRef(false)` no topo do componente
2. No `useEffect` de reset (linha 378), setar `isResettingRef.current = true` antes do `form.reset()` e `setTimeout(() => isResettingRef.current = false, 0)` depois — isso garante que os efeitos disparados pelo reset são ignorados
3. Em cada `useEffect` que limpa campos (linhas 237, 246, 330-344, 346-375), adicionar um guard: `if (isResettingRef.current) return;`

Isso preserva os valores carregados do banco durante a edição, mas mantém o comportamento de limpeza quando o usuário altera campos manualmente.

