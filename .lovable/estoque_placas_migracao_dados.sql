-- =============================================
-- MIGRAÇÃO DE DADOS: materiais-placa antigos -> estoque_placas
-- Execute uma única vez no SQL Editor do Supabase.
--
-- Converte os 5 materiais-placa existentes (com seus saldos) em
-- registros individuais em estoque_placas (sem código, status disponivel).
-- O código será atribuído na entrada/saída em /estoque/placas.
--
-- IDEMPOTÊNCIA: a CTE "ja_migrado" impede duplicação se rodar 2x.
-- =============================================

BEGIN;

-- 1) Garante 1 material-âncora único marcado como is_placa.
--    Estratégia: pega o primeiro is_placa=true existente; se nenhum, cria "Placa".
DO $$
DECLARE
  v_ancora uuid;
BEGIN
  SELECT id INTO v_ancora
  FROM public.estoque_materiais
  WHERE is_placa = true
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_ancora IS NULL THEN
    INSERT INTO public.estoque_materiais (nome, is_placa, is_active)
    VALUES ('Placa', true, true)
    RETURNING id INTO v_ancora;
  END IF;

  -- Desmarca is_placa de qualquer outro material para evitar ambiguidade.
  UPDATE public.estoque_materiais
  SET is_placa = false
  WHERE id <> v_ancora AND is_placa = true;

  -- Guarda em GUC para os próximos passos
  PERFORM set_config('app.placa_ancora_id', v_ancora::text, true);
END $$;

-- 2) Cria placas em estoque_placas para cada unidade de saldo
--    dos materiais-placa antigos (exceto o âncora).
WITH ancora AS (
  SELECT current_setting('app.placa_ancora_id')::uuid AS id
),
antigos AS (
  SELECT m.id, m.nome
  FROM public.estoque_materiais m, ancora a
  WHERE m.id <> a.id
    AND (m.is_placa = true OR m.nome ILIKE 'placa%')
),
saldos_antigos AS (
  SELECT s.material_id, s.local_armazenamento_id, s.quantidade, a.nome AS nome_antigo
  FROM public.estoque_saldos s
  JOIN antigos a ON a.id = s.material_id
  WHERE s.quantidade > 0
),
expandido AS (
  SELECT
    sa.material_id AS antigo_id,
    sa.nome_antigo,
    sa.local_armazenamento_id,
    generate_series(1, sa.quantidade) AS n
  FROM saldos_antigos sa
),
ja_migrado AS (
  SELECT 1
  FROM public.estoque_placas p
  WHERE p.observacoes LIKE 'Migrado de %'
  LIMIT 1
)
INSERT INTO public.estoque_placas (
  codigo, material_id, tipo_uso, tamanho, tamanho_outro,
  local_armazenamento_id, status, observacoes
)
SELECT
  NULL,
  (SELECT id FROM ancora),
  CASE WHEN e.nome_antigo ILIKE '%aluga%' THEN 'aluga' ELSE 'venda' END,
  CASE
    WHEN e.nome_antigo ILIKE '%1x1%' OR e.nome_antigo ILIKE '%1 x 1%' THEN '1x1'
    WHEN e.nome_antigo ILIKE '%2x2%' OR e.nome_antigo ILIKE '%2 x 2%' THEN '2x2'
    ELSE 'outro'
  END,
  CASE
    WHEN e.nome_antigo ILIKE '%1x1%' OR e.nome_antigo ILIKE '%1 x 1%' THEN NULL
    WHEN e.nome_antigo ILIKE '%2x2%' OR e.nome_antigo ILIKE '%2 x 2%' THEN NULL
    ELSE COALESCE(
      NULLIF(regexp_replace(e.nome_antigo, '^.*?([0-9]+[.,]?[0-9]*\s*[xX]\s*[0-9]+[.,]?[0-9]*).*$', '\1'), e.nome_antigo),
      'não especificado'
    )
  END,
  e.local_armazenamento_id,
  'disponivel',
  'Migrado de ' || e.nome_antigo
FROM expandido e
WHERE NOT EXISTS (SELECT 1 FROM ja_migrado);

-- 3) Histórico de criação para cada placa migrada
INSERT INTO public.estoque_placas_historico (placa_id, tipo, data_evento, observacoes)
SELECT p.id, 'criacao', CURRENT_DATE, p.observacoes
FROM public.estoque_placas p
WHERE p.observacoes LIKE 'Migrado de %'
  AND NOT EXISTS (
    SELECT 1 FROM public.estoque_placas_historico h
    WHERE h.placa_id = p.id AND h.tipo = 'criacao'
  );

-- 4) Remove saldos antigos dos materiais que não são o âncora.
--    O trigger recalcular_saldo_placas recompõe o saldo do âncora automaticamente.
DELETE FROM public.estoque_saldos s
USING public.estoque_materiais m
WHERE s.material_id = m.id
  AND m.id <> current_setting('app.placa_ancora_id')::uuid
  AND (m.is_placa = true OR m.nome ILIKE 'placa%');

-- 5) Desativa os materiais-placa antigos (preserva histórico).
UPDATE public.estoque_materiais
SET is_active = false, is_placa = false
WHERE id <> current_setting('app.placa_ancora_id')::uuid
  AND nome ILIKE 'placa%';

-- 6) Renomeia o âncora para um nome neutro (opcional, descomente se desejar)
-- UPDATE public.estoque_materiais
-- SET nome = 'Placa'
-- WHERE id = current_setting('app.placa_ancora_id')::uuid;

-- 7) Força recálculo de saldos do âncora para todos os locais que têm placas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT material_id, local_armazenamento_id
    FROM public.estoque_placas
    WHERE local_armazenamento_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_saldo_placas(r.material_id, r.local_armazenamento_id);
  END LOOP;
END $$;

COMMIT;

-- Verificação:
-- SELECT count(*) FROM public.estoque_placas;  -- esperado: 43
-- SELECT m.nome, s.quantidade, l.nome
--   FROM estoque_saldos s
--   JOIN estoque_materiais m ON m.id = s.material_id
--   JOIN estoque_locais_armazenamento l ON l.id = s.local_armazenamento_id
--   WHERE m.is_placa = true;