# Corrigir o acesso de Taysa e STI aos dados de Veículos e Bens

## Causa confirmada

- Taysa e STI têm as mesmas permissões relevantes: **Editar** em Veículos e Bens e **Sem acesso** em Cadastros.
- Nenhum dos dois possui centros de custo vinculados individualmente.
- A página de Permissões informa que uma seleção vazia significa **Todos**, mas a regra atual do banco trata seleção vazia como **Nenhum**.
- Essa divergência faz as listas de Centro de custo ficarem vazias e também impede a leitura dos veículos/bens vinculados a esses centros. Motorista e proprietário deixam de aparecer como consequência.

## Correção

1. Alinhar a regra de centros de custo com o comportamento exibido na página de Permissões:
   - com centros marcados: visualizar somente os centros marcados;
   - sem centros marcados: visualizar todos os centros ativos;
   - isso só será válido nas abas para as quais o usuário já possui acesso, sem liberar Cadastros.
2. Manter Motorista, Proprietário e Centro de custo disponíveis em Veículos, e Responsável, Fornecedor e Centro de custo em Bens, usando as listas seguras já criadas.
3. Tornar a indicação “Todos” inequívoca na aba Centros de custo, para evitar diferença entre o que a tela informa e o que é aplicado.
4. Validar separadamente Taysa e STI:
   - lista de centros disponível;
   - veículos visíveis conforme a aba;
   - nomes de motorista e proprietário preenchidos;
   - cadastro de bem com o centro Apoio disponível;
   - Cadastros continua inacessível.
5. Registrar a correção complementar no histórico `/dev` após a validação.

## Detalhes técnicos

- Ajustar `despesas_centros_permitidos` por migração, preservando o filtro por aba existente nas políticas e nas funções auxiliares.
- Revisar a apresentação da aba “Centros de custo” em `DespesasPermissoes.tsx` para refletir explicitamente a regra “vazio = todos”.
- Não alterar os níveis de acesso individuais de Taysa ou STI e não conceder acesso à aba Cadastros.
