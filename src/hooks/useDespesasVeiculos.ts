import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VeiculoDocTipo = "ipva" | "licenciamento" | "seguro" | "multa" | "manutencao" | "outro";

export interface Veiculo {
  id: string;
  modelo: string;
  placa: string | null;
  motorista_id: string | null;
  proprietario_id: string | null;
  comprador_id: string | null;
  nota_fiscal: string | null;
  observacao: string | null;
  centro_custo_id: string | null;
  data_aquisicao: string | null;
  data_venda: string | null;
  is_active: boolean;
  motorista?: { nome: string } | null;
  proprietario?: { nome: string } | null;
  centro_custo?: { nome: string } | null;
}

export interface VeiculoDocumento {
  id: string;
  veiculo_id: string;
  tipo: VeiculoDocTipo;
  descricao: string | null;
  valor: number;
  vencimento_primeira_parcela: string;
  parcelas: number;
  categoria_id: string | null;
  ativo: boolean;
  observacao: string | null;
}

export const VEICULOS_KEY = "despesas-veiculos-full";

export function useVeiculos() {
  return useQuery({
    queryKey: [VEICULOS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_veiculos" as any)
        .select(
          `*,
           motorista:despesas_pessoas!despesas_veiculos_motorista_id_fkey(nome),
           proprietario:despesas_pessoas!despesas_veiculos_proprietario_id_fkey(nome),
           centro_custo:despesas_centros_custo(nome)`
        )
        .eq("is_active", true)
        .order("modelo");
      if (error) throw error;
      return (data ?? []) as unknown as Veiculo[];
    },
  });
}

export type VeiculoInput = Omit<
  Veiculo,
  "id" | "is_active" | "motorista" | "proprietario" | "centro_custo"
>;

export function useSaveVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: VeiculoInput }) => {
      if (id) {
        const { error } = await supabase
          .from("despesas_veiculos" as any)
          .update(input as any)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("despesas_veiculos" as any)
        .insert(input as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [VEICULOS_KEY] }),
  });
}

export function useDeleteVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_veiculos" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [VEICULOS_KEY] }),
  });
}

export function useVeiculoDocumentos(veiculoId: string | null) {
  return useQuery({
    queryKey: [VEICULOS_KEY, "docs", veiculoId],
    enabled: !!veiculoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_veiculo_documentos" as any)
        .select("*")
        .eq("veiculo_id", veiculoId!)
        .order("tipo");
      if (error) throw error;
      return (data ?? []) as unknown as VeiculoDocumento[];
    },
  });
}

export function useSaveVeiculoDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<VeiculoDocumento> & { veiculo_id: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("despesas_veiculo_documentos" as any)
          .update(input as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas_veiculo_documentos" as any)
          .insert(input as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "docs", v.veiculo_id] }),
  });
}

export function useDeleteVeiculoDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, veiculo_id }: { id: string; veiculo_id: string }) => {
      const { error } = await supabase
        .from("despesas_veiculo_documentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return veiculo_id;
    },
    onSuccess: (veiculo_id) =>
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "docs", veiculo_id] }),
  });
}

export function useGerarEncargosVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ veiculoId, ano }: { veiculoId: string; ano: number }) => {
      const { data, error } = await supabase.rpc(
        "despesas_gerar_encargos_veiculo" as any,
        { _veiculo_id: veiculoId, _ano: ano } as any
      );
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] }),
  });
}