# Corrigir desaparecimento de abas e nomes ao abrir Reposição

## Problema confirmado
A página principal de Saldos e o componente de Reposição usam a mesma chave do React Query (`["estoque-saldos"]`) para consultas que retornam formatos diferentes.

Quando a Reposição é aberta, sua consulta é recarregada e substitui no cache os saldos já enriquecidos com nome do material, unidade e local. Com isso:
- Bessa e Tambaú deixam de ser identificadas e desaparecem da barra;
- a aba Todas recebe registros sem os nomes já relacionados;
- ao voltar para Todas ou Por material, os dados ficam incompletos.

## Correção
1. Dar à consulta interna da Reposição uma chave de cache exclusiva, sem compartilhar o resultado com a consulta principal de Saldos.
2. Manter permanentemente visíveis os controles `Todas`, `Por material`, `Bessa` e `Tambaú` ao alternar para Reposição.
3. Preservar o botão Reposição separado visualmente do grupo, como solicitado anteriormente.
4. Garantir que voltar de Reposição para Todas, Por material ou uma unidade reutilize os dados completos, com nomes, locais, quantidades e ações intactos.
5. Revisar as invalidações de cache relacionadas para que entradas, ajustes, transferências e alterações de estoque máximo atualizem tanto Saldos quanto Reposição sem colisão entre os formatos.

## Validação
- Abrir Saldos e confirmar as quatro opções e os nomes dos materiais.
- Clicar em Reposição e confirmar que as quatro opções continuam visíveis.
- Alternar entre Reposição, Todas, Por material, Bessa e Tambaú várias vezes.
- Confirmar que nomes, contadores, saldos e ações permanecem corretos sem atualizar a página.

## Escopo técnico
- `src/components/estoque/saldos/ReposicaoTab.tsx`: separar a chave da consulta de saldos usada na reposição.
- `src/pages/estoque/EstoqueSaldos.tsx`: alinhar invalidações e preservar a navegação existente.
- Sem alteração de banco, regras de estoque, permissões ou RLS.
