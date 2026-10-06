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

export const VEICULOS_KEY = "despesas-veiculos-full-v2";

export function useVeiculos() {
  return useQuery({
    queryKey: [VEICULOS_KEY],
    queryFn: async () => {
      const veiculosRes = await supabase.rpc("despesas_veiculos_lookup" as any);
      if (veiculosRes.error) throw veiculosRes.error;

      return ((veiculosRes.data ?? []) as unknown as Array<Veiculo & {
        motorista_nome: string | null;
        proprietario_nome: string | null;
        centro_custo_nome: string | null;
      }>).map(({ motorista_nome, proprietario_nome, centro_custo_nome, ...veiculo }) => ({
        ...veiculo,
        motorista: motorista_nome ? { nome: motorista_nome } : null,
        proprietario: proprietario_nome ? { nome: proprietario_nome } : null,
        centro_custo: centro_custo_nome ? { nome: centro_custo_nome } : null,
      }));
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
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "docs", v.veiculo_id] });
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "docs-ativos"] });
    },
  });
}

/** Documentos ativos de todos os veículos, agrupados por veiculo_id. */
export function useVeiculosDocumentosAtivos() {
  return useQuery({
    queryKey: [VEICULOS_KEY, "docs-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_veiculo_documentos" as any)
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      const map: Record<string, VeiculoDocumento[]> = {};
      for (const d of (data ?? []) as unknown as VeiculoDocumento[]) {
        (map[d.veiculo_id] ??= []).push(d);
      }
      return map;
    },
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
    onSuccess: (veiculo_id) => {
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "docs", veiculo_id] });
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "docs-ativos"] });
    },
  });
}

export interface EncargoPrevisto {
  tipo: string;
  ciclo: number;
  parcela: number;
  total: number;
  vencimento: string;
}
export interface ResultadoGeracao {
  criados: number;
  itens: EncargoPrevisto[];
  avisos: { tipo: string; motivo: string }[];
}

async function chamarGeracao(veiculoId: string, simular: boolean) {
  const { data, error } = await supabase.rpc(
    "despesas_gerar_encargos_veiculo_ciclo" as any,
    { _veiculo_id: veiculoId, _simular: simular } as any,
  );
  if (error) throw error;
  return data as unknown as ResultadoGeracao;
}

/** Prévia do próximo ciclo de cada documento (não grava nada). */
export function usePreviaEncargosVeiculo(veiculoId: string | null) {
  return useQuery({
    queryKey: [VEICULOS_KEY, "previa", veiculoId],
    enabled: !!veiculoId,
    staleTime: 0,
    queryFn: () => chamarGeracao(veiculoId!, true),
  });
}

/** Gera o próximo ciclo ainda não lançado de cada documento ativo. */
export function useGerarEncargosVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ veiculoId }: { veiculoId: string }) => chamarGeracao(veiculoId, false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] });
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "previa"] });
    },
  });
}

export function useBaixarEncargoVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data, obs }: { id: string; data: string; obs: string }) => {
      const { error } = await supabase.rpc("despesas_baixar_encargo_veiculo" as any, {
        _id: id, _data: data, _obs: obs || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] }),
  });
}

export function useExcluirEncargoVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, modo, justificativa }: { id: string; modo: "esta" | "seguintes"; justificativa: string }) => {
      const { data, error } = await supabase.rpc("despesas_excluir_encargo_veiculo" as any, {
        _id: id, _modo: modo, _justificativa: justificativa,
      } as any);
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] });
      qc.invalidateQueries({ queryKey: [VEICULOS_KEY, "previa"] });
    },
  });
}