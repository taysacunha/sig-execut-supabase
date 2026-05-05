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

// Verifica saldo de um material em um local; se ≤ estoque_minimo (e mínimo > 0),
// dispara notificação "estoque_baixo" para todos os gestores da unidade.
export async function verificarEstoqueBaixo(material_id: string, local_armazenamento_id: string) {
  try {
    const { data: mat } = await fromEstoque("estoque_materiais")
      .select("nome, estoque_minimo")
      .eq("id", material_id)
      .maybeSingle();
    const minimo = (mat as any)?.estoque_minimo || 0;
    if (!mat || minimo <= 0) return;

    const { data: saldo } = await fromEstoque("estoque_saldos")
      .select("quantidade")
      .eq("material_id", material_id)
      .eq("local_armazenamento_id", local_armazenamento_id)
      .maybeSingle();
    const qtd = (saldo as any)?.quantidade ?? 0;
    if (qtd > minimo) return;

    const { data: local } = await fromEstoque("estoque_locais_armazenamento")
      .select("nome, unidade_id")
      .eq("id", local_armazenamento_id)
      .maybeSingle();
    const unidade_id = (local as any)?.unidade_id;
    if (!unidade_id) return;

    const { data: gestores } = await fromEstoque("estoque_gestores")
      .select("user_id")
      .eq("unidade_id", unidade_id);
    if (!gestores?.length) return;

    const mensagem = qtd === 0
      ? `Estoque ZERADO: ${(mat as any).nome} em ${(local as any)?.nome || "local"}`
      : `Estoque baixo: ${(mat as any).nome} (${qtd} restantes, mínimo ${minimo})`;

    const notificacoes = (gestores as unknown as { user_id: string }[]).map((g) => ({
      user_id: g.user_id,
      tipo: "estoque_baixo",
      mensagem,
      referencia_id: material_id,
      referencia_tipo: "material",
    }));
    await fromEstoque("estoque_notificacoes").insert(notificacoes as any);
  } catch (e) {
    // silent — alerta de baixa nunca deve bloquear o fluxo principal
    console.warn("verificarEstoqueBaixo falhou", e);
  }
}
