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

export interface RepasseBenefPagamento {
  id: string;
  beneficiario_id: string;
  data: string;
  valor: number;
  imovel_id: string | null;
  observacao: string | null;
}

export interface RepasseBeneficiario {
  id: string;
  repasse_id: string;
  pessoa_id: string;
  valor: number;
  valor_limite: number | null;
  data_recebimento: string | null;
  is_residual: boolean;
  is_proprietario?: boolean;
  ordem: number;
  observacao: string | null;
  pessoa?: { nome: string; tipo_pessoa: "fisica" | "juridica"; cpf_cnpj: string | null } | null;
  pagamentos?: RepasseBenefPagamento[];
}

export interface Repasse {
  id: string;
  conta_id: string | null;
  proprietario_id: string;
  centro_custo_id: string;
  competencia: string;
  status: RepasseStatus;
  valor_bruto: number;
  taxa_administracao_valor: number;
  valor_liquido: number;
  valor_limite_primeiro: number | null;
  data_pagamento: string | null;
  lancamento_pagamento_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  proprietario?: { nome: string; cpf_cnpj: string | null } | null;
  centro_custo?: { nome: string } | null;
  itens?: RepasseItem[];
  beneficiarios?: RepasseBeneficiario[];
}

export const REPASSES_KEY = "despesas-repasses";
export const CONTAS_KEY = "despesas-repasse-contas";

export interface RepasseConta {
  id: string;
  proprietario_id: string;
  centro_custo_id: string;
  observacao: string | null;
  proprietario?: { nome: string; cpf_cnpj: string | null } | null;
  centro_custo?: { nome: string } | null;
  competencias: Repasse[];
}

export interface ContaFiltros {
  centroCustoId?: string;
  proprietarioId?: string;
  status?: RepasseStatus | "todos";
  competencia?: string;
}

export function useRepasseContas(filtros: ContaFiltros = {}) {
  return useQuery({
    queryKey: [CONTAS_KEY, filtros],
    queryFn: async () => {
      let q = supabase
        .from("despesas_repasse_contas" as any)
        .select(
          `id, proprietario_id, centro_custo_id, observacao,
           proprietario:despesas_pessoas(nome, cpf_cnpj),
           centro_custo:despesas_centros_custo(nome),
           competencias:despesas_repasses(
             *,
             itens:despesas_repasse_itens(*),
             beneficiarios:despesas_repasse_beneficiarios(
               *, pessoa:despesas_pessoas(nome, tipo_pessoa, cpf_cnpj),
               pagamentos:despesas_repasse_benef_pagamentos(*)
             )
           )`
        );

      if (filtros.centroCustoId) q = q.eq("centro_custo_id", filtros.centroCustoId);
      if (filtros.proprietarioId) q = q.eq("proprietario_id", filtros.proprietarioId);

      const { data, error } = await q.limit(1000);
      if (error) throw error;

      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        competencias: ((c.competencias ?? []) as Repasse[])
          .slice()
          .sort((a, b) => (a.competencia < b.competencia ? 1 : -1)),
      })) as RepasseConta[];
    },
  });
}

export function useCriarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      proprietarioId, centroCustoId,
    }: { proprietarioId: string; centroCustoId: string }) => {
      const { data, error } = await supabase.rpc("despesas_repasse_criar_conta" as any, {
        _proprietario_id: proprietarioId,
        _centro_custo_id: centroCustoId,
      } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTAS_KEY] }),
  });
}

export function useAddCompetencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contaId, competencia }: { contaId: string; competencia: string }) => {
      const { data, error } = await supabase.rpc("despesas_repasse_add_competencia" as any, {
        _conta_id: contaId,
        _competencia: competencia,
      } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
    },
  });
}

export function useDeleteConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_repasse_contas" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTAS_KEY] }),
  });
}

export interface LimiteAnual {
  id: string;
  conta_id: string;
  pessoa_id: string;
  ano: number;
  valor_limite: number;
  competencia_origem: string | null;
  definido_por: string | null;
  definido_por_nome: string | null;
  definido_em: string | null;
}

export function useLimitesAnuais(contaId: string | null, ano: number) {
  return useQuery({
    queryKey: [CONTAS_KEY, "limites-anuais", contaId, ano],
    enabled: !!contaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_repasse_benef_limite_anual" as any)
        .select("*")
        .eq("conta_id", contaId!)
        .eq("ano", ano);
      if (error) throw error;
      return (data ?? []) as unknown as LimiteAnual[];
    },
  });
}

export function useSaveLimiteAnual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conta_id: string; pessoa_id: string; ano: number; valor_limite: number | null;
      competencia_origem?: string | null;
    }) => {
      if (input.valor_limite === null) {
        const { error } = await supabase
          .from("despesas_repasse_benef_limite_anual" as any)
          .delete()
          .eq("conta_id", input.conta_id)
          .eq("pessoa_id", input.pessoa_id)
          .eq("ano", input.ano);
        if (error) throw error;
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      let nome: string | null = auth?.user?.email ?? null;
      if (userId) {
        const { data: perfil } = await supabase
          .from("user_profiles")
          .select("name")
          .eq("user_id", userId)
          .maybeSingle();
        nome = (perfil as any)?.name ?? nome;
      }
      const { error } = await supabase
        .from("despesas_repasse_benef_limite_anual" as any)
        .upsert({
          conta_id: input.conta_id,
          pessoa_id: input.pessoa_id,
          ano: input.ano,
          valor_limite: input.valor_limite,
          competencia_origem: input.competencia_origem ?? null,
          definido_por: userId,
          definido_por_nome: nome,
          definido_em: new Date().toISOString(),
        } as any, { onConflict: "conta_id,pessoa_id,ano" } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTAS_KEY] }),
  });
}

/** Marca um beneficiário como residual ("recebe a sobra"), desmarcando os demais. */
export function useSetBeneficiarioResidual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ repasseId, beneficiarioId }: { repasseId: string; beneficiarioId: string | null }) => {
      let q = supabase
        .from("despesas_repasse_beneficiarios" as any)
        .update({ is_residual: false } as any)
        .eq("repasse_id", repasseId);
      if (beneficiarioId) q = q.neq("id", beneficiarioId);
      const { error: e1 } = await q;
      if (e1) throw e1;
      if (!beneficiarioId) return;
      const { error: e2 } = await supabase
        .from("despesas_repasse_beneficiarios" as any)
        .update({ is_residual: true } as any)
        .eq("id", beneficiarioId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
    },
  });
}

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
           itens:despesas_repasse_itens(*),
           beneficiarios:despesas_repasse_beneficiarios(
             *, pessoa:despesas_pessoas(nome, tipo_pessoa, cpf_cnpj),
             pagamentos:despesas_repasse_benef_pagamentos(*)
           )`
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
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
      data_pagamento?: string | null;
    }) => {
      const payload: any = { status };
      if (data_pagamento !== undefined) payload.data_pagamento = data_pagamento;
      const { error } = await supabase
        .from("despesas_repasses" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
  });
}

export function useUpdateRepasseCampos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, campos,
    }: { id: string; campos: Partial<Pick<Repasse, "valor_limite_primeiro" | "observacao">> }) => {
      const { error } = await supabase
        .from("despesas_repasses" as any)
        .update(campos as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
  });
}

export function useSaveRepasseItem() {
  const qc = useQueryClient();
  const traduz = (error: any) => {
    const msg = String(error?.message ?? "");
    if (error?.code === "23505" || /duplicate key|unique/i.test(msg)) {
      return new Error(
        "Já existe um item com o mesmo tipo, origem e imóvel nesta competência. Edite o item existente.",
      );
    }
    return error;
  };
  return useMutation({
    mutationFn: async (input: Partial<RepasseItem> & { repasse_id: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("despesas_repasse_itens" as any)
          .update(input as any)
          .eq("id", input.id);
        if (error) throw traduz(error);
      } else {
        const { error } = await supabase
          .from("despesas_repasse_itens" as any)
          .insert(input as any);
        if (error) throw traduz(error);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
  });
}

export function useSaveRepasseBeneficiario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<RepasseBeneficiario> & { repasse_id: string; pessoa_id: string; valor: number },
    ) => {
      if (input.id) {
        const { error } = await supabase
          .from("despesas_repasse_beneficiarios" as any)
          .update(input as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas_repasse_beneficiarios" as any)
          .insert(input as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
  });
}

export function useDeleteRepasseBeneficiario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_repasse_beneficiarios" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
  });
}

export interface RepasseInquilinoRow {
  imovel_id: string;
  imovel_codigo: string | null;
  imovel_descricao: string;
  endereco: string | null;
  inquilino: { id: string; nome: string; tipo_pessoa: "fisica" | "juridica"; cpf_cnpj: string | null } | null;
}

function traduzPagamento(error: any) {
  const msg = String(error?.message ?? "");
  if (error?.code === "23505" || /duplicate key|unique/i.test(msg)) {
    return new Error(
      "Já existe um repasse para este beneficiário nesta data e imóvel. Edite o repasse existente ou use outra data.",
    );
  }
  return error;
}

export function useSaveBenefPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<RepasseBenefPagamento> & { beneficiario_id: string; data: string; valor: number },
    ) => {
      if (input.id) {
        const { error } = await supabase
          .from("despesas_repasse_benef_pagamentos" as any)
          .update(input as any)
          .eq("id", input.id);
        if (error) throw traduzPagamento(error);
      } else {
        const { error } = await supabase
          .from("despesas_repasse_benef_pagamentos" as any)
          .insert(input as any);
        if (error) throw traduzPagamento(error);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
  });
}

export function useDeleteBenefPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_repasse_benef_pagamentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REPASSES_KEY] });
      qc.invalidateQueries({ queryKey: [CONTAS_KEY] });
    },
  });
}

export function useRepasseInquilinos(proprietarioId: string | null) {
  return useQuery({
    queryKey: [REPASSES_KEY, "inquilinos", proprietarioId],
    enabled: !!proprietarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_imoveis" as any)
        .select(
          `id, codigo, descricao, endereco,
           inquilino:despesas_pessoas!despesas_imoveis_inquilino_id_fkey(
             id, nome, tipo_pessoa, cpf_cnpj
           )`,
        )
        .eq("proprietario_id", proprietarioId!)
        .eq("is_active", true)
        .order("descricao");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        imovel_id: r.id,
        imovel_codigo: r.codigo,
        imovel_descricao: r.descricao,
        endereco: r.endereco,
        inquilino: r.inquilino ?? null,
      })) as RepasseInquilinoRow[];
    },
  });
}