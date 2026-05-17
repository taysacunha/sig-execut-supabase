## Diagnóstico

O warning continua porque a migration anterior corrigiu apenas `public.ferias_premiacoes_check_atesto()`, mas o linter do Supabase ainda encontrou pelo menos uma função no banco sem `search_path` configurado.

Pela análise das migrations, as candidatas restantes são:

- `public.handle_updated_at()` — migration antiga criou sem `SET search_path`, embora o contexto atual mostre uma versão com `public, pg_temp`.
- `public.audit_module_changes()` — houve uma definição antiga sem schema/search_path; depois há correção com `public.audit_module_changes()` e `SET search_path`.
- `public.atualizar_status_ferias()` — a versão no banco atual já aparece com `SET search_path = public` no contexto, mas havia migration antiga sem isso.

Como o scanner do Supabase não informa o nome da função no resumo, o caminho mais seguro é aplicar uma migration idempotente que força `search_path` nas funções conhecidas/candidatas sem alterar a lógica delas.

## Plano

1. Criar uma nova migration SQL de correção geral para `Function Search Path Mutable`.
2. Na migration, usar `ALTER FUNCTION ... SET search_path = ...` para as funções candidatas, sem recriar o corpo e sem mudar regras de negócio:
   - `public.handle_updated_at()` com `public, pg_temp`.
   - `public.audit_module_changes()` com `public`.
   - `public.atualizar_status_ferias()` com `public`.
   - manter também `public.ferias_premiacoes_check_atesto()` com `public`, como reforço idempotente.
3. Validar localmente que a migration foi criada com os comandos corretos.
4. Depois que você executar a migration, rodar novamente o scanner de segurança para confirmar se o warning desapareceu.

## Observação técnica

`CREATE OR REPLACE FUNCTION` nem sempre é o melhor para correções amplas porque pode sobrescrever lógica atual se houver versões diferentes. Para este caso, `ALTER FUNCTION ... SET search_path` é mais seguro: ajusta apenas a configuração da função existente.