import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoLinha = "celular" | "fixo";
export type SituacaoLinha = "ativa" | "inativa" | "cancelada";

export interface LinhaTelefonica {
  id: string;
  tipo: TipoLinha;
  numero: string;
  operadora_id: string;
  empresa_contratada: string | null;
  empresa_pessoa_id: string | null;
  unidade_id: string;
  setor_id: string | null;
  responsavel_id: string | null;
  valor_contratado: number | null;
  tipo_valor: "individual" | "global" | null;
  capacidade_internet: string | null;
  modelo_aparelho: string | null;
  observacoes: string | null;
  centro_custo_id: string | null;
  situacao: SituacaoLinha;
}

export interface LinhasLookup {
  unidades: { id: string; nome: string }[];
  setores: { id: string; nome: string; unidade_id: string | null }[];
  colaboradores: { id: string; nome: string; setor_id: string | null }[];
  operadoras: { id: string; nome: string; is_active: boolean }[];
  centros: { id: string; nome: string }[];
  empresas: { id: string; nome: string; cpf_cnpj: string | null }[];
}

const KEY = ["despesas-linhas"];

export function useLinhas() {
  return useQuery({
    queryKey: KEY,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_linhas_telefonicas" as any)
        .select("*")
        .order("numero");
      if (error) throw error;
      return (data ?? []) as unknown as LinhaTelefonica[];
    },
  });
}

export function useLinhasLookup() {
  return useQuery({
    queryKey: ["despesas-linhas-lookup"],
    staleTime: 0,
    queryFn: async (): Promise<LinhasLookup> => {
      const [l, o, c] = await Promise.all([
        supabase.rpc("despesas_linhas_lookup" as any),
        supabase.from("despesas_operadoras" as any).select("id, nome, is_active").order("nome"),
        supabase.rpc("despesas_centros_lookup" as any),
      ]);
      if (l.error) throw l.error;
      const base = (l.data ?? {}) as any;
      return {
        unidades: base.unidades ?? [],
        setores: base.setores ?? [],
        colaboradores: base.colaboradores ?? [],
        operadoras: ((o.data ?? []) as any[]),
        centros: ((c.data ?? []) as any[]),
        empresas: base.empresas ?? [],
      };
    },
  });
}

export function useSaveLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: Partial<LinhaTelefonica> & { id?: string }) => {
      const { id, ...payload } = l;
      const q = id
        ? supabase.from("despesas_linhas_telefonicas" as any).update(payload).eq("id", id)
        : supabase.from("despesas_linhas_telefonicas" as any).insert(payload);
      const { error } = await q;
      if (error) {
        if (/ux_desp_linhas_numero|duplicate/i.test(error.message))
          throw new Error(`Já existe uma linha cadastrada com o número ${l.numero ?? ""}.`.replace(" .", "."));
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSituacaoLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, situacao }: { id: string; situacao: SituacaoLinha }) => {
      const { data, error } = await supabase.from("despesas_linhas_telefonicas" as any).update({ situacao }).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para alterar esta linha.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas_linhas_telefonicas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Formata número brasileiro: (83) 99999-9999 ou (83) 3333-3333. */
export function formatarTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
