## Problema

O `RepasseDialog` ficou com muito conteúdo empilhado (resumo + beneficiários + inquilinos + itens + form de itens + footer), estourando a altura, deixando os formulários apertados e a leitura confusa em telas menores.

## Solução: reorganizar em abas

Reestruturar `src/components/despesas/RepasseDialog.tsx` mantendo o cabeçalho (título + 4 cards de resumo) e o footer com as ações, e mover o miolo para um `Tabs` (`@/components/ui/tabs`) com 3 abas:

1. **Beneficiários** — tabela + linha de "Distribuído / Restante" + formulário de adição (Pessoa, Valor, Restante, Observação).
2. **Itens do repasse** — tabela de créditos/débitos + formulário de adição (Tipo, Origem, Descrição, Valor).
3. **Imóveis & inquilinos** — lista somente leitura agrupada por imóvel, com a nota "Para alterar, edite o cadastro do imóvel."

Ajustes de layout:

- `DialogContent`: `max-w-3xl` (em vez de 4xl) para caber melhor, mantendo `max-h-[90vh] overflow-y-auto` do padrão.
- Cards de resumo passam a `grid-cols-2 md:grid-cols-4` para não quebrar em telas médias.
- Formulários das abas usam `grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]` com `items-end` (Beneficiários) e `md:grid-cols-5` (Itens), já validados.
- Aba padrão: **Beneficiários** (foco atual do fluxo).
- Badge com contagem em cada aba (ex.: "Beneficiários · 2", "Itens · 5", "Imóveis · 3").

## Escopo

- Alterar apenas `src/components/despesas/RepasseDialog.tsx` (frontend/apresentação).
- Nenhuma mudança em hooks, RPCs, migrations ou regras (validação de "não pode marcar como pago sem beneficiário" e limites permanecem iguais).
