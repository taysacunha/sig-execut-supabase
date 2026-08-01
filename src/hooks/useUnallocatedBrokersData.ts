import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dados de apoio (somente leitura) para montar o relatório
 * "Corretores sem alocação por dia".
 */
export function useUnallocatedBrokersData(
  scheduleId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ["unallocated-brokers-data", scheduleId, startDate, endDate],
    enabled: !!scheduleId && !!startDate && !!endDate,
    staleTime: 60_000,
    queryFn: async () => {
      const [
        assignmentsRes,
        brokersRes,
        locationBrokersRes,
        locationsRes,
        periodsRes,
        dayConfigsRes,
        specificRes,
        excludedRes,
      ] = await Promise.all([
        supabase
          .from("schedule_assignments")
          .select("broker_id, assignment_date")
          .eq("generated_schedule_id", scheduleId!)
          .gte("assignment_date", startDate!)
          .lte("assignment_date", endDate!),
        supabase
          .from("brokers")
          .select("id, name, is_active, available_weekdays, weekday_shift_availability"),
        supabase
          .from("location_brokers")
          .select(
            "broker_id, location_id, available_morning, available_afternoon, weekday_shift_availability"
          ),
        supabase.from("locations").select("id, name, is_active"),
        supabase
          .from("location_periods")
          .select("id, location_id, start_date, end_date")
          .lte("start_date", endDate!)
          .gte("end_date", startDate!),
        supabase
          .from("period_day_configs")
          .select("period_id, weekday, has_morning, has_afternoon"),
        supabase
          .from("period_specific_day_configs")
          .select("period_id, specific_date, has_morning, has_afternoon")
          .gte("specific_date", startDate!)
          .lte("specific_date", endDate!),
        supabase
          .from("period_excluded_dates")
          .select("period_id, excluded_date, excluded_shifts, reason")
          .gte("excluded_date", startDate!)
          .lte("excluded_date", endDate!),
      ]);

      const firstError =
        assignmentsRes.error ||
        brokersRes.error ||
        locationBrokersRes.error ||
        locationsRes.error ||
        periodsRes.error ||
        dayConfigsRes.error ||
        specificRes.error ||
        excludedRes.error;
      if (firstError) throw firstError;

      return {
        assignments: assignmentsRes.data || [],
        brokers: brokersRes.data || [],
        locationBrokers: locationBrokersRes.data || [],
        locations: locationsRes.data || [],
        periods: periodsRes.data || [],
        dayConfigs: dayConfigsRes.data || [],
        specificDayConfigs: specificRes.data || [],
        excludedDates: excludedRes.data || [],
      };
    },
  });
}
