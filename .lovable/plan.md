# Remover logs de auditoria sem alterações reais

## Causa raiz

A função PostgreSQL `audit_module_changes()` calcula `v_changed_fields` comparando `to_jsonb(NEW)` com `to_jsonb(OLD)` sem nenhum filtro. Toda tabela do módulo Férias possui um trigger `BEFORE UPDATE` (`set_..._updated_at`) que executa `handle_updated_at()` e força `NEW.updated_at = now()`.

Resultado: qualquer `UPDATE` (mesmo quando o usuário submete o formulário do colaborador sem mudar nada de fato, ou quando uma rotina interna toca a linha) sempre tem ao menos um campo "alterado" (`updated_at`), e a auditoria grava o log. No painel, o componente `AuditLogsPanel` filtra `updated_at`/`created_at` e mostra "Apenas o timestamp foi atualizado" ou "Sem campos alterados" — exatamente o que o Bruno está vendo.

Isso afeta todas as tabelas auditadas (Férias, Vendas, Escalas, Estoque), não apenas `ferias_colaboradores`.

## Solução

### 1. Atualizar `audit_module_changes()` para ignorar campos técnicos

Nova migration que recria a função filtrando do array `v_changed_fields` os campos:
`id`, `created_at`, `updated_at`, `created_by`.

Após o filtro, se o array ficar vazio em um `UPDATE`, **não insere log**. Mantém todo o resto da lógica atual (classificação de módulo, captura de usuário, INSERT/DELETE inalterados, `SECURITY DEFINER`, `SET search_path = public`).

Esboço da mudança no bloco `UPDATE`:

```sql
SELECT ARRAY_AGG(changes.key) INTO v_changed_fields
FROM (
  SELECT key
  FROM jsonb_each(v_new_data)
  WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    AND key NOT IN ('id', 'created_at', 'updated_at', 'created_by')
) AS changes;
```

E a guarda final:

```sql
IF TG_OP <> 'UPDATE'
   OR (v_changed_fields IS NOT NULL AND array_length(v_changed_fields, 1) > 0) THEN
  INSERT INTO public.module_audit_logs (...) VALUES (...);
END IF;
```

### 2. Limpar logs históricos inúteis

Na mesma migration, remover registros já gravados onde nenhum campo relevante mudou:

```sql
DELETE FROM public.module_audit_logs
WHERE action = 'UPDATE'
  AND (
    changed_fields IS NULL
    OR changed_fields <@ ARRAY['id','created_at','updated_at','created_by']::text[]
  );
```

Isso esvazia a poluição visível na tela de Auditoria — Férias e Folgas (e nos outros módulos), sem afetar logs reais.

### 3. Validação

- Após a migration, abrir a página `/ferias/auditoria` e confirmar que os logs "Sem campos alterados" / "Apenas timestamp atualizado" do Bruno desapareceram.
- Editar um colaborador alterando um campo real → o log aparece normalmente.
- Editar um colaborador e salvar sem mudar nada → nenhum log novo é gerado.

## Sem alterações no frontend

`AuditLogsPanel.tsx` já trata os dois cenários corretamente; nenhuma mudança em React é necessária. O ajuste é puramente na função SQL + limpeza de dados.
