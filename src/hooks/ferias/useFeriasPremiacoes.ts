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
  ultima_exportacao_pdf: string | null;
  recebimento_confirmado: boolean;
  recebimento_confirmado_em: string | null;
  recebimento_confirmado_por: string | null;
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

export function useSetExportacaoPremiacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: string }) => {
      const { error } = await (supabase as any)
        .from("ferias_premiacoes")
        .update({ ultima_exportacao_pdf: data })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-premiacoes"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar emissão"),
  });
}

export function useSetRecebimentoPremiacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirmado, data }: { id: string; confirmado: boolean; data?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = confirmado
        ? { recebimento_confirmado: true, recebimento_confirmado_em: data, recebimento_confirmado_por: user?.id }
        : { recebimento_confirmado: false, recebimento_confirmado_em: null, recebimento_confirmado_por: null };
      const { error } = await (supabase as any)
        .from("ferias_premiacoes")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ferias-premiacoes"] });
      toast.success(vars.confirmado ? "Recebimento atestado" : "Atesto removido");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar atesto"),
  });
}
