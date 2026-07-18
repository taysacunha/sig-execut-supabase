## Objetivo

Na página **Gerenciamento de Usuários → aba Usuários**, permitir organizar/filtrar a lista por módulo do sistema (Escalas, Vendas, Férias, Estoque, Despesas) e por tipo de permissão (Ver / Editar), mostrando também os demais módulos aos quais o usuário pertence.

## Mudanças na UI (apenas `src/pages/UserManagement.tsx`)

1. **Novos controles de filtro** (acima da tabela, ao lado do search existente):
   - Select **"Módulo"**: `Todos | Escalas | Vendas | Férias | Estoque | Despesas`.
   - Select **"Permissão"** (habilitado só quando um módulo é escolhido): `Todas | Somente ver | Ver e editar`.
   - Botão "Limpar filtros" quando algum filtro estiver ativo.

2. **Lógica de filtragem**:
   - Reaproveitar o array `system_access` que já é carregado por usuário.
   - `filteredUsers` passa a considerar: busca de texto + módulo + tipo de permissão.
   - Super admins continuam aparecendo em qualquer filtro (têm acesso total).

3. **Nova coluna "Módulos"** na tabela:
   - Mostra um badge por módulo que o usuário tem acesso, com ícone indicando `Eye` (ver) ou `Pencil` (editar).
   - Quando um módulo específico está filtrado: destacar o badge do módulo filtrado (cor primária) e exibir os demais em `variant="outline"` com tooltip "Também tem acesso a: …", cumprindo o requisito de "se está em mais de um módulo, mostrar também".
   - Sem filtro: todos os badges no estilo padrão.

4. **Contador**: exibir "N usuário(s) no módulo X" quando um módulo estiver selecionado.

## Detalhes técnicos

- Sem mudanças de banco/RLS. Os dados de `system_access` já vêm em `fetchUsers` (via `.select("system_name, permission_type")`).
- Sem mudanças em outras páginas ou componentes.
- Preservar ordenação (`useTableControls`) e paginação atuais — filtro é aplicado antes.
- Manter i18n PT-BR e padrão visual dos badges já usados na página.

## Fora de escopo

- Editar permissões em lote a partir dessa aba (já existe página dedicada por módulo).
- Alterações no backend ou nas policies.
