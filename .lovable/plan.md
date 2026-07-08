## Objetivo

Resolver apenas 2 findings do scanner de segurança:

1. **`user_profiles_update_no_with_check`** — corrigir de fato.
2. **`ferias_colaboradores_birthdate_exposure`** — ignorar com justificativa (regra de negócio: qualquer usuário com acesso ao módulo Férias deve continuar vendo a data de nascimento para o quadro de aniversariantes).

Nenhum outro finding será tocado.

## 1. Fix: `user_profiles` UPDATE sem WITH CHECK

Nova migration `supabase/migrations/<timestamp>_user_profiles_update_with_check.sql`:

```sql
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Efeito: além de restringir *qual* linha o usuário pode atualizar (`USING`), o `WITH CHECK` impede que ele reescreva `user_id` para apontar para outro usuário (evita sequestro de perfil).

Nenhuma alteração de código no frontend — a policy é transparente para quem já só edita o próprio perfil.

## 2. Ignore: exposição de `data_nascimento`

Chamada de `security--manage_security_finding` com:

- `operation`: `ignore`
- `scanner_name`: `supabase_lov`
- `internal_id`: `ferias_colaboradores_birthdate_exposure`
- `explanation`: "Comportamento intencional. O módulo Férias mantém o quadro de Aniversariantes e o widget do dashboard visíveis a todos os usuários com `can_view_system('ferias')`. A data de nascimento é dado corporativo compartilhado internamente. CPF permanece isolado em `ferias_colaboradores_dados_sensiveis`."

## 3. Atualização da `@security-memory`

Adicionar nota curta registrando:
- `user_profiles` UPDATE agora exige `WITH CHECK (user_id = auth.uid())`.
- Exposição de `data_nascimento` em `ferias_colaboradores` para qualquer viewer de `ferias` é intencional (feature Aniversariantes). CPF continua em tabela sensível separada.

## Fora de escopo

- Qualquer refactor de aniversariantes/dashboard/PDFs.
- Movimentação da coluna `data_nascimento` para tabela sensível.
- Outros findings do scanner.
