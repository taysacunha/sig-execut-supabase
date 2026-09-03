import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDevTrackerTotal(enabled: boolean) {
  return useQuery({
    queryKey: ["dev_tracker_total_reference"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dev_tracker")
        .select("hours");

      if (error) throw error;

      const total = (data ?? []).reduce((sum, row) => sum + Number(row.hours || 0), 0);
      return total;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
