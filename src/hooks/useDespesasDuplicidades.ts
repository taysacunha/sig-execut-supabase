import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DuplicidadeMatch {
  id: string;
  descricao: string;
  valor_total: number;
  data_vencimento: string;
  status: string;
  pessoa_nome: string | null;
  centro_nome: string | null;
}

export interface DuplicidadeArgs {
  valor: number;
  data_vencimento: string;
  centro_custo_id: string;
  pessoa_id?: string | null;
  plano_conta_id?: string | null;
  conta_bancaria_id?: string | null;
  ignorar_id?: string | null;
  enabled?: boolean;
}

export function useDuplicidades(a: DuplicidadeArgs) {
  const enabled =
    (a.enabled ?? true) &&
    !!a.centro_custo_id &&
    !!a.data_vencimento &&
    a.valor > 0;

  return useQuery({
    queryKey: [
      "desp-duplicidades",
      a.valor,
      a.data_vencimento,
      a.centro_custo_id,
      a.pessoa_id,
      a.plano_conta_id,
      a.conta_bancaria_id,
      a.ignorar_id,
    ],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "despesas_detectar_duplicidades" as any,
        {
          _valor: a.valor,
          _data_venc: a.data_vencimento,
          _centro_custo_id: a.centro_custo_id,
          _pessoa_id: a.pessoa_id ?? null,
          _plano_conta_id: a.plano_conta_id ?? null,
          _conta_bancaria_id: a.conta_bancaria_id ?? null,
          _ignorar_id: a.ignorar_id ?? null,
          _janela_dias: 3,
        }
      );
      if (error) throw error;
      return (data ?? []) as unknown as DuplicidadeMatch[];
    },
    staleTime: 30_000,
  });
}