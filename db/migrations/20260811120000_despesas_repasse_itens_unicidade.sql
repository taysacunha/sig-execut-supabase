-- Repasses: impedir itens duplicados na mesma competência
-- Regra: dentro de um repasse (competência) não pode haver mais de um item
-- com a mesma combinação tipo + origem + imóvel (para itens manuais).
-- Itens gerados a partir de lançamentos são únicos por lançamento.

BEGIN;

-- 1) Consolidar duplicidades existentes (soma os valores no item mais antigo)
WITH dups AS (
  SELECT
    id,
    valor,
    first_value(id) OVER w AS keep_id,
    row_number() OVER w AS rn
  FROM public.despesas_repasse_itens
  WHERE lancamento_id IS NULL
  WINDOW w AS (
    PARTITION BY repasse_id, tipo, origem,
                 COALESCE(imovel_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY created_at NULLS FIRST, id
  )
),
somas AS (
  SELECT keep_id, SUM(valor) AS total
  FROM dups
  GROUP BY keep_id
  HAVING COUNT(*) > 1
)
UPDATE public.despesas_repasse_itens i
   SET valor = s.total
  FROM somas s
 WHERE i.id = s.keep_id;

DELETE FROM public.despesas_repasse_itens i
USING (
  SELECT id, row_number() OVER (
           PARTITION BY repasse_id, tipo, origem,
                        COALESCE(imovel_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY created_at NULLS FIRST, id
         ) AS rn
    FROM public.despesas_repasse_itens
   WHERE lancamento_id IS NULL
) d
WHERE i.id = d.id AND d.rn > 1;

-- Duplicidades por lançamento
DELETE FROM public.despesas_repasse_itens i
USING (
  SELECT id, row_number() OVER (
           PARTITION BY repasse_id, lancamento_id
           ORDER BY created_at NULLS FIRST, id
         ) AS rn
    FROM public.despesas_repasse_itens
   WHERE lancamento_id IS NOT NULL
) d
WHERE i.id = d.id AND d.rn > 1;

-- 2) Índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_rep_item_manual
  ON public.despesas_repasse_itens (
    repasse_id, tipo, origem,
    COALESCE(imovel_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE lancamento_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_desp_rep_item_lancamento
  ON public.despesas_repasse_itens (repasse_id, lancamento_id)
  WHERE lancamento_id IS NOT NULL;

-- 3) Mensagem amigável
CREATE OR REPLACE FUNCTION public.despesas_repasse_item_unico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lancamento_id IS NULL AND EXISTS (
    SELECT 1 FROM public.despesas_repasse_itens x
     WHERE x.repasse_id = NEW.repasse_id
       AND x.tipo = NEW.tipo
       AND x.origem = NEW.origem
       AND COALESCE(x.imovel_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(NEW.imovel_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND (TG_OP = 'INSERT' OR x.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Já existe um item de % / % para este imóvel nesta competência.',
      CASE WHEN NEW.tipo = 'credito' THEN 'Crédito' ELSE 'Débito' END, NEW.origem
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desp_repasse_item_unico ON public.despesas_repasse_itens;
CREATE TRIGGER trg_desp_repasse_item_unico
BEFORE INSERT OR UPDATE OF tipo, origem, imovel_id
ON public.despesas_repasse_itens
FOR EACH ROW EXECUTE FUNCTION public.despesas_repasse_item_unico();

COMMIT;
