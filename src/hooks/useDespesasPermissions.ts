import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type DespesasAba = "calendario" | "imoveis" | "repasses" | "cadastros";
export type DespesasNivel = "sem_acesso" | "view" | "edit" | "delete";

export interface DespesasAbaPermissao {
  aba: DespesasAba;
  nivel: DespesasNivel;
}

export function useDespesasPermissions() {
  const [user, setUser] = useState<User | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setInitialLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setUser(null);
      else if (event === "SIGNED_IN" || event === "USER_UPDATED") setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: role } = useQuery({
    queryKey: ["user-role-quick", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r) => r.role);
      if (roles.includes("super_admin")) return "super_admin";
      if (roles.includes("admin")) return "admin";
      return roles[0] ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: perms = [], isLoading, refetch } = useQuery({
    queryKey: ["despesas-aba-permissoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as DespesasAbaPermissao[];
      const { data, error } = await supabase
        .from("despesas_aba_permissoes" as any)
        .select("aba, nivel")
        .eq("user_id", user.id);
      if (error) {
        console.warn("[despesas] permissoes não carregadas:", error.message);
        return [];
      }
      return (data ?? []) as unknown as DespesasAbaPermissao[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = role === "admin" || role === "super_admin";

  const nivelDe = (aba: DespesasAba): DespesasNivel => {
    const found = perms.find((p) => p.aba === aba);
    if (found) return found.nivel;
    return isAdmin ? "delete" : "sem_acesso";
  };

  const podeVer = (aba: DespesasAba) => ["view", "edit", "delete"].includes(nivelDe(aba));
  const podeEditar = (aba: DespesasAba) => ["edit", "delete"].includes(nivelDe(aba));
  const podeExcluir = (aba: DespesasAba) => nivelDe(aba) === "delete";

  return {
    user,
    isAdmin,
    perms,
    loading: initialLoading || (isLoading && perms.length === 0),
    nivelDe,
    podeVer,
    podeEditar,
    podeExcluir,
    refetch,
  };
}