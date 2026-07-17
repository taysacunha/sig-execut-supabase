-- =====================================================================
-- Fase 5 — Módulo Despesas: lacunas apontadas pela planilha BRUNNO-2
--
-- 1) Novos estados terminais para lançamentos: 'quitado' e 'gimob'
--    - quitado: baixa manual sem pagamento registrado (acordo, glosa,
--      compensação) — encerra a conta sem afetar valor_pago.
--    - gimob : lançamento tratado/liquidado por sistema externo (GIMOB);
--      mantido só como registro histórico.
--    Ambos são estados terminais, ignorados pelo trigger de recálculo,
--    igual ao 'cancelado'.
--
-- 2) Campo `credenciais jsonb` em despesas_lancamentos: observações
--    estruturadas (telefone, site, login, senha, contato).
--
-- 3) Campo `valor_limite_primeiro numeric` em despesas_repasses:
--    valor máximo a ser destinado ao primeiro beneficiário do repasse
--    (o restante segue para os demais itens/credores).
-- =====================================================================

-- 1) Ampliar check constraint de status ------------------------------
ALTER TABLE public.despesas_lancamentos
  DROP CONSTRAINT IF EXISTS despesas_lancamentos_status_check;

ALTER TABLE public.despesas_lancamentos
  ADD CONSTRAINT despesas_lancamentos_status_check
  CHECK (status IN ('a_vencer','vencido','pago_parcial','pago','cancelado','quitado','gimob'));

-- Recalcular considerando novos estados terminais
CREATE OR REPLACE FUNCTION public.despesas_recalcular_lancamento(_lancamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric(14,2);
  v_pago  numeric(14,2);
  v_venc  date;
  v_status text;
BEGIN
  SELECT valor_total, data_vencimento, status
    INTO v_total, v_venc, v_status
  FROM public.despesas_lancamentos
  WHERE id = _lancamento_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_pago
  FROM public.despesas_lancamento_pagamentos
  WHERE lancamento_id = _lancamento_id;

  -- Estados terminais manuais: nunca sobrescrever automaticamente.
  IF v_status IN ('cancelado','quitado','gimob') THEN
    UPDATE public.despesas_lancamentos
       SET valor_pago = v_pago, updated_at = now()
     WHERE id = _lancamento_id;
    RETURN;
  END IF;

  IF v_pago >= v_total AND v_total > 0 THEN
    v_status := 'pago';
  ELSIF v_pago > 0 THEN
    v_status := 'pago_parcial';
  ELSIF v_venc < current_date THEN
    v_status := 'vencido';
  ELSE
    v_status := 'a_vencer';
  END IF;

  UPDATE public.despesas_lancamentos
     SET valor_pago = v_pago,
         status    = v_status,
         updated_at = now()
   WHERE id = _lancamento_id;
END;
$$;

-- 2) Credenciais estruturadas ---------------------------------------
ALTER TABLE public.despesas_lancamentos
  ADD COLUMN IF NOT EXISTS credenciais jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.despesas_lancamentos.credenciais IS
  'Observações estruturadas: {telefone, site, login, senha, contato}';

-- 3) Valor limite ao primeiro beneficiário --------------------------
ALTER TABLE public.despesas_repasses
  ADD COLUMN IF NOT EXISTS valor_limite_primeiro numeric(14,2)
  CHECK (valor_limite_primeiro IS NULL OR valor_limite_primeiro >= 0);

COMMENT ON COLUMN public.despesas_repasses.valor_limite_primeiro IS
  'Valor máximo destinado ao primeiro beneficiário; excedente vai para os demais itens.';