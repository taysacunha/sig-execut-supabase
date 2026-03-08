import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSystemAccess } from "@/hooks/useSystemAccess";

const fromEstoque = (table: string) => supabase.from(table as any);

interface Notificacao {
  id: string;
  user_id: string;
  tipo: string;
  referencia_id: string | null;
  referencia_tipo: string | null;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

export function useEstoqueNotificacoes() {
  const { user } = useSystemAccess();
  const queryClient = useQueryClient();

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ["estoque-notificacoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await fromEstoque("estoque_notificacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Notificacao[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Poll every 30s
  });

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromEstoque("estoque_notificacoes")
        .update({ lida: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["estoque-notificacoes"] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await fromEstoque("estoque_notificacoes")
        .update({ lida: true } as any)
        .eq("user_id", user.id)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["estoque-notificacoes"] }),
  });

  return { notificacoes, unreadCount, isLoading, markAsRead, markAllAsRead };
}

// Helper to create a notification for a user
export async function criarNotificacao(params: {
  user_id: string;
  tipo: string;
  mensagem: string;
  referencia_id?: string;
  referencia_tipo?: string;
}) {
  await fromEstoque("estoque_notificacoes").insert({
    user_id: params.user_id,
    tipo: params.tipo,
    mensagem: params.mensagem,
    referencia_id: params.referencia_id || null,
    referencia_tipo: params.referencia_tipo || null,
  } as any);
}

// Notify all managers of a unit about a new request
export async function notificarGestoresUnidade(unidadeId: string, mensagem: string, referenciaId?: string) {
  const { data: gestores } = await fromEstoque("estoque_gestores")
    .select("user_id")
    .eq("unidade_id", unidadeId);
  if (!gestores?.length) return;

  const notificacoes = (gestores as unknown as { user_id: string }[]).map((g) => ({
    user_id: g.user_id,
    tipo: "nova_solicitacao",
    mensagem,
    referencia_id: referenciaId || null,
    referencia_tipo: "solicitacao",
  }));

  await fromEstoque("estoque_notificacoes").insert(notificacoes as any);
}
