import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

const fromEstoque = (table: string) => supabase.from(table as any);

interface Unidade {
  id: string;
  nome: string;
}

export function useUsuarioUnidades() {
  const { user, isAdmin } = useUserRole();

  // Fetch all active units
  const { data: todasUnidades = [] } = useQuery({
    queryKey: ["ferias-unidades-todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_unidades")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  // Fetch user's direct unit links
  const { data: vinculosDirectos = [] } = useQuery({
    queryKey: ["estoque-usuario-unidades", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await fromEstoque("estoque_usuarios_unidades")
        .select("unidade_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.unidade_id as string);
    },
    enabled: !!user?.id && !isAdmin,
  });

  // Fetch units where user is a manager
  const { data: vinculosGestor = [] } = useQuery({
    queryKey: ["estoque-gestor-unidades", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await fromEstoque("estoque_gestores")
        .select("unidade_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.unidade_id as string);
    },
    enabled: !!user?.id && !isAdmin,
  });

  // Admins see all units
  if (isAdmin) {
    return {
      unidadesPermitidas: todasUnidades,
      unidadeIds: todasUnidades.map((u) => u.id),
      isAdmin: true,
      loading: false,
    };
  }

  // Merge direct links + manager links (deduplicate)
  const idsSet = new Set([...vinculosDirectos, ...vinculosGestor]);
  const unidadesPermitidas = todasUnidades.filter((u) => idsSet.has(u.id));

  return {
    unidadesPermitidas,
    unidadeIds: Array.from(idsSet),
    isAdmin: false,
    loading: !user,
  };
}
