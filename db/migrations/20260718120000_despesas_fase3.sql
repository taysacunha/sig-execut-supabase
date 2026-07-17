-- =====================================================================
-- Fase 3 — Módulo Despesas
--   • Imóveis (carteira + encargos IPTU/TCR/SPU + histórico de situação)
--   • Veículos: documentos recorrentes + baixa por venda
--   • Repasses mensais aos proprietários
--
-- Padrões herdados das Fases 1/2:
--   • Ordem: CREATE TABLE → GRANT → ENABLE RLS → POLICIES
--   • RLS: despesas_pode_ver_aba / despesas_pode_editar_aba /
--          despesas_pode_excluir_aba + IN (SELECT despesas_centros_permitidos(auth.uid()))
--   • updated_at via public.handle_updated_at()
--   • Auditoria via public.audit_module_changes()
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Imóveis
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'comercial'
    CHECK (tipo IN ('comercial','residencial','terreno','outro')),
  situacao text NOT NULL DEFAULT 'vago'
    CHECK (situacao IN ('alugado','vago','vendido','proprio_uso')),
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  matricula text,
  inscricao_municipal text,
  area_total numeric(12,2),
  proprietario_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  inquilino_id uuid REFERENCES public.despesas_pessoas(id) ON DELETE SET NULL,
  centro_custo_id uuid NOT NULL REFERENCES public.despesas_centros_custo(id) ON DELETE RESTRICT,
  valor_aluguel numeric(14,2) DEFAULT 0 CHECK (valor_aluguel >= 0),
  taxa_administracao_pct numeric(6,3) DEFAULT 0 CHECK (taxa_administracao_pct >= 0 AND taxa_administracao_pct <= 100),
  data_aquisicao date,
  data_venda date,
  observacao text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_imov_centro ON public.despesas_imoveis(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_desp_imov_situacao ON public.despesas_imoveis(situacao);
CREATE INDEX IF NOT EXISTS idx_desp_imov_proprietario ON public.despesas_imoveis(proprietario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_imoveis TO authenticated;
GRANT ALL ON public.despesas_imoveis TO service_role;

ALTER TABLE public.despesas_imoveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_imov_select" ON public.despesas_imoveis FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'imoveis')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_imov_insert" ON public.despesas_imoveis FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_imov_update" ON public.despesas_imoveis FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_imov_delete" ON public.despesas_imoveis FOR DELETE TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'imoveis')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 2) Encargos recorrentes por imóvel (template para geração no calendário)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_imovel_encargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL REFERENCES public.despesas_imoveis(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('iptu','tcr','spu','condominio','outro')),
  descricao text,
  valor_anual numeric(14,2) NOT NULL CHECK (valor_anual >= 0),
  parcelas int NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 24),
  vencimento_primeira_parcela date NOT NULL,
  categoria_id uuid REFERENCES public.despesas_categorias(id) ON DELETE SET NULL,
  plano_conta_id uuid REFERENCES public.despesas_planos_conta(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_imov_enc_imovel ON public.despesas_imovel_encargos(imovel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_imovel_encargos TO authenticated;
GRANT ALL ON public.despesas_imovel_encargos TO service_role;

ALTER TABLE public.despesas_imovel_encargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_imov_enc_select" ON public.despesas_imovel_encargos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_imoveis i
    WHERE i.id = imovel_id
      AND public.despesas_pode_ver_aba(auth.uid(), 'imoveis')
      AND i.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
CREATE POLICY "desp_imov_enc_insert" ON public.despesas_imovel_encargos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_imoveis i
    WHERE i.id = imovel_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
      AND i.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
CREATE POLICY "desp_imov_enc_update" ON public.despesas_imovel_encargos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_imoveis i
    WHERE i.id = imovel_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
      AND i.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_imoveis i
    WHERE i.id = imovel_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
      AND i.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
CREATE POLICY "desp_imov_enc_delete" ON public.despesas_imovel_encargos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_imoveis i
    WHERE i.id = imovel_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
      AND i.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

-- ---------------------------------------------------------------------
-- 3) Histórico de situação do imóvel (trigger AFTER UPDATE OF situacao)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_imovel_situacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL REFERENCES public.despesas_imoveis(id) ON DELETE CASCADE,
  situacao_anterior text,
  situacao_nova text NOT NULL,
  data date NOT NULL DEFAULT current_date,
  motivo text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_imov_hist_imovel ON public.despesas_imovel_situacao_historico(imovel_id);

GRANT SELECT, INSERT ON public.despesas_imovel_situacao_historico TO authenticated;
GRANT ALL ON public.despesas_imovel_situacao_historico TO service_role;

ALTER TABLE public.despesas_imovel_situacao_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_imov_hist_select" ON public.despesas_imovel_situacao_historico FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_imoveis i
    WHERE i.id = imovel_id
      AND public.despesas_pode_ver_aba(auth.uid(), 'imoveis')
      AND i.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
CREATE POLICY "desp_imov_hist_insert" ON public.despesas_imovel_situacao_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_imoveis i
    WHERE i.id = imovel_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'imoveis')
      AND i.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

CREATE OR REPLACE FUNCTION public.despesas_imovel_situacao_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    INSERT INTO public.despesas_imovel_situacao_historico(
      imovel_id, situacao_anterior, situacao_nova, data, changed_by
    ) VALUES (
      NEW.id, OLD.situacao, NEW.situacao, current_date, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_imov_situacao ON public.despesas_imoveis;
CREATE TRIGGER trg_desp_imov_situacao
AFTER UPDATE OF situacao ON public.despesas_imoveis
FOR EACH ROW EXECUTE FUNCTION public.despesas_imovel_situacao_trg();

-- ---------------------------------------------------------------------
-- 4) Função — gerar encargos do ano no calendário
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_gerar_encargos_imovel(_imovel_id uuid, _ano int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  i int;
  v_venc date;
  v_valor numeric(14,2);
  v_desc text;
  v_centro uuid;
  v_ins int := 0;
BEGIN
  SELECT centro_custo_id INTO v_centro FROM public.despesas_imoveis WHERE id = _imovel_id;
  IF v_centro IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT * FROM public.despesas_imovel_encargos
    WHERE imovel_id = _imovel_id AND ativo = true
  LOOP
    -- ajusta primeira parcela para o ano solicitado
    v_venc := make_date(_ano, EXTRACT(MONTH FROM r.vencimento_primeira_parcela)::int, EXTRACT(DAY FROM r.vencimento_primeira_parcela)::int);
    v_valor := round(r.valor_anual / r.parcelas, 2);
    FOR i IN 1..r.parcelas LOOP
      v_desc := format('%s %s — %s, parcela %s/%s',
        upper(r.tipo), _ano::text,
        (SELECT COALESCE(codigo || ' - ', '') || descricao FROM public.despesas_imoveis WHERE id = _imovel_id),
        i, r.parcelas);

      -- idempotência: descrição única por imóvel/ano/tipo/parcela
      IF NOT EXISTS (
        SELECT 1 FROM public.despesas_lancamentos
        WHERE centro_custo_id = v_centro
          AND tipo = 'a_pagar'
          AND descricao = v_desc
      ) THEN
        INSERT INTO public.despesas_lancamentos(
          tipo, descricao, pessoa_id, centro_custo_id, categoria_id, plano_conta_id,
          data_competencia, data_vencimento, valor_total, status, observacao
        ) VALUES (
          'a_pagar', v_desc, NULL, v_centro, r.categoria_id, r.plano_conta_id,
          make_date(_ano, 1, 1),
          (v_venc + ((i - 1) || ' months')::interval)::date,
          v_valor, 'a_vencer',
          format('Gerado automaticamente do encargo de imóvel (%s)', r.tipo)
        );
        v_ins := v_ins + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_ins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_gerar_encargos_imovel(uuid, int) TO authenticated;

-- ---------------------------------------------------------------------
-- 5) Veículos — documentos + baixa
-- ---------------------------------------------------------------------
-- despesas_veiculos já existe (Fase 1). Adicionamos centro_custo_id para RLS.
ALTER TABLE public.despesas_veiculos
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.despesas_centros_custo(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.despesas_veiculo_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.despesas_veiculos(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('ipva','licenciamento','seguro','multa','manutencao','outro')),
  descricao text,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  vencimento_primeira_parcela date NOT NULL,
  parcelas int NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 24),
  categoria_id uuid REFERENCES public.despesas_categorias(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_veic_doc_veiculo ON public.despesas_veiculo_documentos(veiculo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_veiculo_documentos TO authenticated;
GRANT ALL ON public.despesas_veiculo_documentos TO service_role;

ALTER TABLE public.despesas_veiculo_documentos ENABLE ROW LEVEL SECURITY;

-- Veículos vivem sob aba "cadastros" (é onde são gerenciados na UI).
CREATE POLICY "desp_veic_doc_select" ON public.despesas_veiculo_documentos FOR SELECT TO authenticated
  USING (public.despesas_pode_ver_aba(auth.uid(), 'cadastros'));
CREATE POLICY "desp_veic_doc_insert" ON public.despesas_veiculo_documentos FOR INSERT TO authenticated
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(), 'cadastros'));
CREATE POLICY "desp_veic_doc_update" ON public.despesas_veiculo_documentos FOR UPDATE TO authenticated
  USING (public.despesas_pode_editar_aba(auth.uid(), 'cadastros'))
  WITH CHECK (public.despesas_pode_editar_aba(auth.uid(), 'cadastros'));
CREATE POLICY "desp_veic_doc_delete" ON public.despesas_veiculo_documentos FOR DELETE TO authenticated
  USING (public.despesas_pode_excluir_aba(auth.uid(), 'cadastros'));

-- Função para gerar despesas de veículo no calendário
CREATE OR REPLACE FUNCTION public.despesas_gerar_encargos_veiculo(_veiculo_id uuid, _ano int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  i int;
  v_venc date;
  v_valor numeric(14,2);
  v_desc text;
  v_centro uuid;
  v_ins int := 0;
BEGIN
  SELECT centro_custo_id INTO v_centro FROM public.despesas_veiculos WHERE id = _veiculo_id;
  IF v_centro IS NULL THEN
    RAISE EXCEPTION 'Veículo sem centro de custo definido';
  END IF;

  FOR r IN
    SELECT * FROM public.despesas_veiculo_documentos
    WHERE veiculo_id = _veiculo_id AND ativo = true
  LOOP
    v_venc := make_date(_ano, EXTRACT(MONTH FROM r.vencimento_primeira_parcela)::int, EXTRACT(DAY FROM r.vencimento_primeira_parcela)::int);
    v_valor := round(r.valor / r.parcelas, 2);
    FOR i IN 1..r.parcelas LOOP
      v_desc := format('%s %s — %s, parcela %s/%s',
        upper(r.tipo), _ano::text,
        (SELECT modelo || COALESCE(' (' || placa || ')','') FROM public.despesas_veiculos WHERE id = _veiculo_id),
        i, r.parcelas);

      IF NOT EXISTS (
        SELECT 1 FROM public.despesas_lancamentos
        WHERE centro_custo_id = v_centro
          AND tipo = 'a_pagar'
          AND descricao = v_desc
      ) THEN
        INSERT INTO public.despesas_lancamentos(
          tipo, descricao, centro_custo_id, categoria_id,
          data_competencia, data_vencimento, valor_total, status, observacao
        ) VALUES (
          'a_pagar', v_desc, v_centro, r.categoria_id,
          make_date(_ano, 1, 1),
          (v_venc + ((i - 1) || ' months')::interval)::date,
          v_valor, 'a_vencer',
          format('Gerado automaticamente do documento de veículo (%s)', r.tipo)
        );
        v_ins := v_ins + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_ins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_gerar_encargos_veiculo(uuid, int) TO authenticated;

-- ---------------------------------------------------------------------
-- 6) Repasses (aluguel → proprietário)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas_repasses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES public.despesas_pessoas(id) ON DELETE RESTRICT,
  centro_custo_id uuid NOT NULL REFERENCES public.despesas_centros_custo(id) ON DELETE RESTRICT,
  competencia date NOT NULL, -- sempre dia 1
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','fechado','pago','cancelado')),
  valor_bruto numeric(14,2) NOT NULL DEFAULT 0,
  taxa_administracao_valor numeric(14,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(14,2) NOT NULL DEFAULT 0,
  data_pagamento date,
  lancamento_pagamento_id uuid REFERENCES public.despesas_lancamentos(id) ON DELETE SET NULL,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proprietario_id, competencia, centro_custo_id)
);

CREATE INDEX IF NOT EXISTS idx_desp_rep_comp ON public.despesas_repasses(competencia);
CREATE INDEX IF NOT EXISTS idx_desp_rep_prop ON public.despesas_repasses(proprietario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_repasses TO authenticated;
GRANT ALL ON public.despesas_repasses TO service_role;

ALTER TABLE public.despesas_repasses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_rep_select" ON public.despesas_repasses FOR SELECT TO authenticated
  USING (
    public.despesas_pode_ver_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_rep_insert" ON public.despesas_repasses FOR INSERT TO authenticated
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_rep_update" ON public.despesas_repasses FOR UPDATE TO authenticated
  USING (
    public.despesas_pode_editar_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  )
  WITH CHECK (
    public.despesas_pode_editar_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );
CREATE POLICY "desp_rep_delete" ON public.despesas_repasses FOR DELETE TO authenticated
  USING (
    public.despesas_pode_excluir_aba(auth.uid(), 'repasses')
    AND centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  );

CREATE TABLE IF NOT EXISTS public.despesas_repasse_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repasse_id uuid NOT NULL REFERENCES public.despesas_repasses(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('credito','debito')),
  origem text NOT NULL DEFAULT 'ajuste'
    CHECK (origem IN ('aluguel','reembolso','encargo','taxa_admin','ajuste','outro')),
  imovel_id uuid REFERENCES public.despesas_imoveis(id) ON DELETE SET NULL,
  lancamento_id uuid REFERENCES public.despesas_lancamentos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desp_rep_item_repasse ON public.despesas_repasse_itens(repasse_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_repasse_itens TO authenticated;
GRANT ALL ON public.despesas_repasse_itens TO service_role;

ALTER TABLE public.despesas_repasse_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desp_rep_item_select" ON public.despesas_repasse_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_ver_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
CREATE POLICY "desp_rep_item_insert" ON public.despesas_repasse_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
CREATE POLICY "desp_rep_item_update" ON public.despesas_repasse_itens FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));
CREATE POLICY "desp_rep_item_delete" ON public.despesas_repasse_itens FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.despesas_repasses r
    WHERE r.id = repasse_id
      AND public.despesas_pode_editar_aba(auth.uid(), 'repasses')
      AND r.centro_custo_id IN (SELECT public.despesas_centros_permitidos(auth.uid()))
  ));

-- Recalcular totais do repasse pai a cada mudança em itens
CREATE OR REPLACE FUNCTION public.despesas_repasse_recalcular(_repasse_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creditos numeric(14,2);
  v_debitos numeric(14,2);
  v_taxa numeric(14,2);
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'debito' AND origem <> 'taxa_admin' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN origem = 'taxa_admin' THEN valor ELSE 0 END), 0)
  INTO v_creditos, v_debitos, v_taxa
  FROM public.despesas_repasse_itens
  WHERE repasse_id = _repasse_id;

  UPDATE public.despesas_repasses
     SET valor_bruto = v_creditos,
         taxa_administracao_valor = v_taxa,
         valor_liquido = v_creditos - v_debitos - v_taxa,
         updated_at = now()
   WHERE id = _repasse_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.despesas_repasse_item_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.despesas_repasse_recalcular(OLD.repasse_id);
    RETURN OLD;
  ELSE
    PERFORM public.despesas_repasse_recalcular(NEW.repasse_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_rep_item_recalc ON public.despesas_repasse_itens;
CREATE TRIGGER trg_desp_rep_item_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.despesas_repasse_itens
FOR EACH ROW EXECUTE FUNCTION public.despesas_repasse_item_trg();

-- ---------------------------------------------------------------------
-- 7) Função — montar repasse do mês para um proprietário
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.despesas_montar_repasse(_proprietario_id uuid, _competencia date, _centro_custo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_repasse_id uuid;
  v_ini date;
  v_fim date;
  r record;
BEGIN
  v_ini := date_trunc('month', _competencia)::date;
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;

  -- cria ou pega o repasse
  INSERT INTO public.despesas_repasses(proprietario_id, centro_custo_id, competencia, created_by)
  VALUES (_proprietario_id, _centro_custo_id, v_ini, auth.uid())
  ON CONFLICT (proprietario_id, competencia, centro_custo_id) DO UPDATE
    SET updated_at = now()
  RETURNING id INTO v_repasse_id;

  -- Créditos: aluguéis "a_receber" com pessoa=proprietario (ou imóvel do proprietário) pagos no mês
  FOR r IN
    SELECT l.id, l.descricao, l.valor_pago, i.id AS imovel_id
    FROM public.despesas_lancamentos l
    LEFT JOIN public.despesas_imoveis i ON i.proprietario_id = _proprietario_id
    WHERE l.tipo = 'a_receber'
      AND l.data_vencimento BETWEEN v_ini AND v_fim
      AND l.valor_pago > 0
      AND (l.pessoa_id = _proprietario_id OR l.centro_custo_id = _centro_custo_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.despesas_repasse_itens x
        WHERE x.repasse_id = v_repasse_id AND x.lancamento_id = l.id
      )
  LOOP
    INSERT INTO public.despesas_repasse_itens(
      repasse_id, tipo, origem, imovel_id, lancamento_id, descricao, valor
    ) VALUES (
      v_repasse_id, 'credito', 'aluguel', r.imovel_id, r.id,
      COALESCE(r.descricao, 'Aluguel recebido'), r.valor_pago
    );
  END LOOP;

  -- Débitos: encargos pagos no mês vinculados a imóveis do proprietário
  FOR r IN
    SELECT l.id, l.descricao, l.valor_pago, i.id AS imovel_id
    FROM public.despesas_lancamentos l
    JOIN public.despesas_imoveis i ON i.centro_custo_id = l.centro_custo_id
                                    AND i.proprietario_id = _proprietario_id
    WHERE l.tipo = 'a_pagar'
      AND l.data_vencimento BETWEEN v_ini AND v_fim
      AND l.valor_pago > 0
      AND (l.descricao ILIKE '%IPTU%'
           OR l.descricao ILIKE '%TCR%'
           OR l.descricao ILIKE '%SPU%'
           OR l.descricao ILIKE '%CONDOM%')
      AND NOT EXISTS (
        SELECT 1 FROM public.despesas_repasse_itens x
        WHERE x.repasse_id = v_repasse_id AND x.lancamento_id = l.id
      )
  LOOP
    INSERT INTO public.despesas_repasse_itens(
      repasse_id, tipo, origem, imovel_id, lancamento_id, descricao, valor
    ) VALUES (
      v_repasse_id, 'debito', 'encargo', r.imovel_id, r.id,
      COALESCE(r.descricao, 'Encargo pago'), r.valor_pago
    );
  END LOOP;

  -- Taxa de administração: soma das taxas dos imóveis alugados do proprietário sobre créditos deste mês
  DELETE FROM public.despesas_repasse_itens
   WHERE repasse_id = v_repasse_id AND origem = 'taxa_admin';

  INSERT INTO public.despesas_repasse_itens(repasse_id, tipo, origem, descricao, valor)
  SELECT v_repasse_id, 'debito', 'taxa_admin', 'Taxa de administração',
         COALESCE(SUM(x.valor * COALESCE(i.taxa_administracao_pct, 0) / 100), 0)
  FROM public.despesas_repasse_itens x
  LEFT JOIN public.despesas_imoveis i ON i.id = x.imovel_id
  WHERE x.repasse_id = v_repasse_id AND x.tipo = 'credito';

  PERFORM public.despesas_repasse_recalcular(v_repasse_id);
  RETURN v_repasse_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.despesas_montar_repasse(uuid, date, uuid) TO authenticated;

-- Ao marcar como pago, gera lançamento "a_pagar" ao proprietário no calendário
CREATE OR REPLACE FUNCTION public.despesas_repasse_pago_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desc text;
  v_lanc uuid;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') AND NEW.lancamento_pagamento_id IS NULL AND NEW.valor_liquido > 0 THEN
    v_desc := format('Repasse %s — %s',
      to_char(NEW.competencia, 'MM/YYYY'),
      (SELECT nome FROM public.despesas_pessoas WHERE id = NEW.proprietario_id));
    INSERT INTO public.despesas_lancamentos(
      tipo, descricao, pessoa_id, centro_custo_id,
      data_competencia, data_vencimento, valor_total, status, observacao
    ) VALUES (
      'a_pagar', v_desc, NEW.proprietario_id, NEW.centro_custo_id,
      NEW.competencia, COALESCE(NEW.data_pagamento, current_date),
      NEW.valor_liquido, 'a_vencer',
      format('Gerado automaticamente do repasse %s', NEW.id)
    ) RETURNING id INTO v_lanc;
    NEW.lancamento_pagamento_id := v_lanc;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_rep_pago ON public.despesas_repasses;
CREATE TRIGGER trg_desp_rep_pago
BEFORE UPDATE OF status ON public.despesas_repasses
FOR EACH ROW EXECUTE FUNCTION public.despesas_repasse_pago_trg();

-- ---------------------------------------------------------------------
-- 8) Auditoria: incluir novas tabelas no CASE de audit_module_changes
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_module_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module_name text;
  v_old_data jsonb;
  v_new_data jsonb;
  v_changed_fields text[];
  v_user_id uuid;
  v_user_email text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'brokers', 'locations', 'schedule_assignments', 'generated_schedules',
         'location_period_configs', 'saturday_queue', 'location_rotation_queues' THEN
      v_module_name := 'escalas';
    WHEN 'sales', 'sales_brokers', 'sales_teams', 'broker_evaluations',
         'monthly_leads', 'proposals', 'sale_partners' THEN
      v_module_name := 'vendas';
    WHEN 'estoque_locais_armazenamento', 'estoque_materiais', 'estoque_saldos',
         'estoque_gestores', 'estoque_solicitacoes', 'estoque_solicitacao_itens',
         'estoque_movimentacoes', 'estoque_notificacoes' THEN
      v_module_name := 'estoque';
    WHEN 'despesas_lancamentos', 'despesas_lancamento_pagamentos',
         'despesas_categorias', 'despesas_centros_custo', 'despesas_contas_bancarias',
         'despesas_perfis_acesso', 'despesas_pessoas', 'despesas_planos_conta',
         'despesas_subcategorias', 'despesas_veiculos', 'despesas_veiculo_documentos',
         'despesas_imoveis', 'despesas_imovel_encargos', 'despesas_repasses',
         'despesas_repasse_itens',
         'despesas_aba_permissoes', 'despesas_centros_custo_permissoes' THEN
      v_module_name := 'despesas';
    ELSE
      v_module_name := 'sistema';
  END CASE;

  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NULL THEN
    BEGIN
      v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  v_user_email := COALESCE(v_user_email, 'sistema@interno');

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
    v_changed_fields := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    SELECT ARRAY_AGG(changes.key) INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    ) AS changes;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
  END IF;

  IF TG_OP != 'UPDATE' OR v_changed_fields IS NOT NULL THEN
    INSERT INTO public.module_audit_logs (
      module_name, table_name, record_id, action,
      old_data, new_data, changed_fields,
      changed_by, changed_by_email
    ) VALUES (
      v_module_name, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
      v_old_data, v_new_data, v_changed_fields,
      v_user_id, v_user_email
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- ---------------------------------------------------------------------
-- 9) Triggers updated_at + auditoria nas novas tabelas
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  audit_tables text[] := ARRAY['despesas_imoveis','despesas_imovel_encargos',
                               'despesas_veiculo_documentos','despesas_repasses',
                               'despesas_repasse_itens'];
  updated_tables text[] := ARRAY['despesas_imoveis','despesas_imovel_encargos',
                                 'despesas_veiculo_documentos','despesas_repasses',
                                 'despesas_repasse_itens'];
BEGIN
  FOREACH t IN ARRAY updated_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
      t, t
    );
  END LOOP;

  FOREACH t IN ARRAY audit_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_module_changes()',
      t, t
    );
  END LOOP;
END $$;