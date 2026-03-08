-- =============================================
-- Migração: Adicionar setor_id a estoque_usuarios_unidades e estoque_solicitacoes
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Adicionar setor_id em estoque_usuarios_unidades
ALTER TABLE public.estoque_usuarios_unidades
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.ferias_setores(id) ON DELETE SET NULL;

-- 2. Adicionar setor_id em estoque_solicitacoes
ALTER TABLE public.estoque_solicitacoes
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.ferias_setores(id) ON DELETE SET NULL;
