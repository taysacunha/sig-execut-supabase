## Tratar 5 avisos de segurança

### 1. Ignorar 4 falsos positivos no scanner
Marcar como "ignore" via `security--manage_security_finding`, com justificativa registrada:

- **`dev_tracker_no_select_policy`** — Tabela protegida por política `ALL` restrita a admin/super_admin. A ausência de SELECT separado é intencional (tudo bloqueado para os demais).
- **`ferias_colaborador_setores_substitutos_missing_update`** — Tabela append/delete-only por design; o app não edita, apenas recria.
- **`ferias_folgas_perdas_missing_update`** — Idem: registros de perda são lançados/apagados, nunca editados.
- **`ferias_setor_chefes_missing_update`** — Idem: vínculos de chefia são removidos e recriados.

### 2. Atualizar `mem://security-memory`
Registrar os 4 padrões aceitos para que scanners futuros não voltem a sinalizá-los como problema.

### 3. Migration: guard NULL em `is_admin_or_super`
Criar `db/migrations/<timestamp>_is_admin_or_super_null_guard.sql` com `CREATE OR REPLACE FUNCTION` mantendo a assinatura atual e adicionando:

```sql
SELECT CASE
  WHEN _user_id IS NULL THEN FALSE
  ELSE EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin','admin')
  )
END;
```

Mantém `STABLE SECURITY DEFINER` e `search_path = public`. Marcar o finding `is_admin_or_super_null_uid` como `mark_as_fixed` depois.

### Escopo
- Sem mudanças no app frontend.
- Sem alteração de comportamento — apenas robustez explícita e silenciamento de falsos positivos.