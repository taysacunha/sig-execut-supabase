import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DuplicidadeRevisao {
  id: string;
  lancamento_a_id: string;
  lancamento_b_id: string;
  justificativa: string;
  created_by: string;
  created_at: string;
}

const KEY = ["despesas-duplicidades-revisoes"];

export const chaveParDuplicidade = (a: string, b: string) => [a, b].sort().join(":");

export function useDuplicidadesRevisoes() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_duplicidades_revisoes" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as DuplicidadeRevisao[];
    },
  });
}

export function useMarcarNaoDuplicidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ a, b, justificativa }: { a: string; b: string; justificativa: string }) => {
      const [lancamento_a_id, lancamento_b_id] = [a, b].sort();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");
      const { error } = await supabase.from("despesas_duplicidades_revisoes" as any).insert({
        lancamento_a_id,
        lancamento_b_id,
        justificativa: justificativa.trim(),
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}