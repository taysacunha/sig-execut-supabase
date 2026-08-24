-- Estoque máximo por material (0 = sem máximo definido)
ALTER TABLE public.estoque_materiais
  ADD COLUMN IF NOT EXISTS estoque_maximo integer NOT NULL DEFAULT 0;
