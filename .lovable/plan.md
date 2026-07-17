## SQL para rodar agora no Supabase SQL Editor

Rode os dois blocos abaixo, na ordem.

### 1) Corrigir a função de auditoria (fix do erro `record_id uuid vs text`)

```sql
CREATE OR REPLACE FUNCTION public.audit_module_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_module_name text; v_old_data jsonb; v_new_data jsonb;
  v_changed_fields text[]; v_user_id uuid; v_user_email text;
BEGIN
  IF TG_TABLE_NAME LIKE 'despesas_%' THEN v_module_name := 'despesas';
  ELSIF TG_TABLE_NAME LIKE 'ferias_%' THEN v_module_name := 'ferias';
  ELSIF TG_TABLE_NAME LIKE 'estoque_%' THEN v_module_name := 'estoque';
  ELSIF TG_TABLE_NAME IN ('sales','sales_brokers','sales_teams','broker_evaluations','monthly_leads','proposals','sale_partners') THEN v_module_name := 'vendas';
  ELSIF TG_TABLE_NAME IN ('brokers','locations','schedule_assignments','generated_schedules','location_period_configs','saturday_queue','location_rotation_queues') THEN v_module_name := 'escalas';
  ELSE v_module_name := 'sistema';
  END IF;
  BEGIN v_user_id := auth.uid(); EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;
  BEGIN SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN v_user_email := NULL; END;
  IF TG_OP = 'DELETE' THEN v_old_data := to_jsonb(OLD); v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN v_old_data := NULL; v_new_data := to_jsonb(NEW);
  ELSE
    v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW);
    SELECT array_agg(key) INTO v_changed_fields FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM value AND key NOT IN ('updated_at','created_at');
    IF v_changed_fields IS NULL OR array_length(v_changed_fields,1) IS NULL THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.module_audit_logs (module_name, table_name, record_id, action, old_data, new_data, changed_fields, changed_by, changed_by_email)
  VALUES (v_module_name, TG_TABLE_NAME,
    CASE WHEN TG_OP='DELETE' THEN (OLD).id ELSE (NEW).id END,
    TG_OP, v_old_data, v_new_data, v_changed_fields, v_user_id, v_user_email);
  RETURN COALESCE(NEW, OLD);
END; $function$;
```

Diferença vs. o que deu erro: o `record_id` agora é passado como `uuid` puro (sem `::text` e sem `COALESCE(..., '')`), batendo com o tipo da coluna.

### 2) Liberar o módulo Despesas para o seu usuário

```sql
INSERT INTO public.system_access (user_id, system_name, permission_type)
VALUES ('11ab4056-0346-492e-9d45-6da0a5291f9b', 'despesas', 'view_edit')
ON CONFLICT (user_id, system_name) DO UPDATE SET permission_type = EXCLUDED.permission_type;
```

### Depois de rodar

1. Faça logout e login novamente para o cache do `useSystemAccess` recarregar.
2. O card Despesas deve aparecer no menu.

## Observação técnica

Não altera nenhum arquivo do projeto — o `docs/migrations/despesas_fase1.sql` já foi ajustado com essa mesma versão da função nos passos anteriores; o SQL acima é apenas o recorte que precisa ser reexecutado no banco.
