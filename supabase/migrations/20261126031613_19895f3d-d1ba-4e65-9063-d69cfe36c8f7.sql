ALTER TABLE public.despesas_imoveis DROP CONSTRAINT IF EXISTS despesas_imoveis_situacao_check;
ALTER TABLE public.despesas_imoveis ADD CONSTRAINT despesas_imoveis_situacao_check CHECK (situacao IN ('alugado', 'vago', 'vendido', 'proprio_uso', 'em_aquisicao', 'em_temporada'));

-- Regression: exercise the new status and history with no persistent changes.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.despesas_imoveis WHERE situacao <> 'em_temporada' LIMIT 1;
  IF v_id IS NOT NULL THEN
    BEGIN
      UPDATE public.despesas_imoveis SET situacao = 'em_temporada' WHERE id = v_id;
      IF NOT EXISTS (SELECT 1 FROM public.despesas_imoveis WHERE id = v_id AND situacao = 'em_temporada') THEN
        RAISE EXCEPTION 'Nova situação não foi persistida';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.despesas_imovel_situacao_historico WHERE imovel_id = v_id AND situacao_nova = 'em_temporada') THEN
        RAISE EXCEPTION 'Nova situação não foi registrada no histórico';
      END IF;
      RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'Rollback do teste de situação';
    EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
    END;
  END IF;
END $$;