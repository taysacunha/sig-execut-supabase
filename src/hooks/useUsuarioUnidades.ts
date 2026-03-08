import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

const fromEstoque = (table: string) => supabase.from(table as any);

interface Unidade {
  id: string;
  nome: string;
}

interface VinculoUnidade {
  id: string;
  unidade_id: string;
  setor_id: string | null;
  setor_nome: string | null;
  setor_ativo: boolean;
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

  // Fetch all setores (for resolving names)
  const { data: todosSetores = [] } = useQuery({
    queryKey: ["ferias-setores-todos-hook"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome, is_active")
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; is_active: boolean }[];
    },
  });

  // Fetch user's direct unit links (with setor_id)
  const { data: vinculosDirectos = [] } = useQuery({
    queryKey: ["estoque-usuario-unidades", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await fromEstoque("estoque_usuarios_unidades")
        .select("id, unidade_id, setor_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as unknown as { id: string; unidade_id: string; setor_id: string | null }[];
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

  // Helper to resolve setor info
  const resolveSetor = (setorId: string | null) => {
    if (!setorId) return { setor_nome: null, setor_ativo: true };
    const setor = todosSetores.find((s) => s.id === setorId);
    return {
      setor_nome: setor?.nome || null,
      setor_ativo: setor?.is_active ?? false,
    };
  };

  // Build enriched vinculos for user
  const vinculosEnriquecidos: VinculoUnidade[] = vinculosDirectos.map((v) => {
    const { setor_nome, setor_ativo } = resolveSetor(v.setor_id);
    return {
      id: v.id,
      unidade_id: v.unidade_id,
      setor_id: v.setor_id,
      setor_nome,
      setor_ativo,
    };
  });

  // Admins see all units
  if (isAdmin) {
    return {
      unidadesPermitidas: todasUnidades,
      unidadeIds: todasUnidades.map((u) => u.id),
      vinculos: [] as VinculoUnidade[],
      isAdmin: true,
      loading: false,
      getSetorParaUnidade: (_unidadeId: string) => ({ setor_id: null, setor_nome: null }),
    };
  }

  // Merge direct links + manager links (deduplicate)
  const idsSet = new Set([...vinculosDirectos.map((v) => v.unidade_id), ...vinculosGestor]);
  const unidadesPermitidas = todasUnidades.filter((u) => idsSet.has(u.id));

  // Function to get the setor for a given unidade from user's vinculos
  const getSetorParaUnidade = (unidadeId: string) => {
    const vinculo = vinculosEnriquecidos.find((v) => v.unidade_id === unidadeId);
    return {
      setor_id: vinculo?.setor_id || null,
      setor_nome: vinculo?.setor_nome || null,
    };
  };

  return {
    unidadesPermitidas,
    unidadeIds: Array.from(idsSet),
    vinculos: vinculosEnriquecidos,
    isAdmin: false,
    loading: !user,
    getSetorParaUnidade,
  };
}
