# Supervisor com entrada de saldos + Calendário de despesas na página de Veículos

## Parte 1 — Por que o supervisor não consegue dar entrada em saldos

São dois bloqueios, um no front e outro no banco:

1. `src/pages/estoque/EstoqueSaldos.tsx` (linha 170) calcula
   `canEditEstoque = canEdit("estoque") && (isAdmin || isSuperAdmin)`.
   Mesmo com acesso de edição ao Estoque, quem não é admin não vê os botões de nova entrada/ajuste/transferência.
2. As políticas RLS de `estoque_saldos` e `estoque_movimentacoes` foram endurecidas para
   `is_admin_or_super(auth.uid()) AND has_system_access(auth.uid(), 'estoque')`
   (arquivo `.lovable/estoque_saldos_admin_only_rls.sql`). Ou seja, mesmo forçando a requisição, o banco recusa.

Por isso o Ruan só conseguia trabalhar como Administrador — e, de quebra, ganhava a página "Permissões por Aba" do módulo Despesas, que é liberada para `admin`/`super_admin` no `DespesasSidebar`.

### Correção

- Nova migration `db/migrations/…_estoque_saldos_supervisor.sql`: recriar as políticas de INSERT/UPDATE/DELETE de `estoque_saldos` e `estoque_movimentacoes` trocando `is_admin_or_super` por uma condição que também aceita `supervisor`, sempre combinada com `can_edit_system(auth.uid(), 'estoque')`. Perfis abaixo de supervisor (colaborador, corretor) continuam sem escrita.
- `EstoqueSaldos.tsx`: `canEditEstoque = canEdit("estoque") && (isAdmin || isSuperAdmin || isSupervisor)`.
- Nada muda no módulo Despesas: como supervisor, Ruan deixa de ver "Permissões por Aba".
- Depois disso, o perfil do Ruan volta a Supervisor na página de Usuários.

## Parte 2 — Calendário de despesas dentro da página de Veículos

Hoje os encargos gerados por veículo (IPVA, seguro, licenciamento) viram lançamentos soltos no calendário geral e **não guardam vínculo com o veículo** — só o texto da descrição. Por isso a página de Veículos não consegue listá-los.

### Banco (migration `…_despesas_lancamentos_veiculo_id.sql`)

- Adicionar `veiculo_id uuid REFERENCES despesas_veiculos(id)` em `despesas_lancamentos` e em `despesas_recorrencias`, com índice.
- Atualizar `despesas_gerar_encargos_veiculo` para gravar `veiculo_id` (e usar esse campo na checagem de duplicidade, no lugar da comparação por descrição).
- Backfill dos lançamentos já gerados: casar pela descrição/observação de encargo de veículo e preencher `veiculo_id`.

### Interface — página `/despesas/veiculos` com abas

A página passa a ter três abas, sem sair da permissão `veiculos`:

- **Veículos** — a tabela atual, sem alterações.
- **Calendário** — mesma visão mensal do calendário de Despesas, porém filtrada só a lançamentos com `veiculo_id`, com filtro por veículo, por tipo de encargo e navegação de mês/ano. Cada lançamento mostra vencimento, descrição, valor (respeitando o botão do olho) e status.
  - Botão "Marcar como pago" abre confirmação (reaproveitando `PagamentoDialog`) com data e valor pago.
  - Botão "Desfazer pagamento" (estorno) exige justificativa obrigatória em AlertDialog, usando o `useEstornarLancamento` já existente, que registra auditoria.
- **Recorrências** — encargos que se repetem todo ano (IPVA, licenciamento, seguro), listados por veículo com frequência, valor e próximo vencimento, e ação de gerar o ano seguinte. Reaproveita os hooks de `useDespesasRecorrencias` filtrando por `veiculo_id`.

Quem tiver apenas a aba "Veículos" liberada continua sem acesso ao calendário geral de Despesas — todo o fluxo fica concentrado aqui.

### Arquivos afetados

- `src/pages/despesas/DespesasVeiculos.tsx` (abas + composição)
- Novos `src/components/despesas/veiculos/VeiculosCalendario.tsx` e `VeiculosRecorrencias.tsx`
- `src/hooks/useDespesasVeiculos.ts` (hooks de lançamentos/recorrências por veículo)
- `src/hooks/useDespesasLancamentos.ts` (filtro por `veiculo_id`)
- `src/components/despesas/LancamentoDialog.tsx` (persistir `veiculo_id` quando aplicável)

As duas migrations precisam ser executadas no Supabase para valer.
