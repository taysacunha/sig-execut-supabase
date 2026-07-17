import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RepasseStatus = "aberto" | "fechado" | "pago" | "cancelado";
export type RepasseItemTipo = "credito" | "debito";
export type RepasseItemOrigem =
  | "aluguel"
  | "reembolso"
  | "encargo"
  | "taxa_admin"
  | "ajuste"
  | "outro";

export interface RepasseItem {
  id: string;
  repasse_id: string;
  tipo: RepasseItemTipo;
  origem: RepasseItemOrigem;
  imovel_id: string | null;
  lancamento_id: string | null;
  descricao: string;
  valor: number;
}

export interface Repasse {
  id: string;
  proprietario_id: string;
  centro_custo_id: string;
  competencia: string;
  status: RepasseStatus;
  valor_bruto: number;
  taxa_administracao_valor: number;
  valor_liquido: number;
  data_pagamento: string | null;
  lancamento_pagamento_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  proprietario?: { nome: string; cpf_cnpj: string | null } | null;
  centro_custo?: { nome: string } | null;
  itens?: RepasseItem[];
}

export const REPASSES_KEY = "despesas-repasses";

export interface RepasseFiltros {
  competencia?: string; // yyyy-mm-01
  centroCustoId?: string;
  status?: RepasseStatus | "todos";
  proprietarioId?: string;
}

export function useRepasses(filtros: RepasseFiltros = {}) {
  return useQuery({
    queryKey: [REPASSES_KEY, filtros],
    queryFn: async () => {
      let q = supabase
        .from("despesas_repasses" as any)
        .select(
          `*,
           proprietario:despesas_pessoas(nome, cpf_cnpj),
           centro_custo:despesas_centros_custo(nome),
           itens:despesas_repasse_itens(*)`
        )
        .order("competencia", { ascending: false });

      if (filtros.competencia) q = q.eq("competencia", filtros.competencia);
      if (filtros.centroCustoId) q = q.eq("centro_custo_id", filtros.centroCustoId);
      if (filtros.status && filtros.status !== "todos") q = q.eq("status", filtros.status);
      if (filtros.proprietarioId) q = q.eq("proprietario_id", filtros.proprietarioId);

      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Repasse[];
    },
  });
}

export function useMontarRepasse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      proprietarioId,
      competencia,
      centroCustoId,
    }: {
      proprietarioId: string;
      competencia: string;
      centroCustoId: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "despesas_montar_repasse" as any,
        {
          _proprietario_id: proprietarioId,
          _competencia: competencia,
          _centro_custo_id: centroCustoId,
        } as any
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [REPASSES_KEY] }),
  });
}

export function useUpdateRepasseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      data_pagamento,
    }: {
      id: string;
      status: RepasseStatus;
      data_pagamento?: string;
    }) => {
      const payload: any = { status };
      if (data_pagamento) payload.data_pagamento = data_pagamento;
      const { error } = await supabase
        .from("despesas_repasses" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] });
    },
  });
}

export function useDeleteRepasse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_repasses" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [REPASSES_KEY] }),
  });
}

export function useSaveRepasseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RepasseItem> & { repasse_id: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("despesas_repasse_itens" as any)
          .update(input as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas_repasse_itens" as any)
          .insert(input as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [REPASSES_KEY] }),
  });
}

export function useDeleteRepasseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_repasse_itens" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [REPASSES_KEY] }),
  });
}