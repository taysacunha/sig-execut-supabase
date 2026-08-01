# Tornar o botão de repasses visivelmente clicável

## Problema
Na aba Beneficiários do diálogo de Repasse, a célula mostra apenas "0 repasse(s)". Mesmo com borda, parece um texto informativo: sem ícone, sem verbo de ação e com cor de fundo quase igual à da linha da tabela.

## Solução
Substituir o rótulo passivo por um botão de ação inequívoco:

- Texto muda de "0 repasse(s)" para "Gerenciar repasses" com um badge de contagem ao lado (ex.: "Gerenciar repasses · 0").
- Ícone de chevron que gira quando expandido (para baixo/para cima), deixando claro que abre uma seção.
- Estilo: botão sólido com token semântico (`variant="default"` quando expandido; quando recolhido, fundo `bg-muted` com `border border-border` e texto `text-foreground`), altura `h-8`, cantos arredondados e sombra sutil — contraste suficiente para se destacar da linha da tabela sem depender de hover.
- Estado hover/focus mantém o realce atual, mas agora só reforça algo que já parece botão.

## Detalhes técnicos
Arquivo único: `src/components/despesas/RepasseDialog.tsx`, na célula da coluna de repasses (por volta das linhas 1030-1042). Sem mudanças de dados, hooks ou banco.
