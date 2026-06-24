import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fromEstoque = (t: string) => supabase.from(t as any);

export type PlacaStatus = "disponivel" | "instalada" | "roubada" | "perdida" | "baixada";
export type TipoUso = "venda" | "aluga";
export type Tamanho = "1x1" | "2x2" | "outro";

export interface MaterialPlaca {
  id: string;
  nome: string;
  categoria_id: string | null;
  categoria: string | null;
  unidade_medida: string;
  estoque_minimo: number;
  is_placa: boolean;
  is_active: boolean;
}

export interface Placa {
  id: string;
  codigo: string | null;
  material_id: string;
  categoria_id: string | null;
  tipo_uso: TipoUso;
  tamanho: Tamanho;
  tamanho_outro: string | null;
  local_armazenamento_id: string | null;
  status: PlacaStatus;
  imovel_codigo_atual: string | null;
  data_instalacao_atual: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlacaHistorico {
  id: string;
  placa_id: string;
  tipo: "criacao" | "reposicao" | "instalacao" | "retirada" | "roubo" | "perda" | "baixa";
  imovel_codigo: string | null;
  data_evento: string;
  data_retorno: string | null;
  observacoes: string | null;
  user_id: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<PlacaStatus, string> = {
  disponivel: "Disponível",
  instalada: "Instalada",
  roubada: "Roubada",
  perdida: "Perdida",
  baixada: "Baixada",
};

export const STATUS_COLORS: Record<PlacaStatus, string> = {
  disponivel: "bg-green-500/20 text-green-400 border-green-500/30",
  instalada: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  roubada: "bg-red-500/20 text-red-400 border-red-500/30",
  perdida: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  baixada: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export const TIPO_USO_LABELS: Record<TipoUso, string> = {
  venda: "Venda",
  aluga: "Aluga",
};

export const TAMANHO_LABELS: Record<Tamanho, string> = {
  "1x1": "1x1m",
  "2x2": "2x2m",
  outro: "Outro",
};

export const HIST_LABELS: Record<PlacaHistorico["tipo"], string> = {
  criacao: "Criação",
  reposicao: "Reposição",
  instalacao: "Instalação",
  retirada: "Retirada",
  roubo: "Roubo",
  perda: "Perda",
  baixa: "Baixa",
};

export function inferPlacaAttributes(nome: string): {
  tipo_uso: TipoUso;
  tamanho: Tamanho;
  tamanho_outro: string | null;
} {
  const normalized = nome.toLowerCase();
  const tipo_uso: TipoUso = normalized.includes("aluga") ? "aluga" : "venda";

  const compact = normalized.replace(/\s+/g, "");
  if (compact.includes("1x1")) {
    return { tipo_uso, tamanho: "1x1", tamanho_outro: null };
  }
  if (compact.includes("2x2")) {
    return { tipo_uso, tamanho: "2x2", tamanho_outro: null };
  }

  const medida = nome.match(/([0-9]+(?:[,.][0-9]+)?\s*[xX]\s*[0-9]+(?:[,.][0-9]+)?)/)?.[1]?.trim() || null;
  return { tipo_uso, tamanho: "outro", tamanho_outro: medida };
}

export function formatPlacaTamanho(tamanho: Tamanho, tamanhoOutro?: string | null) {
  return tamanho === "outro" ? `Outro (${tamanhoOutro || "não especificado"})` : TAMANHO_LABELS[tamanho];
}

export function usePlacas() {
  return useQuery({
    queryKey: ["estoque-placas"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_placas")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return (data as unknown as Placa[]) || [];
    },
  });
}

export function useHistoricoPlaca(placaId: string | null) {
  return useQuery({
    queryKey: ["estoque-placa-historico", placaId],
    queryFn: async () => {
      if (!placaId) return [];
      const { data, error } = await fromEstoque("estoque_placas_historico")
        .select("*")
        .eq("placa_id", placaId)
        .order("data_evento", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as PlacaHistorico[]) || [];
    },
    enabled: !!placaId,
  });
}
