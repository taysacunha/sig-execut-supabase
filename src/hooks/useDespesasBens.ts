import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BemCategoria = "equipamento" | "movel" | "informatica" | "outro";
export type BemSituacao =
  | "em_uso" | "em_estoque" | "em_manutencao" | "baixado" | "doado_vendido";

export const BEM_CATEGORIAS: { v: BemCategoria; l: string }[] = [
  { v: "equipamento", l: "Equipamento" },
  { v: "movel", l: "Móvel" },
  { v: "informatica", l: "Informática" },
  { v: "outro", l: "Outro" },
];

export const BEM_SITUACOES: { v: BemSituacao; l: string }[] = [
  { v: "em_uso", l: "Em uso" },
  { v: "em_estoque", l: "Em estoque" },
  { v: "em_manutencao", l: "Em manutenção" },
  { v: "baixado", l: "Baixado" },
  { v: "doado_vendido", l: "Doado / vendido" },
];

export interface Bem {
  id: string;
  codigo: string | null;
  descricao: string;
  categoria: BemCategoria;
  situacao: BemSituacao;
  centro_custo_id: string;
  responsavel_id: string | null;
  fornecedor_id: string | null;
  local: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  quantidade: number;
  data_aquisicao: string | null;
  nota_fiscal: string | null;
  garantia_ate: string | null;
  observacao: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  responsavel?: { nome: string } | null;
  fornecedor?: { nome: string } | null;
  centro_custo?: { nome: string } | null;
  pagamentos?: { valor: number }[];
}

export interface BemPagamento {
  id: string;
  bem_id: string;
  data_compra: string;
  valor: number;
  descricao: string;
  categoria_id: string | null;
  plano_conta_id: string | null;
  lancamento_id: string | null;
  observacao: string | null;
}

export interface BemSituacaoHist {
  id: string;
  bem_id: string;
  situacao_anterior: string | null;
  situacao_nova: string;
  data: string;
  motivo: string | null;
  created_at: string;
}

export const BENS_KEY = "despesas-bens";

export interface BemFiltros {
  situacao?: BemSituacao | "todos";
  categoria?: BemCategoria | "todos";
  centroCustoId?: string;
  responsavelId?: string;
  busca?: string;
}

export function useBens(filtros: BemFiltros = {}) {
  return useQuery({
    queryKey: [BENS_KEY, filtros],
    queryFn: async () => {
      let q = supabase
        .from("despesas_bens" as any)
        .select(
          `*,
           responsavel:despesas_pessoas!despesas_bens_responsavel_id_fkey(nome),
           fornecedor:despesas_pessoas!despesas_bens_fornecedor_id_fkey(nome),
           centro_custo:despesas_centros_custo(nome),
           pagamentos:despesas_bem_pagamentos(valor)`
        )
        .eq("is_active", true)
        .order("descricao");
      if (filtros.situacao && filtros.situacao !== "todos") q = q.eq("situacao", filtros.situacao);
      if (filtros.categoria && filtros.categoria !== "todos") q = q.eq("categoria", filtros.categoria);
      if (filtros.centroCustoId) q = q.eq("centro_custo_id", filtros.centroCustoId);
      if (filtros.responsavelId) q = q.eq("responsavel_id", filtros.responsavelId);
      if (filtros.busca && filtros.busca.trim()) {
        q = q.ilike("descricao", `%${filtros.busca.trim()}%`);
      }
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Bem[];
    },
  });
}

export type BemInput = Omit<
  Bem,
  "id" | "created_at" | "updated_at" | "responsavel" | "fornecedor" | "centro_custo" | "is_active" | "pagamentos"
>;

export function useSaveBem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: BemInput }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      if (id) {
        const { error } = await supabase
          .from("despesas_bens" as any)
          .update(input as any)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("despesas_bens" as any)
        .insert({ ...input, created_by: uid } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [BENS_KEY] }),
  });
}

export function useDeleteBem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_bens" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [BENS_KEY] }),
  });
}

export function useBemPagamentos(bemId: string | null) {
  return useQuery({
    queryKey: [BENS_KEY, "pagamentos", bemId],
    enabled: !!bemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_bem_pagamentos" as any)
        .select("*")
        .eq("bem_id", bemId!)
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BemPagamento[];
    },
  });
}

export function useSaveBemPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BemPagamento> & { bem_id: string }) => {
      const { id, ...rest } = input as any;
      if (id) {
        const { error } = await supabase
          .from("despesas_bem_pagamentos" as any)
          .update(rest)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas_bem_pagamentos" as any)
          .insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [BENS_KEY, "pagamentos", v.bem_id] });
      qc.invalidateQueries({ queryKey: [BENS_KEY] });
    },
  });
}

export function useDeleteBemPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, bem_id }: { id: string; bem_id: string }) => {
      const { error } = await supabase
        .from("despesas_bem_pagamentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return bem_id;
    },
    onSuccess: (bem_id) => {
      qc.invalidateQueries({ queryKey: [BENS_KEY, "pagamentos", bem_id] });
      qc.invalidateQueries({ queryKey: [BENS_KEY] });
    },
  });
}

export function useBemHistorico(bemId: string | null) {
  return useQuery({
    queryKey: [BENS_KEY, "historico", bemId],
    enabled: !!bemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_bem_situacao_historico" as any)
        .select("*")
        .eq("bem_id", bemId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BemSituacaoHist[];
    },
  });
}

/** Gera um único lançamento no calendário na data da compra (idempotente). */
export function useGerarLancamentoBem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pagamentoId }: { pagamentoId: string; bemId: string }) => {
      const { data, error } = await supabase.rpc(
        "despesas_gerar_lancamento_bem" as any,
        { _pagamento_id: pagamentoId } as any
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [BENS_KEY, "pagamentos", v.bemId] });
      qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] });
    },
  });
}