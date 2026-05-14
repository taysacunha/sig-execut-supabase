Plano para corrigir de vez:

1. Centralizar a regra do período da venda
- Criar/usar uma função local que sempre resolva o período da venda como:
  - `quinzena_venda` quando estiver preenchido com 1 ou 2;
  - senão, inferir 1 quando a distribuição cadastrada indicar venda ligada ao 1º período;
  - em qualquer caso indefinido, usar 2º período como padrão.
- Essa regra será usada tanto na tabela quanto no PDF, para não haver diferença entre tela e exportação.

2. Corrigir a aba “Tabela do Contador” em `/ferias/ferias`
- Alterar a coluna “Dias Vendidos” para mostrar sempre o sufixo do período quando houver venda, por exemplo:
  - `10 dias (1º período)`
  - `10 dias (2º período)`
- Quando o filtro estiver em “1ª Quinzena”, mostrar dias vendidos somente se a venda pertencer ao 1º período.
- Quando o filtro estiver em “2ª Quinzena”, mostrar dias vendidos somente se a venda pertencer ao 2º período.
- Quando o filtro estiver em “Ambos”, mostrar a quantidade com o período explícito.

3. Corrigir o PDF gerado nessa mesma aba
- Alterar a coluna “Dias V.” para imprimir `10 (1º)` ou `10 (2º)`.
- Aplicar a mesma regra de filtro por período usada na tabela.
- Continuar usando o período vendido para reduzir os dias de gozo do 1º ou 2º período corretamente.

4. Corrigir também a página de Relatórios > Contador, se ela for usada
- Garantir que o preview e o PDF desse componente também usem a mesma regra, para não existir uma segunda tela com comportamento antigo.

5. Backfill seguro no banco
- Criar uma migration para preencher `quinzena_venda = 2` apenas nos registros que têm dias vendidos e estão sem período definido.
- Não alterar registros que já têm `quinzena_venda = 1` ou `quinzena_venda = 2`.

6. Validação
- Conferir no código que não sobra nenhum ponto exibindo só `10 dias` na Tabela do Contador.
- Conferir que o PDF usa a função formatada, e não apenas `String(diasVend)`.