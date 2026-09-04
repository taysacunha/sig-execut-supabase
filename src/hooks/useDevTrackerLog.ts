import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DevLogEntry {
  id: string;
  occurred_on: string;
  system_name: string;
  title: string;
  description: string | null;
  change_type: string;
  hours: number;
  source?: string | null;
  legacy_key?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type DevLogInput = Omit<
  DevLogEntry,
  "id" | "created_at" | "updated_at" | "source" | "legacy_key"
>;


export const DEV_CHANGE_TYPES = [
  { value: "novo", label: "Novo" },
  { value: "correcao", label: "Correção" },
  { value: "atualizacao", label: "Atualização" },
  { value: "ajuste", label: "Ajuste" },
];

const QUERY_KEY = ["dev_tracker_log"];

export function useDevTrackerLog(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled,
    queryFn: async (): Promise<DevLogEntry[]> => {
      const { data, error } = await supabase
        .from("dev_tracker_log" as any)
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createEntry = useMutation({
    mutationFn: async (input: DevLogInput) => {
      const { error } = await supabase.from("dev_tracker_log" as any).insert(input as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...input }: DevLogInput & { id: string }) => {
      const { error } = await supabase
        .from("dev_tracker_log" as any)
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dev_tracker_log" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    entries: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
