## Objetivo

Restringir as ações de **Nova Entrada**, **Ajustar**, **Transferir** e **Excluir** na página **Saldos de Estoque** apenas para usuários com perfil **Super Administrador** ou **Administrador**. Demais usuários com acesso ao módulo Estoque continuam podendo visualizar os saldos, mas sem acesso a essas ações.

## Mudanças

### 1. `src/pages/estoque/EstoqueSaldos.tsx`

- Importar o hook `useUserRole` (`@/hooks/useUserRole`).
- Calcular `const isAdminOrSuper = isSuperAdmin || isAdmin;`.
- Substituir o `canEditEstoque` que governa os botões e ações por `canManageSaldos = canEditEstoque && isAdminOrSuper`.
- Aplicar `canManageSaldos` em:
  - Botão **"Nova Entrada"** no topo da página (ocultar para quem não for Admin/Super).
  - Prop `canEdit` passada para `<SaldosTable />` (controla a coluna "Ações": Ajustar, Transferir, Excluir).
- Manter o restante do fluxo (visualização, abas por unidade, filtro de estoque baixo, busca, paginação) acessível para qualquer usuário com acesso ao módulo.

### 2. Backend (RLS) — sem alterações nesta etapa

A restrição é apenas de UI. As policies atuais em `estoque_saldos` e `estoque_movimentacoes` continuam permitindo INSERT/UPDATE/DELETE para qualquer usuário com `can_edit_system('estoque')`. Isso é suficiente para esconder os botões da interface e atende ao pedido.

> Observação: caso você queira que a restrição também seja garantida no banco (impedindo que alguém com `view_edit` em Estoque, mas sem ser Admin/Super, faça as operações via API direta), eu posso, em um passo seguinte, criar uma migration ajustando as policies de `estoque_saldos` e `estoque_movimentacoes` para exigir `has_role('admin')` ou `has_role('super_admin')`. Me avise se quiser esse reforço.

## Fora de escopo

- Página de **Materiais** (`/estoque/materiais`) — o pedido se refere às ações na página Saldos. Se quiser restringir cadastro/edição/exclusão de materiais também, posso fazer em outra rodada.
- Outras páginas do módulo Estoque (Locais, Categorias, Solicitações, Movimentações, etc.) ficam inalteradas.

Faça também, num próximo plano, o tratamento de restrição no bancode dados.