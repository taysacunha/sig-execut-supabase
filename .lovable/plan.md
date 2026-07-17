## Objetivo

Reestruturar a página `/despesas/permissoes` para (a) ser mais fácil de escanear com muitos usuários e (b) permitir aplicar mudanças em lote em vários usuários ao mesmo tempo. Também deixar explícito na UI o vínculo com o acesso do sistema (`system_access`).

## Nova estrutura da página (3 abas)

Trocar as duas Cards atuais empilhadas por um `Tabs` no topo:

1. **Aba "Níveis por aba"** — matriz usuário × aba (Calendário / Imóveis / Repasses / Cadastros).
2. **Aba "Centros de custo"** — matriz usuário × centro de custo, igual hoje.
3. **Aba "Ações em lote"** — formulário para aplicar mudanças em vários usuários selecionados ao mesmo tempo.

Em todas as abas, no topo:
- Campo de busca (nome/email).
- Filtro rápido: "Todos" | "Com acesso ao módulo" | "Sem acesso ao módulo" (usando `system_access.system_name='despesas'`).
- Contador: "X usuários exibidos · Y com acesso ao módulo".

## Aba 1 — Níveis por aba (matriz melhorada)

- Cada linha ganha:
  - Checkbox à esquerda para selecionar (usado pelo bloco de ações em lote logo acima da tabela quando houver seleção).
  - Coluna "Acesso ao módulo" com Badge: `Ativo` (verde) / `Sem acesso` (cinza). Se estiver `Sem acesso`, exibir tooltip "Configure em /usuarios para o usuário conseguir entrar no módulo".
  - Coluna por aba com o `Select` atual (Sem acesso / Visualizar / Editar / Excluir).
  - Última coluna: "Resumo" — chip com o nível mais alto atribuído (ex.: "Editar em 2 abas").

- Barra de ação em lote (aparece só quando há linhas selecionadas):
  - "N selecionados"
  - Select "Aplicar em: [aba]" (ou "Todas as abas")
  - Select "Nível: [Sem acesso / Visualizar / Editar / Excluir]"
  - Botão "Aplicar" — dispara `upsert` para todas as combinações (usuário × aba escolhida) e invalida cache.
  - Botão "Limpar seleção".

## Aba 2 — Centros de custo (matriz + lote)

- Mantém a matriz de checkboxes atual, com melhorias:
  - Checkbox por linha para seleção múltipla.
  - Cabeçalho de cada centro clicável: "Marcar todos" / "Desmarcar todos" para a coluna (com confirmação se afetar >5 usuários).
  - Barra de ação em lote: para usuários selecionados, permitir "Adicionar centro X", "Remover centro X" ou "Liberar todos (deixar em 'Todos')".

## Aba 3 — Ações em lote (assistente)

Um formulário guiado para casos maiores (ex.: novo time entrando):
1. Selecionar usuários (multi-select com busca).
2. Escolher perfil rápido:
   - "Visualizador financeiro" → view em todas as abas.
   - "Operador de contas" → edit em Calendário/Imóveis/Repasses, view em Cadastros.
   - "Administrador de despesas" → delete em todas.
   - "Personalizado" → escolher nível por aba manualmente.
3. Opcional: escolher centros de custo permitidos.
4. Botão "Aplicar" — faz upsert atômico (Promise.all) e mostra toast com contagem de mudanças.

Isso não substitui as matrizes; é um caminho rápido para configurar vários de uma vez.

## Realtime / novo usuário

- Adicionar `refetch` ao montar o componente (já existe pelo React Query) + botão "Atualizar lista" no topo.
- Opcional (leve): assinar `postgres_changes` em `user_profiles` INSERT para invalidar `despesas-permissoes-users` automaticamente. Fica como enhancement — o botão manual já resolve.
- Uma "dica" (Alert) no topo da página, explicando o comportamento em cascata:
  > "Um usuário só enxerga o módulo se tiver acesso configurado em `/usuarios`. As permissões abaixo controlam o que ele faz **dentro** do módulo."

## Detalhes técnicos

- Componente principal: reescrever `src/pages/despesas/DespesasPermissoes.tsx` mantendo os hooks e mutations já existentes (`upsertNivel`, `toggleCentro`).
- Novos estados locais:
  - `selectedUserIds: Set<string>`
  - `filtroAcesso: "todos" | "com" | "sem"`
- Nova query: `useQuery` em `system_access` filtrando `system_name = 'despesas'` para saber quem tem acesso ao módulo (permissão para admin já existe via RLS).
- Mutations em lote: `Promise.all(users.map(u => supabase.from(...).upsert({...})))` seguido de `queryClient.invalidateQueries`.
- Sem migration nem mudanças de RLS — só UI.
- Perfis rápidos ficam como constantes no arquivo (JSON de `{ aba: nivel }`), fácil de estender.

## Fora do escopo (não incluir agora)

- Alterar `system_access` diretamente pela página de despesas (isso continua em `/usuarios`, para manter fonte única de verdade).
- Log de auditoria específico dessa página (já é coberto por `module_audit_logs` das tabelas envolvidas).

## Passos de implementação

1. Adicionar `useQuery` de `system_access` e barra de contexto (Alert + contador + filtro).
2. Refatorar página em `Tabs` com as 3 abas.
3. Adicionar coluna "Acesso ao módulo" + checkbox de seleção na aba 1.
4. Implementar barra de ações em lote na aba 1.
5. Replicar checkboxes de seleção + ação em lote na aba 2.
6. Construir assistente da aba 3 com perfis rápidos.
7. Verificar build e testar fluxos com um usuário admin e um sem acesso ao módulo.
