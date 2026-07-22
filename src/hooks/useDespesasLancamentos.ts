import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LancamentoTipo = "a_pagar" | "a_receber";
export type LancamentoStatus =
  | "a_vencer"
  | "vencido"
  | "pago_parcial"
  | "pago"
  | "cancelado"
  | "quitado"
  | "gimob";

export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "boleto"
  | "cartao"
  | "transferencia"
  | "cheque"
  | "outro";

export type DespesaReferenciaTipo = "pasta" | "venda" | "imovel" | "pessoa";

export interface Pagamento {
  id: string;
  lancamento_id: string;
  data_pagamento: string;
  valor: number;
  forma_pagamento: FormaPagamento;
  conta_bancaria_id: string | null;
  observacao: string | null;
  created_at: string;
}

export interface Lancamento {
  id: string;
  tipo: LancamentoTipo;
  descricao: string;
  documento_numero: string | null;
  pessoa_id: string | null;
  imovel_id: string | null;
  referencia_tipo: DespesaReferenciaTipo | null;
  referencia_numero: string | null;
  referencia_numero_pasta: string | null;
  referencia_numero_venda: string | null;
  centro_custo_id: string;
  categoria_id: string | null;
  plano_conta_id: string | null;
  subcategoria_id: string | null;
  conta_bancaria_id: string | null;
  data_competencia: string;
  data_vencimento: string;
  valor_total: number | null;
  valor_pago: number;
  status: LancamentoStatus;
  observacao: string | null;
  serie_recorrencia_id: string | null;
  is_manual: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  pessoa?: { nome: string } | null;
  imovel?: { codigo: string | null; endereco: string | null } | null;
  centro_custo?: { nome: string } | null;
  categoria?: { nome: string } | null;
  pagamentos?: Pagamento[];
}

export interface LancamentoFiltros {
  tipo?: LancamentoTipo | "todos";
  status?: LancamentoStatus | "todos";
  centroCustoId?: string;
  pessoaId?: string;
  categoriaId?: string;
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
  serieId?: string;
}

export const LANC_KEY = "despesas-lancamentos";

export function useLancamentos(filtros: LancamentoFiltros) {
  return useQuery({
    queryKey: [LANC_KEY, filtros],
    queryFn: async () => {
      let query = supabase
        .from("despesas_lancamentos" as any)
        .select(
          `*,
           pessoa:despesas_pessoas(nome),
           imovel:despesas_imoveis(codigo, endereco),
           centro_custo:despesas_centros_custo(nome),
           categoria:despesas_categorias(nome),
           pagamentos:despesas_lancamento_pagamentos(*)`
        )
        .order("data_vencimento", { ascending: true });

      if (filtros.tipo && filtros.tipo !== "todos") query = query.eq("tipo", filtros.tipo);
      if (filtros.status && filtros.status !== "todos") query = query.eq("status", filtros.status);
      if (filtros.centroCustoId) query = query.eq("centro_custo_id", filtros.centroCustoId);
      if (filtros.pessoaId) query = query.eq("pessoa_id", filtros.pessoaId);
      if (filtros.categoriaId) query = query.eq("categoria_id", filtros.categoriaId);
      if (filtros.dataInicio) query = query.gte("data_vencimento", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data_vencimento", filtros.dataFim);
      if (filtros.serieId) query = query.eq("serie_recorrencia_id", filtros.serieId);
      if (filtros.busca && filtros.busca.trim()) {
        query = query.ilike("descricao", `%${filtros.busca.trim()}%`);
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Lancamento[];
    },
  });
}

export interface LancamentoInput {
  tipo: LancamentoTipo;
  descricao: string;
  documento_numero?: string | null;
  pessoa_id?: string | null;
  imovel_id?: string | null;
  referencia_tipo?: DespesaReferenciaTipo | null;
  referencia_numero?: string | null;
  referencia_numero_pasta?: string | null;
  referencia_numero_venda?: string | null;
  centro_custo_id: string;
  categoria_id?: string | null;
  plano_conta_id?: string | null;
  subcategoria_id?: string | null;
  conta_bancaria_id?: string | null;
  data_competencia: string;
  data_vencimento: string;
  valor_total: number | null;
  observacao?: string | null;
}

export function useSaveLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: LancamentoInput }) => {
      if (id) {
        const { error } = await supabase
          .from("despesas_lancamentos" as any)
          .update(input as any)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: userRes } = await supabase.auth.getUser();
      const payload: any = { ...input, created_by: userRes.user?.id };
      const { data, error } = await supabase
        .from("despesas_lancamentos" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LANC_KEY] }),
  });
}

export function useDeleteLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas_lancamentos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LANC_KEY] }),
  });
}

export function useCancelLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_lancamentos" as any)
        .update({ status: "cancelado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LANC_KEY] }),
  });
}

export function useSetLancamentoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LancamentoStatus }) => {
      const { error } = await supabase
        .from("despesas_lancamentos" as any)
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LANC_KEY] }),
  });
}

export interface PagamentoInput {
  lancamento_id: string;
  data_pagamento: string;
  valor: number;
  forma_pagamento: FormaPagamento;
  conta_bancaria_id?: string | null;
  observacao?: string | null;
}

export function useAddPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PagamentoInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("despesas_lancamento_pagamentos" as any)
        .insert({ ...input, created_by: userRes.user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LANC_KEY] }),
  });
}

export function useDeletePagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_lancamento_pagamentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LANC_KEY] }),
  });
}

/**
 * Credenciais sensíveis (login/senha/contato) armazenadas em tabela
 * separada com RLS restrita a editores/admin do módulo despesas.
 */
export type LancamentoCredenciais = Record<string, string>;

export function useLancamentoCredenciais(lancamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ["despesas-lanc-cred", lancamentoId],
    enabled: !!lancamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_lancamentos_credenciais" as any)
        .select("credenciais")
        .eq("lancamento_id", lancamentoId!)
        .maybeSingle();
      // 42501 = insufficient privilege → usuário sem permissão; devolve null.
      if (error && (error as any).code !== "PGRST116" && (error as any).code !== "42501") {
        // Sem acesso: tratar como ausente em vez de propagar.
        if ((error as any).code === "PGRST301") return null;
      }
      return ((data as any)?.credenciais ?? null) as LancamentoCredenciais | null;
    },
  });
}

export function useSaveLancamentoCredenciais() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lancamentoId,
      credenciais,
    }: {
      lancamentoId: string;
      credenciais: LancamentoCredenciais;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const hasData = Object.keys(credenciais ?? {}).length > 0;
      if (!hasData) {
        const { error } = await supabase
          .from("despesas_lancamentos_credenciais" as any)
          .delete()
          .eq("lancamento_id", lancamentoId);
        if (error && (error as any).code !== "PGRST116") throw error;
        return;
      }
      const { error } = await supabase
        .from("despesas_lancamentos_credenciais" as any)
        .upsert(
          {
            lancamento_id: lancamentoId,
            credenciais,
            updated_by: userRes.user?.id ?? null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "lancamento_id" },
        );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["despesas-lanc-cred", vars.lancamentoId] });
    },
  });
}

/** Lookup helpers para dropdowns do formulário. */
export function useDespesasLookups() {
  const centros = useQuery({
    queryKey: ["desp-lookup", "centros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_centros_custo" as any)
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string }[];
    },
  });
  const categorias = useQuery({
    queryKey: ["desp-lookup", "categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_categorias" as any)
        .select("id, nome, tipo")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string; tipo: string }[];
    },
  });
  const planos = useQuery({
    queryKey: ["desp-lookup", "planos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_planos_conta" as any)
        .select("id, nome, tipo")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string; tipo: string }[];
    },
  });
  const subcategorias = useQuery({
    queryKey: ["desp-lookup", "subcategorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_subcategorias" as any)
        .select("id, nome, plano_conta_id")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string; plano_conta_id: string }[];
    },
  });
  const contas = useQuery({
    queryKey: ["desp-lookup", "contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_contas_bancarias" as any)
        .select("id, nome, banco")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string; banco: string | null }[];
    },
  });
  const pessoas = useQuery({
    queryKey: ["desp-lookup", "pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_pessoas" as any)
        .select("id, nome, tipo_pessoa")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string; tipo_pessoa: string }[];
    },
  });
  const imoveis = useQuery({
    queryKey: ["desp-lookup", "imoveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_imoveis" as any)
        .select("id, codigo, descricao, endereco")
        .eq("is_active", true)
        .order("descricao");
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string; codigo: string | null; descricao: string; endereco: string | null;
      }[];
    },
  });

  return { centros, categorias, planos, subcategorias, contas, pessoas, imoveis };
}