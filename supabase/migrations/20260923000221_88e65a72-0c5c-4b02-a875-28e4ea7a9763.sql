CREATE OR REPLACE FUNCTION public.despesas_detectar_duplicidades(
  _valor numeric,
  _data_venc date,
  _centro_custo_id uuid,
  _pessoa_id uuid DEFAULT NULL,
  _plano_conta_id uuid DEFAULT NULL,
  _conta_bancaria_id uuid DEFAULT NULL,
  _ignorar_id uuid DEFAULT NULL,
  _janela_dias integer DEFAULT 3
)
RETURNS TABLE(
  id uuid,
  descricao text,
  valor_total numeric,
  data_vencimento date,
  status text,
  pessoa_nome text,
  centro_nome text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.id, l.descricao, l.valor_total, l.data_vencimento, l.status,
         p.nome AS pessoa_nome, c.nome AS centro_nome
  FROM public.despesas_lancamentos l
  LEFT JOIN public.despesas_pessoas p ON p.id = l.pessoa_id
  LEFT JOIN public.despesas_centros_custo c ON c.id = l.centro_custo_id
  WHERE l.status <> 'cancelado'
    AND l.centro_custo_id = _centro_custo_id
    AND abs(coalesce(l.valor_total, 0) - coalesce(_valor, 0)) < 0.01
    AND l.data_vencimento BETWEEN (_data_venc - _janela_dias) AND (_data_venc + _janela_dias)
    AND (_ignorar_id IS NULL OR l.id <> _ignorar_id)
    AND (_pessoa_id IS NULL OR l.pessoa_id IS NULL OR l.pessoa_id = _pessoa_id)
    AND (_plano_conta_id IS NULL OR l.plano_conta_id IS NULL OR l.plano_conta_id = _plano_conta_id)
    AND (_conta_bancaria_id IS NULL OR l.conta_bancaria_id IS NULL OR l.conta_bancaria_id = _conta_bancaria_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.despesas_duplicidades_revisoes r
      WHERE _ignorar_id IS NOT NULL
        AND r.lancamento_a_id = LEAST(l.id, _ignorar_id)
        AND r.lancamento_b_id = GREATEST(l.id, _ignorar_id)
    )
  ORDER BY l.data_vencimento, l.descricao;
$$;