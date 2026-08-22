# Devolver a Rejane as ações de entrada, ajuste e saída no Estoque

## O que mudou e criou a restrição

Na última rodada de ajustes (para liberar o Ruan como Supervisor), as permissões da página **Saldos** foram estreitadas em dois lugares:

- **Banco (RLS)** — a migration `20260815120000_estoque_saldos_supervisor.sql` substituiu as políticas antigas de `estoque_saldos` e `estoque_movimentacoes` (que aceitavam qualquer usuário com edição no sistema estoque) por políticas que exigem **admin, super_admin ou supervisor** + edição em estoque.
- **Tela** — em `src/pages/estoque/EstoqueSaldos.tsx` os botões passaram a depender de `canEdit("estoque") && (isAdmin || isSuperAdmin || isSupervisor)`.

Ou seja: quem tem permissão de edição em Estoque mas **não** é admin/supervisor perdeu os botões **+ Entrada**, **Ajuste** e **Saída**. É o caso da Rejane, que atua como apoio (perfil operacional, não administrativo) e é quem opera as movimentações no dia a dia.

## Esclarecendo: cadastrar em "Gestores" não abre páginas administrativas

Verificado no código (`src/components/EstoqueSidebar.tsx`): os itens **Gestores e Usuários**, **Usuários** e **Auditoria** só aparecem para quem tem perfil **super_admin ou admin**. O cadastro na tabela `estoque_gestores` é apenas um vínculo operacional (gestor de estoque de uma unidade, usado para notificações e fluxo de solicitações) — ele **não** muda o perfil da Rejane nem libera essas telas. Ela continuaria vendo exatamente o mesmo menu de hoje.

Ainda assim, para não depender desse cadastro, a correção principal é outra: devolver a permissão pelo critério que ela já tinha antes.

## Passo 1 — Restaurar a regra anterior, sem tirar o que o Ruan ganhou

Antes da mudança, quem tinha **permissão de edição no sistema Estoque** (`system_access = view_edit`) podia movimentar saldos — era esse o caso da Rejane (perfil apoio/colaborador). A migration nova estreitou isso para admin/supervisor.

Nova migration recriando as políticas de `INSERT`/`UPDATE`/`DELETE` de `estoque_saldos` e `estoque_movimentacoes` com o critério:

```text
pode movimentar = can_edit_system(uid, 'estoque')
```

Ou seja: volta a valer a permissão por sistema (concedida individualmente na tela de Usuários), que continua cobrindo o Ruan (supervisor com edição) e a Rejane, e continua barrando quem só tem "somente visualizar" ou nenhum acesso ao módulo.



## Passo 2 — Alinhar a tela

Em `EstoqueSaldos.tsx`, remover a exigência extra de perfil: os botões **+ Entrada**, **Ajuste** e **Saída** voltam a depender apenas de `canEdit("estoque")`, igual ao banco — assim ela vê e consegue salvar.

## Passo 3 — Validar

- Rejane: abrir Saldos, registrar entrada, ajuste e saída, confirmar que salva sem erro de permissão.
- Ruan (supervisor) e admins: continuar funcionando como hoje.
- Usuário com "somente visualizar" em Estoque: continuar sem os botões.
- Menu da Rejane: continua sem Gestores/Usuários/Auditoria (nada muda de perfil).

## Detalhes técnicos

- Migration nova em `db/migrations/` (sem editar a `20260815120000`), com `DROP POLICY IF EXISTS` + `CREATE POLICY` para as seis políticas de `estoque_saldos` e `estoque_movimentacoes`, usando apenas `public.can_edit_system(auth.uid(), 'estoque')`.
- Frontend: `EstoqueSaldos.tsx` volta a usar `canEditEstoque = canEdit("estoque")`.

- A trava recente de "não marcar como Entregue sem Separar" permanece — ela não bloqueia entrada/ajuste/saída; se a Rejane também estiver esbarrando nela, avise que trato num passo à parte.
