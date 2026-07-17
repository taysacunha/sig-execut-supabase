-- Fecha lacunas de auditoria no módulo Despesas.
-- Aplica o trigger `trg_<tabela>_audit` (AFTER INSERT/UPDATE/DELETE →
-- public.audit_module_changes) nas tabelas de cadastros base e de permissões
-- que ainda não tinham o gatilho.
--
-- Não inclui:
--   * despesas_lancamento_pagamentos → auditado via lançamento pai (evita duplicar)
--   * despesas_notificacoes → ruído (geradas em lote pelo scheduler)
--
-- Idempotente: DROP TRIGGER IF EXISTS antes de cada CREATE TRIGGER.

DO $$
DECLARE
  t text;
  audit_tables text[] := ARRAY[
    'despesas_categorias',
    'despesas_subcategorias',
    'despesas_planos_conta',
    'despesas_centros_custo',
    'despesas_contas_bancarias',
    'despesas_pessoas',
    'despesas_veiculos',
    'despesas_aba_permissoes',
    'despesas_centros_custo_permissoes',
    'despesas_perfis_acesso'
  ];
BEGIN
  FOREACH t IN ARRAY audit_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes()',
      t, t
    );
  END LOOP;
END $$;