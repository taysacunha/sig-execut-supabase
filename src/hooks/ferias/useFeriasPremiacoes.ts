import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FeriasPremiacao {
  id: string;
  ferias_id: string;
  periodo: 1 | 2;
  data_inicio: string;
  data_fim: string;
  dias_gozados: 0 | 5 | 10 | 15;
  dias_vendidos: 0 | 5 | 10 | 15;
  valor_premiacao: number;
  data_recebimento: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export function useFeriasPremiacoes(feriasIds: string[]) {
  return useQuery({
    queryKey: ["ferias-premiacoes", feriasIds.slice().sort().join(",")],
    enabled: feriasIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ferias_premiacoes")
        .select("*")
        .in("ferias_id", feriasIds)
        .order("periodo", { ascending: true });
      if (error) throw error;
      const map: Record<string, FeriasPremiacao[]> = {};
      for (const r of (data || []) as FeriasPremiacao[]) {
        (map[r.ferias_id] ||= []).push(r);
      }
      return map;
    },
  });
}

export function useUpsertPremiacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FeriasPremiacao> & { ferias_id: string; periodo: 1 | 2 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const row: any = { ...payload };
      if (!row.id) row.created_by = user?.id;
      row.updated_by = user?.id;
      const { data, error } = await (supabase as any)
        .from("ferias_premiacoes")
        .upsert(row, { onConflict: "ferias_id,periodo" })
        .select()
        .single();
      if (error) throw error;
      return data as FeriasPremiacao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-premiacoes"] });
      toast.success("Premiação salva");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar premiação"),
  });
}

export function useDeletePremiacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("ferias_premiacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-premiacoes"] });
      toast.success("Premiação removida");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover premiação"),
  });
}
