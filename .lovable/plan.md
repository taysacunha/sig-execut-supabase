# Reposicionar aba "Reposição" na página Saldos

## Objetivo
Mover a aba "Reposição" para o lado direito da linha de abas, alinhada à coluna do botão "+ Entrada", mantendo-a na mesma linha do grupo "Todas, Por material, Bessa, Tambaú".

## O que será feito

### Ajuste no `TabsList` de `src/pages/estoque/EstoqueSaldos.tsx`
- Manter a ordem lógica das abas: `todas`, `por-material`, unidades ativas e `reposicao`.
- Aplicar `ml-auto` no `TabsTrigger` de "Reposição" para que ela seja empurrada para a extremidade direita do `TabsList`.
- Ajustar a classe do `TabsList` para `w-full justify-start` (ou equivalente) para que o `ml-auto` funcione corretamente.
- Preservar os contadores de quantidade em cada aba e todo o conteúdo dos `TabsContent`.

## Detalhes técnicos
- Arquivo: `src/pages/estoque/EstoqueSaldos.tsx`.
- Componente: `TabsList` nas linhas ~532–541.
- Alteração visual apenas; nenhuma mudança de estado, dados ou RLS.
