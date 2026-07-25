import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ImovelSituacao = "alugado" | "vago" | "vendido" | "proprio_uso" | "em_aquisicao";
export type ImovelTipo = "comercial" | "residencial" | "terreno" | "outro";
export type EncargoTipo = "iptu" | "tcr" | "spu" | "condominio" | "outro";

export interface Imovel {
  id: string;
  codigo: string | null;
  descricao: string;
  tipo: ImovelTipo;
  situacao: ImovelSituacao;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  matricula: string | null;
  inscricao_municipal: string | null;
  area_total: number | null;
  proprietario_id: string | null;
  inquilino_id: string | null;
  centro_custo_id: string;
  valor_aluguel: number | null;
  taxa_administracao_pct: number | null;
  data_aquisicao: string | null;
  data_venda: string | null;
  observacao: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  proprietario?: { nome: string } | null;
  inquilino?: { nome: string } | null;
  centro_custo?: { nome: string } | null;
}

export interface ImovelEncargo {
  id: string;
  imovel_id: string;
  tipo: EncargoTipo;
  descricao: string | null;
  valor_anual: number;
  parcelas: number;
  vencimento_primeira_parcela: string;
  categoria_id: string | null;
  plano_conta_id: string | null;
  ativo: boolean;
  observacao: string | null;
}

export interface ImovelSituacaoHist {
  id: string;
  imovel_id: string;
  situacao_anterior: string | null;
  situacao_nova: string;
  data: string;
  motivo: string | null;
  created_at: string;
}

export const IMOVEIS_KEY = "despesas-imoveis";

export interface ImovelFiltros {
  situacao?: ImovelSituacao | "todos";
  tipo?: ImovelTipo | "todos";
  centroCustoId?: string;
  proprietarioId?: string;
  busca?: string;
}

export function useImoveis(filtros: ImovelFiltros = {}) {
  return useQuery({
    queryKey: [IMOVEIS_KEY, filtros],
    queryFn: async () => {
      let q = supabase
        .from("despesas_imoveis" as any)
        .select(
          `*,
           proprietario:despesas_pessoas!despesas_imoveis_proprietario_id_fkey(nome),
           inquilino:despesas_pessoas!despesas_imoveis_inquilino_id_fkey(nome),
           centro_custo:despesas_centros_custo(nome)`
        )
        .eq("is_active", true)
        .order("descricao");
      if (filtros.situacao && filtros.situacao !== "todos") q = q.eq("situacao", filtros.situacao);
      if (filtros.tipo && filtros.tipo !== "todos") q = q.eq("tipo", filtros.tipo);
      if (filtros.centroCustoId) q = q.eq("centro_custo_id", filtros.centroCustoId);
      if (filtros.proprietarioId) q = q.eq("proprietario_id", filtros.proprietarioId);
      if (filtros.busca && filtros.busca.trim()) {
        q = q.ilike("descricao", `%${filtros.busca.trim()}%`);
      }
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Imovel[];
    },
  });
}

export type ImovelInput = Omit<
  Imovel,
  "id" | "created_at" | "updated_at" | "proprietario" | "inquilino" | "centro_custo" | "is_active"
>;

export function useSaveImovel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      justificativaDuplicidade,
    }: {
      id?: string;
      input: ImovelInput;
      justificativaDuplicidade?: { motivo: string; duplicados: DuplicadoImovel[] };
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const email = userData.user?.email ?? "sistema@interno";
      if (id) {
        const { error } = await supabase
          .from("despesas_imoveis" as any)
          .update(input as any)
          .eq("id", id);
        if (error) throw error;
        if (justificativaDuplicidade) {
          await supabase.from("module_audit_logs").insert({
            module_name: "despesas",
            table_name: "despesas_imoveis",
            record_id: id,
            action: "DUPLICIDADE_IMOVEL_CONFIRMADA",
            old_data: null,
            new_data: {
              codigo: input.codigo,
              inscricao_municipal: input.inscricao_municipal,
              duplicados: justificativaDuplicidade.duplicados,
              justificativa: justificativaDuplicidade.motivo,
            },
            changed_by: uid,
            changed_by_email: email,
          } as any);
        }
        return id;
      }
      const { data, error } = await supabase
        .from("despesas_imoveis" as any)
        .insert({ ...input, created_by: uid } as any)
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as any).id as string;
      if (justificativaDuplicidade) {
        await supabase.from("module_audit_logs").insert({
          module_name: "despesas",
          table_name: "despesas_imoveis",
          record_id: newId,
          action: "DUPLICIDADE_IMOVEL_CONFIRMADA",
          old_data: null,
          new_data: {
            codigo: input.codigo,
            inscricao_municipal: input.inscricao_municipal,
            duplicados: justificativaDuplicidade.duplicados,
            justificativa: justificativaDuplicidade.motivo,
          },
          changed_by: uid,
          changed_by_email: email,
        } as any);
      }
      return newId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [IMOVEIS_KEY] }),
  });
}

export interface DuplicadoImovel {
  id: string;
  codigo: string | null;
  descricao: string;
  inscricao_municipal: string | null;
  situacao: string;
  is_active: boolean;
  campo: "codigo" | "inscricao_municipal";
}

export async function buscarImoveisDuplicados(params: {
  codigo?: string | null;
  inscricaoMunicipal?: string | null;
  excluirId?: string;
}): Promise<DuplicadoImovel[]> {
  const codigo = params.codigo?.trim() || null;
  const insc = params.inscricaoMunicipal?.trim() || null;
  if (!codigo && !insc) return [];

  const ors: string[] = [];
  if (codigo) ors.push(`codigo.ilike.${codigo}`);
  if (insc) ors.push(`inscricao_municipal.ilike.${insc}`);

  let q = supabase
    .from("despesas_imoveis" as any)
    .select("id,codigo,descricao,inscricao_municipal,situacao,is_active")
    .or(ors.join(","))
    .order("is_active", { ascending: false })
    .order("descricao");
  if (params.excluirId) q = q.neq("id", params.excluirId);

  const { data, error } = await q.limit(50);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const result: DuplicadoImovel[] = [];
  for (const r of rows) {
    const matchCodigo =
      codigo && r.codigo && String(r.codigo).toLowerCase() === codigo.toLowerCase();
    const matchInsc =
      insc &&
      r.inscricao_municipal &&
      String(r.inscricao_municipal).toLowerCase() === insc.toLowerCase();
    if (matchCodigo) {
      result.push({ ...r, campo: "codigo" });
    }
    if (matchInsc) {
      result.push({ ...r, campo: "inscricao_municipal" });
    }
  }
  return result;
}

export function useDeleteImovel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_imoveis" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [IMOVEIS_KEY] }),
  });
}

export function useImovelEncargos(imovelId: string | null) {
  return useQuery({
    queryKey: [IMOVEIS_KEY, "encargos", imovelId],
    enabled: !!imovelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_imovel_encargos" as any)
        .select("*")
        .eq("imovel_id", imovelId!)
        .order("tipo");
      if (error) throw error;
      return (data ?? []) as unknown as ImovelEncargo[];
    },
  });
}

export function useSaveEncargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ImovelEncargo> & { imovel_id: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("despesas_imovel_encargos" as any)
          .update(input as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas_imovel_encargos" as any)
          .insert(input as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: [IMOVEIS_KEY, "encargos", v.imovel_id] }),
  });
}

export function useDeleteEncargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, imovel_id }: { id: string; imovel_id: string }) => {
      const { error } = await supabase
        .from("despesas_imovel_encargos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return imovel_id;
    },
    onSuccess: (imovel_id) =>
      qc.invalidateQueries({ queryKey: [IMOVEIS_KEY, "encargos", imovel_id] }),
  });
}

export function useImovelHistorico(imovelId: string | null) {
  return useQuery({
    queryKey: [IMOVEIS_KEY, "historico", imovelId],
    enabled: !!imovelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_imovel_situacao_historico" as any)
        .select("*")
        .eq("imovel_id", imovelId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ImovelSituacaoHist[];
    },
  });
}

export function useGerarEncargosImovel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ imovelId, ano }: { imovelId: string; ano: number }) => {
      const { data, error } = await supabase.rpc(
        "despesas_gerar_encargos_imovel" as any,
        { _imovel_id: imovelId, _ano: ano } as any
      );
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["despesas-lancamentos"] }),
  });
}