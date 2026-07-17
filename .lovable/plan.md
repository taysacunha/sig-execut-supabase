O erro acontece porque a função `audit_module_changes()` ainda está enviando `record_id` como `text`, mas a coluna `public.module_audit_logs.record_id` é `uuid`.

Plano de correção:

1. Atualizar a função `public.audit_module_changes()` para gravar `record_id` como UUID, removendo o `::text` e o fallback `''`.
   - Trocar a expressão atual:

```sql
COALESCE((CASE WHEN TG_OP='DELETE' THEN (OLD).id ELSE (NEW).id END)::text, '')
```

   - Por uma expressão UUID:

```sql
CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
```

2. Manter os nomes corretos das colunas de auditoria:

```sql
changed_by, changed_by_email
```

3. Atualizar também o arquivo de referência `docs/migrations/despesas_fase1.sql`, para evitar que esse erro volte caso o SQL seja copiado novamente.

4. Depois da função corrigida, rodar novamente o `INSERT` de acesso ao módulo:

```sql
INSERT INTO public.system_access (user_id, system_name, permission_type)
VALUES ('11ab4056-0346-492e-9d45-6da0a5291f9b', 'despesas', 'view_edit');
```

5. Fazer logout/login para recarregar os acessos do usuário.

SQL exato que será usado para corrigir a linha crítica:

```sql
INSERT INTO public.module_audit_logs (
  module_name, table_name, record_id, action,
  old_data, new_data, changed_fields, changed_by, changed_by_email
)
VALUES (
  v_module_name,
  TG_TABLE_NAME,
  CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
  TG_OP,
  v_old_data,
  v_new_data,
  v_changed_fields,
  v_user_id,
  v_user_email
);
```