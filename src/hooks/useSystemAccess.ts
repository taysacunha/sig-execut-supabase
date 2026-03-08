import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export type SystemName = "escalas" | "vendas" | "ferias" | "estoque";
export type PermissionType = "view_only" | "view_edit";

export interface SystemPermission {
  system_name: SystemName;
  permission_type: PermissionType;
}

export function useSystemAccess(): UseSystemAccessReturn {
  const [user, setUser] = useState<User | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const queryClient = useQueryClient();

  // Use React Query for caching permissions
  const { data: systems = [], isLoading: queryLoading, refetch: refetchQuery } = useQuery({
    queryKey: ["system-access", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("system_access")
        .select("system_name, permission_type")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user systems:", error);
        return [];
      }
      
      return (data || []).map((row) => ({
        system_name: row.system_name as SystemName,
        permission_type: row.permission_type as PermissionType,
      }));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes - avoid re-fetch on navigation
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Use cache when remounting
  });

  const refetch = async () => {
    if (user?.id) {
      await refetchQuery();
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setInitialLoading(false);
      }
    });

    // Listen for auth changes - only process events that actually change login state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        // Ignore TOKEN_REFRESHED and other events that don't change the logged-in user
        if (event === 'SIGNED_OUT') {
          setUser(null);
          queryClient.removeQueries({ queryKey: ["system-access"] });
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          setUser(session?.user ?? null);
        }
        // Ignore: TOKEN_REFRESHED, INITIAL_SESSION, PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Only show loading on first mount when we don't have cached data
  const loading = initialLoading || (queryLoading && systems.length === 0);

  const hasAccess = (system: SystemName): boolean => {
    return systems.some((s) => s.system_name === system);
  };

  const canEdit = (system: SystemName): boolean => {
    const permission = systems.find((s) => s.system_name === system);
    return permission?.permission_type === "view_edit";
  };

  const getPermission = (system: SystemName): PermissionType | null => {
    const permission = systems.find((s) => s.system_name === system);
    return permission?.permission_type ?? null;
  };

  return {
    systems,
    loading,
    hasAccess,
    canEdit,
    getPermission,
    user,
    refetch,
  };
}

interface UseSystemAccessReturn {
  systems: SystemPermission[];
  loading: boolean;
  hasAccess: (system: SystemName) => boolean;
  canEdit: (system: SystemName) => boolean;
  getPermission: (system: SystemName) => PermissionType | null;
  user: User | null;
  refetch: () => Promise<void>;
}
