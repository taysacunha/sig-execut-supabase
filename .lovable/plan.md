# Corrigir erro de RLS ao registrar saída de placa para imóvel

## O que está acontecendo

Na saída de placa para imóvel existem dois caminhos:

- **Placa já com código** — o sistema apenas atualiza a placa (funciona, pois a política de atualização usa permissão de edição do módulo Estoque).
- **Criar novo código na hora da saída** — o sistema **insere** uma nova linha em `estoque_placas`. A política de inserção dessa tabela (`placas_insert_admin`, criada em `.lovable/estoque_placas_migration.sql`) exige que o usuário seja **administrador ou super admin**.

Ruan é supervisor com permissão de edição no Estoque, então a inserção é recusada com
`new row violates row-level security policy for table "estoque_placas"`.

Isso é resquício de uma correção anterior (`db/migrations/20260728120000_estoque_placas_edit_permission.sql`) que alinhou a política de **atualização** com `can_edit_system`, mas deixou a de **inserção** presa a admin.

## Correção

Nova migration `db/migrations/<timestamp>_estoque_placas_insert_edit_permission.sql`:

- Recriar `placas_insert_admin` (renomeando para `placas_insert_editor`) com
  `WITH CHECK (public.can_edit_system(auth.uid(), 'estoque'))`.
- Manter `placas_delete_admin` restrita a administradores (exclusão de placa continua sendo ação crítica).
- Confirmar que `placas_hist_insert` também usa `can_edit_system` (hoje usa apenas `has_system_access`, ou seja, quem só visualiza consegue gravar histórico) — endurecer para `can_edit_system`.

Quem tem apenas visualização do Estoque continua sem criar ou alterar placas.

## Observação

Como as ferramentas de migration/SQL estão desabilitadas neste projeto, o arquivo SQL será criado em `db/migrations/` e precisa ser executado no SQL Editor do Supabase para valer.

## Sem alteração de frontend

Nenhuma mudança em `NovaSaidaDialog.tsx` é necessária: a tela já exige permissão de edição para abrir o fluxo; o bloqueio é exclusivamente no banco.
