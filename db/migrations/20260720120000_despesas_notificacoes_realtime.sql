-- Habilita replicação Realtime para o sino de notificações do módulo Despesas.
-- Só adiciona se ainda não estiver na publicação (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'despesas_notificacoes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.despesas_notificacoes';
  END IF;
END $$;

ALTER TABLE public.despesas_notificacoes REPLICA IDENTITY FULL;