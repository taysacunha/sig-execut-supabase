## Plano de correção do fluxo de placas

Vou ajustar para seguir exatamente o fluxo esperado:

1. **Materiais continuam sendo a base**
  - Não desativar materiais do tipo placa.
  - Reativar os materiais de placa que possam ter sido desativados pelo script anterior.
  - Manter cada tipo como material próprio: `Placa Venda 3,00X0,70`, `Placa Venda 2X2 LONA`, `Placa Venda 1X1 LONA`, `Placa Aluga 1X1 LONA`, `Placa - Vende`, etc.
2. **Nova Placa deve cadastrar Material, não criar item direto em `estoque_placas**`
  - Ajustar o dialog **Nova Placa** em `/estoque/materiais` para criar um registro em `estoque_materiais` com `is_placa = true`.
  - Campos do dialog: nome/tipo/tamanho/categoria/unidade/estoque mínimo/descrição ou observação conforme já existir no cadastro de material.
  - Remover a lógica de “material âncora” genérico.
3. **Saldos continuam em `/estoque/saldos**`
  - O usuário registra entrada dos materiais-placa em `/estoque/saldos`, como já faz hoje.
  - Não apagar nem substituir os saldos por um material genérico.
  - Corrigir qualquer consulta que esteja buscando saldo usando um material âncora único para buscar o saldo do material-placa selecionado.
4. **Página `/estoque/placas` deve refletir os saldos dos materiais-placa**
  - Buscar materiais ativos com `is_placa = true` e seus saldos.
  - Exibir na página Placas uma visão organizada por status e também por tipo/tamanho/material.
  - Manter as abas principais: **Disponíveis**, **Instaladas**, **Baixadas**.
  - Dentro das abas, adicionar filtros/visão para o usuário ver: tipo de uso (**Venda/Aluga**), tamanho (**1x1/2x2/Outro**), material específico e local.
  - Incluir um resumo por tipo/material mostrando quantidades disponíveis para facilitar a leitura.
5. **Saída para imóvel**
  - Ajustar o dialog **Nova saída para imóvel** para o usuário escolher primeiro o material-placa e o local.
  - Validar saldo desse material naquele local.
  - Ao confirmar saída, criar/vincular o registro em `estoque_placas` com aquele `material_id`, código da placa e imóvel.
  - A saída deve consumir 1 unidade do saldo daquele material/local, não de um material genérico.
6. **Script de reparo de dados**
  - Criar um SQL de reparo, para executar no Supabase, que:
    - reativa materiais cujo nome começa com `Placa`;
    - marca esses materiais como `is_placa = true`;
    - não desativa materiais de placa;
    - preserva os saldos existentes;
    - desfaz a ideia de material âncora quando possível sem perder histórico.
  - Se o script anterior de migração já tiver sido executado e criado placas genéricas, o reparo tentará reassociar essas placas ao material correto usando `observacoes = 'Migrado de ...'`.

## Arquivos a alterar

- `src/components/estoque/materiais/NovaPlacaDialog.tsx`
- `src/components/estoque/placas/NovaSaidaDialog.tsx`
- `src/pages/estoque/EstoquePlacas.tsx`
- `src/hooks/useEstoquePlacas.ts`
- Criar um script SQL de reparo em `.lovable/` para ser executado no SQL Editor do Supabase.

## Resultado esperado

- As placas aparecem e permanecem como materiais ativos.
- Os saldos cadastrados em `/estoque/saldos` continuam sendo a fonte de estoque.
- `/estoque/placas` passa a mostrar os saldos e placas de forma organizada por venda/aluga, 1x1/2x2/outro, material e local.
- Nenhum material de placa será desativado automaticamente.

Entenda que existe esse fluxo, essa dependência. A placa é uma material. Após cadastrado, adiciona o saldo. Após adicionar o saldo, as placas aparecem na página placas.