import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DespesaNotificacao {
  id: string;
  user_id: string;
  lancamento_id: string;
  tipo: "proximidade" | "vencido" | "pago" | "cancelado";
  dias_para_vencer: number | null;
  mensagem: string | null;
  lida: boolean;
  created_at: string;
  lancamento?: {
    descricao: string;
    valor_total: number;
    data_vencimento: string;
    tipo: string;
  } | null;
}

export interface NotifPrefs {
  user_id: string;
  dias_antecedencia: number[];
  notificar_vencidos: boolean;
  notificar_pagos: boolean;
  updated_at: string;
}

export const NOTIF_KEY = "despesas-notificacoes";
export const NOTIF_PREFS_KEY = "despesas-notif-prefs";

export function useNotificacoes() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("despesas_notif_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "despesas_notificacoes" },
        () => qc.invalidateQueries({ queryKey: [NOTIF_KEY] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: [NOTIF_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_notificacoes" as any)
        .select(
          "*, lancamento:despesas_lancamentos(descricao, valor_total, data_vencimento, tipo)"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as DespesaNotificacao[];
    },
    refetchInterval: 60_000,
  });
}

export function useMarcarLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("despesas_notificacoes" as any)
        .update({ lida: true } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIF_KEY] }),
  });
}

export function useNotifPrefs() {
  return useQuery({
    queryKey: [NOTIF_PREFS_KEY],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("despesas_notificacoes_preferencias" as any)
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as NotifPrefs) ?? {
        user_id: uid,
        dias_antecedencia: [7, 1],
        notificar_vencidos: true,
        notificar_pagos: false,
        updated_at: new Date().toISOString(),
      };
    },
  });
}

export function useSaveNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NotifPrefs>) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Não autenticado");
      const payload: any = { ...input, user_id: uid, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from("despesas_notificacoes_preferencias" as any)
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIF_PREFS_KEY] }),
  });
}