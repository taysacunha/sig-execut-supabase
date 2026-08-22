# Devolver a Rejane as ações de entrada, ajuste e saída no Estoque

## O que mudou e criou a restrição

Na última rodada de ajustes (para liberar o Ruan como Supervisor), as permissões da página **Saldos** foram estreitadas em dois lugares:

- **Banco (RLS)** — a migration `20260815120000_estoque_saldos_supervisor.sql` substituiu as políticas antigas de `estoque_saldos` e `estoque_movimentacoes` (que aceitavam qualquer usuário com edição no sistema estoque) por políticas que exigem **admin, super_admin ou supervisor** + edição em estoque.
- **Tela** — em `src/pages/estoque/EstoqueSaldos.tsx` os botões passaram a depender de `canEdit("estoque") && (isAdmin || isSuperAdmin || isSupervisor)`.

Ou seja: quem tem permissão de edição em Estoque mas **não** é admin/supervisor (caso da Rejane, que é gestora operacional do estoque) perdeu os botões **+ Entrada**, **Ajuste**, **Saída** e a confirmação dessas movimentações.

Observação: ainda não consegui confirmar no banco qual é exatamente o perfil da Rejane (a consulta ao banco está bloqueada por preferência de aprovação). O primeiro passo do plano é confirmar isso antes de aplicar a correção.

## Passo 1 — Confirmar o perfil da Rejane

```sql
select up.name, up.email, ur.role, sa.permission_type,
       exists (select 1 from estoque_gestores g where g.user_id = up.user_id) as e_gestor_estoque
from user_profiles up
left join user_roles ur on ur.user_id = up.user_id
left join system_access sa on sa.user_id = up.user_id and sa.system_name = 'estoque'
where up.name ilike '%rejane%';
```

## Passo 2 — Ampliar a regra de quem pode movimentar estoque

Trocar o critério "admin ou supervisor" por um critério que também inclua **gestores de estoque** (usuários cadastrados em `estoque_gestores`), mantendo a exigência de permissão de edição no sistema estoque:

```text
pode movimentar = can_edit_system(uid,'estoque')
                  AND ( admin OR super_admin OR supervisor OR gestor de estoque )
```

- Nova função `public.is_gestor_estoque(uid)` (SECURITY DEFINER, STABLE) que verifica presença em `estoque_gestores`.
- Nova migration recriando as políticas de `INSERT`/`UPDATE`/`DELETE` de `estoque_saldos` e `estoque_movimentacoes` com essa condição — sem tirar nada do que o Ruan (supervisor) ganhou.

Se o Passo 1 mostrar que a Rejane **não** está em `estoque_gestores`, a alternativa é cadastrá-la como gestora da unidade dela (tela Gestores) — sem afrouxar a regra para todos os colaboradores.

## Passo 3 — Alinhar a tela

Em `EstoqueSaldos.tsx`, criar o mesmo critério no frontend (incluindo "é gestor de estoque", via consulta a `estoque_gestores` do usuário logado) para que os botões **+ Entrada**, **Ajuste** e **Saída** voltem a aparecer para ela — evitando o caso de o banco permitir e a tela esconder.

## Passo 4 — Validar

- Rejane: abrir Saldos, registrar uma entrada e um ajuste, confirmar que salva sem erro de permissão.
- Ruan (supervisor) e admins: continuar funcionando como hoje.
- Colaborador comum sem edição: continuar sem os botões.

## Detalhes técnicos

- Migration nova em `db/migrations/` (não editar a `20260815120000`), com `DROP POLICY IF EXISTS` + `CREATE POLICY` para as seis políticas afetadas.
- Frontend: hook simples `useIsGestorEstoque()` (React Query) usado em `EstoqueSaldos.tsx`.
- A trava recente de "não marcar como Entregue sem Separar" permanece — ela não bloqueia entrada/ajuste/saída; se a Rejane também estiver esbarrando nela, avise que trato num passo à parte.
