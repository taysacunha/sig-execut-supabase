import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RecorrenciaTipo = "mensal" | "anual" | "fixa_meses" | "intercalada";

export interface Recorrencia {
  id: string;
  ativo: boolean;
  tipo: RecorrenciaTipo;
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;
  meses_fixos: number[];
  janela_geracao_meses: number;
  ultima_geracao_ate: string | null;
  lanc_tipo: "a_pagar" | "a_receber";
  descricao: string;
  valor_total: number;
  centro_custo_id: string;
  categoria_id: string | null;
  plano_conta_id: string | null;
  subcategoria_id: string | null;
  conta_bancaria_id: string | null;
  pessoa_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  centro_custo?: { nome: string } | null;
  pessoa?: { nome: string } | null;
}

export type RecorrenciaInput = Omit<
  Recorrencia,
  "id" | "created_at" | "updated_at" | "ultima_geracao_ate" | "centro_custo" | "pessoa"
>;

export const REC_KEY = "despesas-recorrencias";

export function useRecorrencias() {
  return useQuery({
    queryKey: [REC_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_recorrencias" as any)
        .select(
          "*, centro_custo:despesas_centros_custo(nome), pessoa:despesas_pessoas(nome)"
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Recorrencia[];
    },
  });
}

export function useSaveRecorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: RecorrenciaInput }) => {
      if (id) {
        const { error } = await supabase
          .from("despesas_recorrencias" as any)
          .update(input as any)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: userRes } = await supabase.auth.getUser();
      const payload: any = { ...input, created_by: userRes.user?.id };
      const { data, error } = await supabase
        .from("despesas_recorrencias" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REC_KEY] });
      qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] });
    },
  });
}

export function useDeleteRecorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_recorrencias" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [REC_KEY] }),
  });
}

export function useGerarOcorrencias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ate }: { id: string; ate?: string }) => {
      const { data, error } = await supabase.rpc("despesas_gerar_ocorrencias" as any, {
        _serie: id,
        _ate: ate ?? null,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REC_KEY] });
      qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] });
    },
  });
}