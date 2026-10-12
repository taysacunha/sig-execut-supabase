CREATE OR REPLACE FUNCTION public.despesas_validar_conta_vinculada() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
 IF TG_OP='UPDATE' AND NEW.conta_bancaria_id IS NOT DISTINCT FROM OLD.conta_bancaria_id THEN RETURN NEW; END IF;
 IF NEW.conta_bancaria_id IS NULL THEN RETURN NEW; END IF;
 IF NOT public.despesas_conta_permitida(auth.uid(),NEW.conta_bancaria_id) THEN RAISE EXCEPTION 'Conta bancária não autorizada para este usuário' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.audit_module_changes()'::regprocedure) INTO def; def:=replace(def,'''despesas_recorrencias'', ''despesas_notificacoes_preferencias''', '''despesas_recorrencias'', ''despesas_notificacoes_preferencias'', ''despesas_contas_bancarias_permissoes'''); EXECUTE def; END $$;