# Central de Ajuda — Sistema de Estoque

Criar `src/pages/estoque/EstoqueHelp.tsx` seguindo o mesmo padrão visual de `Help.tsx` (Escalas) e `FeriasHelp.tsx` (Férias): cabeçalho com ícone, `Tabs` por área, `Card` com `CardHeader/Content`, `Alert` para dicas/atenção, listas numeradas (`Step`) e com marcadores (`Bullets`), tudo em PT-BR.

## Estrutura de abas propostas

1. **Visão Geral** — o que é o sistema, fluxo recomendado (Categorias → Locais → Materiais → Saldos → Solicitações/Movimentações → Notificações), papéis (super_admin, admin, gestor, colaborador) e o que cada um pode fazer.
2. **Dashboard** — leitura dos cards (total de materiais, saldo, abaixo do mínimo, solicitações pendentes), filtros e atalhos.
3. **Materiais** — cadastro de material comum vs material do tipo **Placa** (`is_placa`), campos obrigatórios, unidade de medida, estoque mínimo, vínculo com categoria, ativação/desativação, busca e filtros, exclusão com `AlertDialog`.
4. **Categorias** — criar/editar/inativar, impacto em materiais existentes.
5. **Locais** — locais de armazenamento vs locais externos (imóveis/obra), vínculo com unidade, ativação.
6. **Saldos** — como o saldo é formado por (material × local), entrada manual, ajuste, transferência, regra do estoque mínimo e como aparece na lista de "Abaixo do mínimo". Esclarecer que **placas têm saldo controlado por material/local em `/estoque/saldos`** e cada unidade física aparece em `/estoque/placas`.
7. **Placas** — fluxo completo:
   - 1º cadastrar o material do tipo placa em **Materiais**;
   - 2º registrar o saldo em **Saldos**;
   - 3º na página **Placas** acompanhar cada unidade física (com código atribuído na entrada/saída);
   - abas Disponíveis / Instaladas / Baixadas e filtros por material, tipo (venda/aluga), tamanho (1x1/2x2/outro) e local;
   - ações: Nova Saída (instalação em imóvel, consome 1 do saldo), Retirada, Roubo, Perda, Baixa;
   - histórico por placa e geração de PDF.
8. **Solicitações** — abrir solicitação, fluxo de aprovação, status (pendente/aprovada/recusada/atendida), quem aprova.
9. **Movimentações** — tipos (entrada, saída, ajuste, transferência), como filtrar e exportar, vínculo com solicitação.
10. **Notificações** — quando são geradas (estoque mínimo, solicitação pendente, aprovação), como marcar como lida, badge no menu.
11. **Gestores e Usuários** — vincular gestores a unidades/locais, conceder acesso ao módulo Estoque, papéis.
12. **Perfil, Auditoria e Segurança** — alterar dados/senha, leitura do log de auditoria (admins), boas práticas.

Cada aba terá: descrição curta, passo-a-passo, dicas (`Alert` info) e atenções (`Alert` destructive) quando houver risco (ex.: baixar placa, excluir material com saldo).

## Integração

- Adicionar a rota `ajuda` em `src/App.tsx` dentro do bloco `/estoque`:
  ```tsx
  const EstoqueHelp = lazy(() => import("./pages/estoque/EstoqueHelp"));
  <Route path="ajuda" element={<EstoqueHelp />} />
  ```
- Adicionar o item **Ajuda** (ícone `HelpCircle`) em `src/components/EstoqueSidebar.tsx` no `moduleMenuItems`, posicionado após **Perfil**, igual ao padrão de Escalas/Férias.

## Revisão das ajudas existentes

Auditar `src/pages/Help.tsx` (Escalas) e `src/pages/ferias/FeriasHelp.tsx` para garantir que estão alinhadas com o estado atual do código. Itens a verificar/atualizar quando divergirem:

- **Escalas (`Help.tsx`)** — confirmar se cobre: rotação de sábados, proteção de cobertura por dia da semana (Bessa), períodos internos por local, dialogs de troca/substituição/data específica, relatórios e exportações.
- **Férias (`FeriasHelp.tsx`)** — confirmar se inclui: períodos quitados, exceções de período, afastamentos (com novas regras de RLS), formulário anual, créditos de férias e folgas, e a aba **Créditos** mais recente.
- **Vendas** — atualmente **não existe** página de ajuda. Não criaremos agora (fora do escopo do pedido), mas registraremos pendência no `.lovable/plan.md` para abrir depois caso desejado.

A revisão é só de conteúdo (texto), sem mudanças de comportamento. Onde houver divergência, atualizar os textos/passos para refletir o que está no código hoje.

## Arquivos afetados

- **Criar**: `src/pages/estoque/EstoqueHelp.tsx`
- **Editar**: `src/App.tsx` (rota), `src/components/EstoqueSidebar.tsx` (item de menu)
- **Editar (se houver divergências)**: `src/pages/Help.tsx`, `src/pages/ferias/FeriasHelp.tsx`
- **Editar**: `.lovable/plan.md` (registrar pendência de ajuda do Vendas)

Nenhuma alteração em banco/RLS/edge functions.
