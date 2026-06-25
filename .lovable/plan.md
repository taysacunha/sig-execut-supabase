## Correção: Confirmação de recebimento (Ruan) + nome do solicitante

### 1. RPC `confirmar_recebimento_solicitacao` (SECURITY DEFINER)
Nova migration criando função que:
- Valida `auth.uid() = solicitante_user_id` da solicitação (senão `RAISE EXCEPTION 'Apenas o solicitante pode confirmar o recebimento'`).
- Faz `UPDATE estoque_movimentacoes SET recebido_por_user_id = auth.uid(), recebido_em = now() WHERE solicitacao_id = p_id AND recebido_em IS NULL`.
- Opcional: atualiza `estoque_solicitacoes.status = 'concluida'` (somente se hoje "entregue" for terminal — confirmar comportamento atual antes).
- Retorna `jsonb` com `{ updated_count, solicitacao_id }`.
- `GRANT EXECUTE ... TO authenticated`.

Vantagem: elimina dependência sutil de RLS/columns; roda como owner; mensagem de erro clara chega ao front.

### 2. Front-end: usar RPC + logs detalhados
Em `src/pages/estoque/EstoqueSolicitacoes.tsx`, trocar o `.update(...)` direto pela chamada:
```ts
const { data, error } = await supabase.rpc("confirmar_recebimento_solicitacao", { p_solicitacao_id: sol.id });
```
- Se `updated_count === 0`, exibir toast de aviso: "Nenhuma movimentação pendente encontrada para esta solicitação".
- No `onError`, logar `err.code`, `err.message`, `err.details`, `err.hint` no console e mostrar mensagem real no toast (para diagnóstico futuro).

### 3. Exibir nome do solicitante (não o e-mail)
Hoje a coluna **Solicitante** mostra `sol.solicitante_nome`, que em muitos registros foi salvo como e-mail (fallback `user.email`).

Correções:
- **Backfill**: migration que atualiza `estoque_solicitacoes.solicitante_nome` cruzando com `user_profiles.full_name` (ou equivalente) onde o valor atual contém `@`.
- **Criação de novas solicitações**: ajustar `createMutation` em `EstoqueSolicitacoes.tsx` para buscar o nome do `user_profiles` antes de inserir (cair para `user_metadata.name` e só por último para email).
- **Render**: na tabela e no dialog de detalhes, se `solicitante_nome` contiver `@`, resolver via lookup em `user_profiles` para exibição (cache via React Query).

### 4. Validação
- Login como Ruan no preview → confirmar recebimento de uma solicitação "entregue" → verificar que `recebido_em` é gravado, botão some, toast de sucesso.
- Verificar lista: coluna "Solicitante" exibe nome em vez de e-mail (registros antigos e novos).
- Conferir `module_audit_logs` para o evento de update.

### Arquivos afetados
- Nova migration SQL (RPC + backfill de `solicitante_nome`).
- `src/pages/estoque/EstoqueSolicitacoes.tsx` (mutation via RPC, logs, lookup de nome ao criar).
- Possível novo hook `useUserName(userId)` se a resolução de nome for usada em mais de um lugar.
