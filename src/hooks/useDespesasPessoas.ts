import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PapelPessoa =
  | "proprietario"
  | "inquilino"
  | "empresa"
  | "fornecedor"
  | "cliente"
  | "funcionario"
  | "motorista"
  | "corretor"
  | "prestador_servico"
  | "beneficiario"
  | "outro";

export const PAPEIS_PESSOA: { v: PapelPessoa; l: string }[] = [
  { v: "proprietario", l: "Proprietário" },
  { v: "inquilino", l: "Inquilino" },
  { v: "empresa", l: "Empresa" },
  { v: "fornecedor", l: "Fornecedor" },
  { v: "cliente", l: "Cliente" },
  { v: "funcionario", l: "Funcionário" },
  { v: "motorista", l: "Motorista" },
  { v: "corretor", l: "Corretor" },
  { v: "prestador_servico", l: "Prestador de Serviço" },
  { v: "beneficiario", l: "Beneficiário" },
  { v: "outro", l: "Outro" },
];

export const labelPapel = (p: PapelPessoa | string) =>
  PAPEIS_PESSOA.find((x) => x.v === p)?.l ?? p;

export interface Pessoa {
  id: string;
  nome: string;
  tipo_pessoa: "fisica" | "juridica";
  cpf_cnpj: string | null;
  oab: string | null;
  creci: string | null;
  papeis: PapelPessoa[];
  email: string | null;
  telefone: string | null;
  observacao: string | null;
  papel_outro_descricao: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PessoaInput = Omit<Pessoa, "id" | "created_at" | "updated_at" | "is_active">;

export const PESSOAS_KEY = "despesas-pessoas";

export interface PessoaFiltros {
  papel?: PapelPessoa;
  busca?: string;
  apenasAtivas?: boolean;
}

export function usePessoas(filtros: PessoaFiltros = {}) {
  const { papel, busca, apenasAtivas = true } = filtros;
  return useQuery({
    queryKey: [PESSOAS_KEY, { papel, busca, apenasAtivas }],
    queryFn: async () => {
      let q = supabase
        .from("despesas_pessoas" as any)
        .select("*")
        .order("nome");
      if (apenasAtivas) q = q.eq("is_active", true);
      if (papel) q = q.contains("papeis", [papel]);
      if (busca && busca.trim()) {
        const t = busca.trim();
        q = q.or(`nome.ilike.%${t}%,cpf_cnpj.ilike.%${t}%`);
      }
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Pessoa[];
    },
  });
}

export function useSavePessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PessoaInput }) => {
      const payload: any = {
        ...input,
        cpf_cnpj: input.cpf_cnpj?.replace(/\D/g, "") || null,
        papel_outro_descricao: input.papeis.includes("outro")
          ? (input.papel_outro_descricao?.trim() || null)
          : null,
      };
      if (id) {
        const { error } = await supabase
          .from("despesas_pessoas" as any)
          .update(payload)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("despesas_pessoas" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PESSOAS_KEY] });
      qc.invalidateQueries({ queryKey: ["desp-lookup", "pessoas"] });
    },
  });
}

export function useDeletePessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("despesas_pessoas" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PESSOAS_KEY] });
      qc.invalidateQueries({ queryKey: ["desp-lookup", "pessoas"] });
    },
  });
}