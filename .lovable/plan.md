# Corrigir dialogs que ultrapassam a altura da tela

## Problema
No `/despesas/calendario`, ao clicar em "A pagar" o `LancamentoDialog` abre com muitos campos (tipo, documento, descrição, centro de custo, pessoa, categoria, plano, subcategoria, conta, competência, vencimento, valor, observação, credenciais e recorrência). Como o `DialogContent` base (`src/components/ui/dialog.tsx`) só define `max-w-lg` — sem `max-height` nem scroll interno — o conteúdo estica verticalmente além da viewport, escondendo o título e o rodapé com os botões Cancelar/Salvar. O mesmo padrão afeta outros diálogos grandes do sistema (ex.: `ImovelDialog`, `VeiculoDialog`, `RepasseDialog`, colaboradores, férias, etc.).

## Causa raiz
O primitivo `DialogContent` não limita a altura nem torna o corpo rolável. Cada tela pode passar `max-w-*`, mas nenhuma trata altura, então o dialog cresce conforme o conteúdo.

## Correção (mínima e global)

### 1. Ajustar o primitivo `src/components/ui/dialog.tsx`
Adicionar limites de altura e layout em coluna com corpo rolável, sem alterar API:

- No `DialogContent`, mudar de `grid gap-4 ... p-6` para:
  - `flex flex-col`
  - `max-h-[calc(100vh-2rem)] sm:max-h-[85vh]`
  - `overflow-hidden` no container externo
  - Manter `w-full max-w-lg` (cada diálogo continua podendo sobrescrever a largura via `className`).
- `DialogHeader`: adicionar `shrink-0` para nunca sumir no topo.
- `DialogFooter`: adicionar `shrink-0 pt-2 mt-2 border-t` (opcional visual) para nunca sumir.
- Envolver o `{children}` do meio? Não — em vez disso, criar um novo wrapper `DialogBody` opcional. Como isso exigiria refatorar 40+ arquivos, escolher abordagem alternativa mais simples:

### Abordagem escolhida
1. `DialogContent`: `flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[85vh] overflow-hidden p-0 sm:rounded-lg` — remove padding do container.
2. Adicionar padding interno via um wrapper `<div className="flex flex-col gap-4 p-6 overflow-hidden max-h-full">` dentro do primitivo, mas isso quebra layout. 

Melhor: **manter o `p-6` no `DialogContent` e não mexer em wrappers**, e delegar scroll ao conteúdo entre `Header` e `Footer`. Aplicar direto:

- No primitivo: `DialogContent` recebe `flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-hidden`.
- `DialogHeader` e `DialogFooter` recebem `shrink-0`.
- Todo elemento filho entre header/footer é responsabilidade de cada dialog envolver em `overflow-y-auto`. Para não quebrar retroativamente, **também** adicionar no primitivo: qualquer child direto que não seja `header/footer` fica auto (via CSS regra `[&>*:not(:first-child):not(:last-child)]:overflow-y-auto [&>*:not(:first-child):not(:last-child)]:min-h-0`).

### 2. Ajustes específicos nos diálogos maiores
Confirmar em `LancamentoDialog.tsx`, `PagamentoDialog.tsx`, `ImovelDialog.tsx`, `RepasseDialog.tsx`, `VeiculoDialog.tsx`, `ColaboradorDialog.tsx`, `FeriasDialog.tsx`:
- Envolver o corpo (o `<div className="grid gap-4 py-2 md:grid-cols-2">` do `LancamentoDialog`, por exemplo) com `className="... overflow-y-auto pr-1 -mr-1 min-h-0 flex-1"` para garantir rolagem interna correta mesmo se a regra CSS global não pegar.

### 3. Testes visuais
- `/despesas/calendario` → clicar em card "A Pagar" → dialog deve ter altura limitada, título fixo no topo, rodapé fixo embaixo, e conteúdo do meio rolável.
- Verificar em viewport 1126×735 (atual do usuário) e em telas menores (mobile).
- Testar também PagamentoDialog, ImovelDialog, RepasseDialog, VeiculoDialog.

## Arquivos afetados
- `src/components/ui/dialog.tsx` (correção estrutural)
- `src/components/despesas/LancamentoDialog.tsx`
- `src/components/despesas/PagamentoDialog.tsx`
- `src/components/despesas/ImovelDialog.tsx`
- `src/components/despesas/RepasseDialog.tsx`
- `src/components/despesas/VeiculoDialog.tsx`
- (Outros diálogos longos: aplicar wrapper de rolagem apenas se necessário após verificação visual.)

## Fora de escopo
- Redesenho dos formulários (número de campos, separação em abas/steps).
- Alterações de lógica/regra de negócio nos diálogos.
