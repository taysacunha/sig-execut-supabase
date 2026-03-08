

## Plano: Adicionar Setor ao Vínculo Usuário-Unidade + Sidebar

### Alterações

#### 1. Migração SQL
- `ALTER TABLE estoque_usuarios_unidades ADD COLUMN setor_id uuid REFERENCES ferias_setores(id) ON DELETE SET NULL`
- `ALTER TABLE estoque_solicitacoes ADD COLUMN setor_id uuid REFERENCES ferias_setores(id) ON DELETE SET NULL`

#### 2. `EstoqueSidebar.tsx`
- Renomear "Gestores" para "Gestores e Usuários" no menu
- Esse item só aparece para `super_admin` e `admin` — mover da lista `moduleMenuItems` para `adminMenuItems` (ou filtrar condicionalmente)

#### 3. `EstoqueGestores.tsx` — Aba "Usuários por Unidade"
- Buscar setores ativos de `ferias_setores` (`is_active = true`)
- No dialog de vincular usuário: adicionar select de setor (obrigatório), filtrando setores ativos
- Na tabela de vínculos: mostrar coluna "Setor"
- No insert: gravar `setor_id` junto com `user_id` e `unidade_id`
- Na tabela: mostrar alerta visual (badge vermelha) quando o setor vinculado está inativo/excluído, com tooltip "Setor desativado — realoque este usuário"
- Permitir editar o setor de um vínculo existente (botão de editar ao lado do excluir)

#### 4. `useUsuarioUnidades.ts`
- Retornar `setor_id` e `setor_nome` nos vínculos do usuário

#### 5. `EstoqueSolicitacoes.tsx`
- Ao criar solicitação: auto-preencher `setor_id` do vínculo do usuário com a unidade selecionada
- Gravar `setor_id` na solicitação
- Na tabela e dialog de visualização: mostrar coluna/campo "Setor" para o gestor saber onde entregar

#### 6. Alerta de setor desativado
- Na aba "Usuários por Unidade": buscar setores vinculados e verificar `is_active`
- Se o setor está inativo: mostrar badge "Setor desativado" na linha + alerta no topo da página com contagem de usuários afetados

### Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | `setor_id` em `estoque_usuarios_unidades` e `estoque_solicitacoes` |
| `EstoqueSidebar.tsx` | Renomear item + mover para admin-only |
| `EstoqueGestores.tsx` | Select de setor no vínculo, coluna setor na tabela, alerta de setor inativo, edição de setor |
| `useUsuarioUnidades.ts` | Retornar setor_id/setor_nome |
| `EstoqueSolicitacoes.tsx` | Auto-preencher setor, gravar, exibir na tabela/dialog |

