import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Eye, Edit, Trash2, ChevronDown, CalendarDays, Info } from "lucide-react";
import { toast } from "sonner";
import { format, eachDayOfInterval, getDay, startOfWeek, addDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { InternalPeriodConfigDialog } from "./InternalPeriodConfigDialog";
import { SpecificDateShiftDialog } from "./SpecificDateShiftDialog";

// Mapear nomes de dias para números (0 = domingo, 1 = segunda, etc)
const weekdayToNumber: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Contar quantas vezes um dia da semana ocorre em um período
const countWeekdayOccurrences = (
  startDate: string,
  endDate: string,
  weekday: string
): number => {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const targetDay = weekdayToNumber[weekday];
  
  if (targetDay === undefined) return 0;
  
  let count = 0;
  const current = new Date(start);
  
  // Iterar por cada dia do período
  while (current <= end) {
    if (current.getDay() === targetDay) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

interface LocationPeriodTreeProps {
  locationId: string;
  locationName: string;
  locationType: "internal" | "external";
}

export function LocationPeriodTree({ locationId, locationName, locationType }: LocationPeriodTreeProps) {
  const [periodForm, setPeriodForm] = useState({
    month: new Date().getMonth() + 1, // 1-12
    year: new Date().getFullYear(),
  });
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Date[]>([]);
  const [createdPeriodId, setCreatedPeriodId] = useState<string | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  
  // Estados para horários de locais internos
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [saturdayEnabled, setSaturdayEnabled] = useState(true);
  const [sundayEnabled, setSundayEnabled] = useState(true);
  
  const [internalSchedule, setInternalSchedule] = useState({
    weekday_morning_start: "08:00",
    weekday_morning_end: "12:00",
    weekday_afternoon_start: "13:00",
    weekday_afternoon_end: "18:00",
    saturday_start: "08:00",
    saturday_end: "12:00",
    sunday_start: "08:00",
    sunday_end: "12:00",
  });

  // Estado para o diálogo de configuração de períodos internos
  const [editingInternalPeriod, setEditingInternalPeriod] = useState<{ id: string; name: string } | null>(null);

  // States for specific date shift configuration
  const [specificDateDialogOpen, setSpecificDateDialogOpen] = useState(false);
  const [editingSpecificDate, setEditingSpecificDate] = useState<Date | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  
  // States for weekday mode with side panel
  const [selectedWeekdayDates, setSelectedWeekdayDates] = useState<Date[]>([]);
  
  // Separar configurações por tipo de dia
  const [tempWeekdayConfig, setTempWeekdayConfig] = useState({
    has_morning: false,
    has_afternoon: false,
    morning_start: "08:00",
    morning_end: "12:00",
    afternoon_start: "13:00",
    afternoon_end: "18:00",
  });
  
  const [tempSaturdayConfig, setTempSaturdayConfig] = useState({
    has_morning: false,
    has_afternoon: false,
    morning_start: "08:00",
    morning_end: "12:00",
    afternoon_start: "13:00",
    afternoon_end: "18:00",
  });
  
  const [tempSundayConfig, setTempSundayConfig] = useState({
    has_morning: false,
    has_afternoon: false,
    morning_start: "08:00",
    morning_end: "12:00",
    afternoon_start: "13:00",
    afternoon_end: "18:00",
  });

  // Separar dias selecionados por tipo
  const weekdayDates = useMemo(() => 
    selectedWeekdayDates.filter(d => {
      const day = getDay(d);
      return day >= 1 && day <= 5; // Segunda a Sexta
    }), [selectedWeekdayDates]
  );

  const saturdayDates = useMemo(() => 
    selectedWeekdayDates.filter(d => getDay(d) === 6), 
    [selectedWeekdayDates]
  );

  const sundayDates = useMemo(() => 
    selectedWeekdayDates.filter(d => getDay(d) === 0), 
    [selectedWeekdayDates]
  );

  const queryClient = useQueryClient();

  // Fetch location details to check shift_config_mode
  const { data: location } = useQuery({
    queryKey: ["location", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!locationId,
  });

  // Update currentLocation when location data changes
  if (location && location !== currentLocation) {
    setCurrentLocation(location);
  }

  const { data: periods } = useQuery({
    queryKey: ["location-periods", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_periods")
        .select("*")
        .eq("location_id", locationId)
        .eq("period_type", "monthly")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const { data: periodDayConfigs } = useQuery({
    queryKey: ["period-day-configs", locationId],
    queryFn: async () => {
      if (!periods || periods.length === 0) return [];
      const { data, error } = await supabase
        .from("period_day_configs")
        .select("*")
        .in("period_id", periods.map(p => p.id));
      if (error) throw error;
      return data;
    },
    enabled: !!periods && periods.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch specific date configurations for external locations
  const { data: specificDateConfigs } = useQuery({
    queryKey: ["period-specific-day-configs", locationId],
    queryFn: async () => {
      if (!periods || periods.length === 0) return [];
      const { data, error } = await supabase
        .from("period_specific_day_configs")
        .select("*")
        .in("period_id", periods.map(p => p.id));
      if (error) throw error;
      return data;
    },
    enabled: !!periods && periods.length > 0,
  });

  const dayConfigsByPeriod = periodDayConfigs?.reduce((acc, config) => {
    if (!acc[config.period_id]) acc[config.period_id] = [];
    acc[config.period_id].push(config);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const specificDateConfigsByPeriod = specificDateConfigs?.reduce((acc, config) => {
    if (!acc[config.period_id]) acc[config.period_id] = [];
    acc[config.period_id].push(config);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // Estado para banner de horários herdados
  const [inheritedFromLabel, setInheritedFromLabel] = useState<string | null>(null);

  // Buscar configs do período anterior para auto-fill
  const getPreviousPeriodConfigs = useCallback(async () => {
    if (!periods || periods.length === 0) return null;
    
    const sortedPeriods = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const previousPeriod = sortedPeriods[0];
    if (!previousPeriod) return null;

    const { data: prevSpecificConfigs } = await supabase
      .from("period_specific_day_configs")
      .select("*")
      .eq("period_id", previousPeriod.id);

    const { data: prevDayConfigs } = await supabase
      .from("period_day_configs")
      .select("*")
      .eq("period_id", previousPeriod.id);

    const configs = (prevSpecificConfigs && prevSpecificConfigs.length > 0) ? prevSpecificConfigs : prevDayConfigs;
    if (!configs || configs.length === 0) return null;

    const periodDate = new Date(previousPeriod.start_date + "T00:00:00");
    const label = format(periodDate, "MMMM/yyyy", { locale: ptBR });

    let weekdayConfig: any = null;
    let saturdayConfig: any = null;
    let sundayConfig: any = null;

    if (prevSpecificConfigs && prevSpecificConfigs.length > 0) {
      weekdayConfig = prevSpecificConfigs.find((c: any) => {
        const dow = new Date(c.specific_date + "T00:00:00").getDay();
        return dow >= 1 && dow <= 5;
      });
      saturdayConfig = prevSpecificConfigs.find((c: any) => {
        const dow = new Date(c.specific_date + "T00:00:00").getDay();
        return dow === 6;
      });
      sundayConfig = prevSpecificConfigs.find((c: any) => {
        const dow = new Date(c.specific_date + "T00:00:00").getDay();
        return dow === 0;
      });
    } else if (prevDayConfigs && prevDayConfigs.length > 0) {
      weekdayConfig = prevDayConfigs.find((c: any) => 
        ["monday","tuesday","wednesday","thursday","friday"].includes(c.weekday)
      );
      saturdayConfig = prevDayConfigs.find((c: any) => c.weekday === "saturday");
      sundayConfig = prevDayConfigs.find((c: any) => c.weekday === "sunday");
    }

    return { weekdayConfig, saturdayConfig, sundayConfig, label };
  }, [periods]);

  // (handleCreatePeriod and getSuggestedConfigForDate moved below createPeriodMutation)

  const createPeriodMutation = useMutation({
    mutationFn: async (data: typeof periodForm) => {
      // Calcular primeiro e último dia do mês
      const startDate = new Date(data.year, data.month - 1, 1);
      const endDate = new Date(data.year, data.month, 0); // Último dia do mês
      
      const { data: newPeriod, error } = await supabase
        .from("location_periods")
        .insert([
          {
            location_id: locationId,
            period_type: "monthly",
            start_date: format(startDate, "yyyy-MM-dd"),
            end_date: format(endDate, "yyyy-MM-dd"),
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return newPeriod;
    },
    onSuccess: (newPeriod, variables) => {
      queryClient.invalidateQueries({ queryKey: ["location-periods", locationId] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Período adicionado!");
      
      // Definir o mês do calendário para o mês/ano selecionado
      setCalendarMonth(new Date(variables.year, variables.month - 1, 1));
      
      if (locationType === "external") {
        // Para externos, abrir calendário
        setCreatedPeriodId(newPeriod.id);
        setCalendarDialogOpen(true);
      } else {
        // Para internos, criar automaticamente os 7 dias
        createInternalDayConfigs(newPeriod.id);
      }
      
      setPeriodForm({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    },
  });

  // Validar duplicata e criar período
  const handleCreatePeriod = useCallback(async () => {
    const startDate = new Date(periodForm.year, periodForm.month - 1, 1);
    const startDateStr = format(startDate, "yyyy-MM-dd");
    
    const isDuplicate = periods?.some(p => p.start_date === startDateStr);
    if (isDuplicate) {
      toast.error("Já existe um período para este mês/ano neste local!");
      return;
    }

    const prevConfigs = await getPreviousPeriodConfigs();
    if (prevConfigs) {
      setInheritedFromLabel(prevConfigs.label);
      if (prevConfigs.weekdayConfig) {
        const c = prevConfigs.weekdayConfig;
        setTempWeekdayConfig({ has_morning: c.has_morning || false, has_afternoon: c.has_afternoon || false, morning_start: c.morning_start || "08:00", morning_end: c.morning_end || "12:00", afternoon_start: c.afternoon_start || "13:00", afternoon_end: c.afternoon_end || "18:00" });
        if (locationType === "internal") setInternalSchedule(prev => ({ ...prev, weekday_morning_start: c.morning_start || "08:00", weekday_morning_end: c.morning_end || "12:00", weekday_afternoon_start: c.afternoon_start || "13:00", weekday_afternoon_end: c.afternoon_end || "18:00" }));
      }
      if (prevConfigs.saturdayConfig) {
        const c = prevConfigs.saturdayConfig;
        setTempSaturdayConfig({ has_morning: c.has_morning || false, has_afternoon: c.has_afternoon || false, morning_start: c.morning_start || "08:00", morning_end: c.morning_end || "12:00", afternoon_start: c.afternoon_start || "13:00", afternoon_end: c.afternoon_end || "18:00" });
        if (locationType === "internal") setInternalSchedule(prev => ({ ...prev, saturday_start: c.morning_start || "08:00", saturday_end: c.morning_end || "12:00" }));
      }
      if (prevConfigs.sundayConfig) {
        const c = prevConfigs.sundayConfig;
        setTempSundayConfig({ has_morning: c.has_morning || false, has_afternoon: c.has_afternoon || false, morning_start: c.morning_start || "08:00", morning_end: c.morning_end || "12:00", afternoon_start: c.afternoon_start || "13:00", afternoon_end: c.afternoon_end || "18:00" });
        if (locationType === "internal") setInternalSchedule(prev => ({ ...prev, sunday_start: c.morning_start || "08:00", sunday_end: c.morning_end || "12:00" }));
      }
    } else {
      setInheritedFromLabel(null);
    }

    createPeriodMutation.mutate(periodForm);
  }, [periodForm, periods, getPreviousPeriodConfigs, createPeriodMutation, locationType]);

  const getSuggestedConfigForDate = useCallback((date: Date | null) => {
    if (!date || !inheritedFromLabel) return undefined;
    const dow = getDay(date);
    if (dow >= 1 && dow <= 5) return tempWeekdayConfig.has_morning || tempWeekdayConfig.has_afternoon ? tempWeekdayConfig : undefined;
    if (dow === 6) return tempSaturdayConfig.has_morning || tempSaturdayConfig.has_afternoon ? tempSaturdayConfig : undefined;
    if (dow === 0) return tempSundayConfig.has_morning || tempSundayConfig.has_afternoon ? tempSundayConfig : undefined;
    return undefined;
  }, [tempWeekdayConfig, tempSaturdayConfig, tempSundayConfig, inheritedFromLabel]);

  const createDayConfigsMutation = useMutation({
    mutationFn: async (configs: any[]) => {
      const { error } = await supabase
        .from("period_day_configs")
        .insert(configs);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-periods", locationId] });
      queryClient.invalidateQueries({ queryKey: ["period-day-configs", locationId] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success(editingPeriodId ? "Dias atualizados com sucesso!" : "Dias configurados com sucesso!");
      setCalendarDialogOpen(false);
      setSelectedDays([]);
      setCreatedPeriodId(null);
      setEditingPeriodId(null);
    },
    onError: (err) => {
      toast.error("Não foi possível salvar os dias. Tente novamente.");
    },
  });

  const createInternalDayConfigs = async (periodId: string) => {
    const configs = [];
    
    // Adicionar dias da semana selecionados (segunda a sexta)
    for (const weekday of selectedWeekdays) {
      configs.push({
        period_id: periodId,
        weekday: weekday,
        has_morning: true,
        has_afternoon: true,
        morning_start: internalSchedule.weekday_morning_start,
        morning_end: internalSchedule.weekday_morning_end,
        afternoon_start: internalSchedule.weekday_afternoon_start,
        afternoon_end: internalSchedule.weekday_afternoon_end,
        max_brokers_count: 2,
      });
    }
    
    // Adicionar sábado se habilitado
    if (saturdayEnabled) {
      configs.push({
        period_id: periodId,
        weekday: "saturday",
        has_morning: true,
        has_afternoon: false,
        morning_start: internalSchedule.saturday_start,
        morning_end: internalSchedule.saturday_end,
        afternoon_start: null,
        afternoon_end: null,
        max_brokers_count: 3, // Tambaú + Bessa podem ter múltiplos corretores
      });
    }
    
    // Adicionar domingo se habilitado
    if (sundayEnabled) {
      configs.push({
        period_id: periodId,
        weekday: "sunday",
        has_morning: true,
        has_afternoon: false,
        morning_start: internalSchedule.sunday_start,
        morning_end: internalSchedule.sunday_end,
        afternoon_start: null,
        afternoon_end: null,
        max_brokers_count: 2,
      });
    }

    if (configs.length === 0) {
      toast.error("Selecione pelo menos um dia da semana!");
      return;
    }

    createDayConfigsMutation.mutate(configs);
  };

  const handleConfirmDays = async () => {
    // Para locais specific_date, apenas fechar o dialog (já salvou tudo individualmente)
    if (currentLocation?.shift_config_mode === "specific_date") {
      // Verificar se tem pelo menos um dia configurado
      const configuredDays = specificDateConfigs?.filter(
        (config: any) => config.period_id === createdPeriodId
      ) || [];
      
      if (configuredDays.length === 0) {
        toast.error("Configure pelo menos um dia antes de finalizar!");
        return;
      }
      
      // Fechar o dialog e resetar estados
      setCalendarDialogOpen(false);
      setSelectedDays([]);
      setCreatedPeriodId(null);
      setEditingPeriodId(null);
      toast.success(`${configuredDays.length} dia(s) configurado(s) com sucesso!`);
      return;
    }

    // Para locais weekday mode, continuar com a lógica normal
    if (selectedDays.length === 0 || (!createdPeriodId && !editingPeriodId)) {
      toast.error("Selecione pelo menos um dia!");
      return;
    }

    // Se estiver editando, deletar configs antigos primeiro
    if (editingPeriodId) {
      const { error: deleteError } = await supabase
        .from("period_day_configs")
        .delete()
        .eq("period_id", editingPeriodId);
      
      if (deleteError) {
        toast.error("Erro ao atualizar configurações");
        return;
      }
    }

    // Extrair dias da semana únicos das datas selecionadas
    const uniqueWeekdays = Array.from(
      new Set(selectedDays.map((date) => getDay(date)))
    );

    const configs = uniqueWeekdays.map((dayOfWeek) => {
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const weekdayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      
      return {
        period_id: editingPeriodId || createdPeriodId,
        weekday: weekdayMap[dayOfWeek],
        has_morning: true,
        has_afternoon: !isWeekend,
        morning_start: "08:00",
        morning_end: "12:00",
        afternoon_start: isWeekend ? null : "13:00",
        afternoon_end: isWeekend ? null : "18:00",
        max_brokers_count: isWeekend ? 1 : 2,
      };
    });

    createDayConfigsMutation.mutate(configs);
  };

  const deletePeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      // Deletar day_configs primeiro (cascade)
      const { error: configError } = await supabase
        .from("period_day_configs")
        .delete()
        .eq("period_id", periodId);
      if (configError) throw configError;

      // Depois deletar o período
      const { error: periodError } = await supabase
        .from("location_periods")
        .delete()
        .eq("id", periodId);
      if (periodError) throw periodError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-periods", locationId] });
      queryClient.invalidateQueries({ queryKey: ["period-day-configs", locationId] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Período removido com sucesso!");
    },
  });

  const handleDeletePeriod = (periodId: string) => {
    if (confirm("Tem certeza que deseja remover este período? Todos os dias configurados serão excluídos.")) {
      deletePeriodMutation.mutate(periodId);
    }
  };

  const handleEditPeriod = (periodId: string) => {
    setSelectedDays([]);
    setSelectedWeekdayDates([]);
    
    const period = periods?.find((p) => p.id === periodId);
    if (!period) {
      toast.error("Período não encontrado");
      return;
    }

    if (locationType === "internal") {
      setEditingInternalPeriod({
        id: periodId,
        name: `${format(new Date(period.start_date), "MMM/yyyy", { locale: ptBR })}`,
      });
    } else {
      setEditingPeriodId(periodId);
      setCreatedPeriodId(periodId);
      
      const periodStart = new Date(period.start_date + "T00:00:00");
      setCalendarMonth(periodStart);
      
      if (currentLocation?.shift_config_mode === "specific_date") {
        const configsForPeriod = specificDateConfigs?.filter((c: any) => c.period_id === periodId) || [];
        const configuredDates = configsForPeriod.map((c: any) => new Date(c.specific_date + "T00:00:00"));
        setSelectedDays(configuredDates);
      } else {
        // Carregar dias específicos configurados no modo weekday
        const configsForPeriod = specificDateConfigs?.filter((c: any) => c.period_id === periodId) || [];
        const configuredDates = configsForPeriod.map((c: any) => new Date(c.specific_date + "T00:00:00"));
        setSelectedWeekdayDates(configuredDates);
        
        // Carregar configuração de turno para cada tipo de dia
        // 1. Carregar config de dias úteis (seg-sex)
        const weekdayConfig = configsForPeriod.find((c: any) => {
          const date = new Date(c.specific_date + "T00:00:00");
          const day = getDay(date);
          return day >= 1 && day <= 5;
        });
        if (weekdayConfig) {
          setTempWeekdayConfig({
            has_morning: weekdayConfig.has_morning || false,
            has_afternoon: weekdayConfig.has_afternoon || false,
            morning_start: weekdayConfig.morning_start || "08:00",
            morning_end: weekdayConfig.morning_end || "12:00",
            afternoon_start: weekdayConfig.afternoon_start || "13:00",
            afternoon_end: weekdayConfig.afternoon_end || "18:00",
          });
        }
        
        // 2. Carregar config de sábado
        const saturdayConfig = configsForPeriod.find((c: any) => {
          const date = new Date(c.specific_date + "T00:00:00");
          return getDay(date) === 6;
        });
        if (saturdayConfig) {
          setTempSaturdayConfig({
            has_morning: saturdayConfig.has_morning || false,
            has_afternoon: saturdayConfig.has_afternoon || false,
            morning_start: saturdayConfig.morning_start || "08:00",
            morning_end: saturdayConfig.morning_end || "12:00",
            afternoon_start: saturdayConfig.afternoon_start || "13:00",
            afternoon_end: saturdayConfig.afternoon_end || "18:00",
          });
        }
        
        // 3. Carregar config de domingo
        const sundayConfig = configsForPeriod.find((c: any) => {
          const date = new Date(c.specific_date + "T00:00:00");
          return getDay(date) === 0;
        });
        if (sundayConfig) {
          setTempSundayConfig({
            has_morning: sundayConfig.has_morning || false,
            has_afternoon: sundayConfig.has_afternoon || false,
            morning_start: sundayConfig.morning_start || "08:00",
            morning_end: sundayConfig.morning_end || "12:00",
            afternoon_start: sundayConfig.afternoon_start || "13:00",
            afternoon_end: sundayConfig.afternoon_end || "18:00",
          });
        }
      }
      
      setCalendarDialogOpen(true);
    }
  };

  const handleOpenCalendar = (periodId: string) => {
    setCreatedPeriodId(periodId);
    setEditingPeriodId(null);
    setSelectedDays([]);
    
    const period = periods?.find(p => p.id === periodId);
    if (period) {
      const periodStart = new Date(period.start_date + "T00:00:00");
      setCalendarMonth(periodStart);
    }
    
    setCalendarDialogOpen(true);
  };

  // Handle specific date configuration save
  const handleSaveSpecificDateConfig = async (config: {
    has_morning: boolean;
    has_afternoon: boolean;
    morning_start: string;
    morning_end: string;
    afternoon_start: string;
    afternoon_end: string;
  }) => {
    if (!editingSpecificDate || !createdPeriodId) return;

    try {
      const specificDate = format(editingSpecificDate, "yyyy-MM-dd");
      
      // Verificar se já existe config para esta data
      const existingConfig = specificDateConfigs?.find(
        (c: any) => c.period_id === createdPeriodId && c.specific_date === specificDate
      );

      if (existingConfig) {
        // Atualizar
        const { error } = await supabase
          .from("period_specific_day_configs")
          .update({
            has_morning: config.has_morning,
            has_afternoon: config.has_afternoon,
            morning_start: config.morning_start,
            morning_end: config.morning_end,
            afternoon_start: config.afternoon_start,
            afternoon_end: config.afternoon_end,
          })
          .eq("id", existingConfig.id);

        if (error) throw error;
      } else {
        // Inserir nova config
        const { error } = await supabase
          .from("period_specific_day_configs")
          .insert({
            period_id: createdPeriodId,
            specific_date: specificDate,
            has_morning: config.has_morning,
            has_afternoon: config.has_afternoon,
            morning_start: config.morning_start,
            morning_end: config.morning_end,
            afternoon_start: config.afternoon_start,
            afternoon_end: config.afternoon_end,
            max_brokers_count: 1,
          });

        if (error) throw error;
      }

      // Invalidar queries para atualizar a UI
      await queryClient.invalidateQueries({ 
        queryKey: ["period-specific-day-configs", locationId] 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["period-specific-day-configs", locationId] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["locations"] 
      });

      setSpecificDateDialogOpen(false);
      toast.success("Configuração salva com sucesso!");
    } catch (error: any) {
      console.error("Error saving specific date config:", error);
      toast.error("Erro ao salvar configuração: " + error.message);
    }
  };

  const handleDeleteSpecificDateConfig = async () => {
    if (!editingSpecificDate || !createdPeriodId) return;

    try {
      const specificDate = format(editingSpecificDate, "yyyy-MM-dd");
      
      const { error } = await supabase
        .from("period_specific_day_configs")
        .delete()
        .eq("period_id", createdPeriodId)
        .eq("specific_date", specificDate);

      if (error) throw error;

      // Invalidar queries para atualizar a UI
      await queryClient.invalidateQueries({ 
        queryKey: ["period-specific-day-configs", locationId] 
      });
      await queryClient.refetchQueries({ 
        queryKey: ["period-specific-day-configs", locationId] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ["locations"] 
      });

      // Atualizar selectedDays com os dados mais recentes após o refetch
      const updatedSavedDays = specificDateConfigs
        ?.filter((c: any) => c.period_id === createdPeriodId)
        ?.map((c: any) => new Date(c.specific_date + "T00:00:00")) || [];
      
      setSelectedDays(updatedSavedDays);

      setSpecificDateDialogOpen(false);
      toast.success("Dia removido com sucesso!");
    } catch (error: any) {
      console.error("Error deleting specific date config:", error);
      toast.error("Erro ao remover dia: " + error.message);
    }
  };

  // Função para obter a configuração de uma data específica
  const getConfigForDate = (date: Date) => {
    if (!createdPeriodId) return null;
    
    const specificDate = format(date, "yyyy-MM-dd");
    const config = specificDateConfigs?.find(
      (c: any) => c.period_id === createdPeriodId && c.specific_date === specificDate
    );
    
    return config || null;
  };

  // Função para fechar o dialog do calendário
  const handleCloseCalendar = () => {
    // Verificar se não há dias selecionados para dar warning
    const isSpecificDateMode = currentLocation?.shift_config_mode === "specific_date";
    
    if (isSpecificDateMode) {
      const configuredCount = specificDateConfigs?.filter(
        (c: any) => c.period_id === createdPeriodId
      ).length || 0;
      
      if (configuredCount === 0) {
        toast.warning("Nenhum dia foi configurado neste período");
      }
    }
    
    setCalendarDialogOpen(false);
    setEditingPeriodId(null);
  };

  // Função para pegar o período atual
  const getCurrentPeriod = () => {
    const periodId = editingPeriodId || createdPeriodId;
    if (!periodId || !periods) return null;
    return periods.find(p => p.id === periodId) || null;
  };

  // Função para calcular o mês inicial do calendário
  const getDefaultMonth = () => {
    const period = getCurrentPeriod();
    if (!period) return undefined;
    return new Date(period.start_date + "T00:00:00");
  };

  const getPeriodRange = () => {
    const period = getCurrentPeriod();
    if (!period) return { periodStart: undefined, periodEnd: undefined };
    return {
      periodStart: new Date(period.start_date + "T00:00:00"),
      periodEnd: new Date(period.end_date + "T23:59:59"),
    };
  };

  const handleSelectWeek = () => {
    const { periodStart, periodEnd } = getPeriodRange();
    if (!periodStart || !periodEnd) {
      toast.error("Nenhum período selecionado");
      return;
    }

    const currentMonth = calendarMonth || periodStart;
    let weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 }); // Segunda-feira
    
    if (weekStart < periodStart) weekStart = periodStart;

    const weekDates: Date[] = [];
    for (let i = 0; i < 6; i++) { // Segunda a Sábado (6 dias)
      const date = addDays(weekStart, i);
      if (date >= periodStart && date <= periodEnd) {
        weekDates.push(date);
      }
    }

    if (weekDates.length > 0) {
      setSelectedDays(weekDates);
      toast.success(`${weekDates.length} dias selecionados (Seg-Sáb)`);
    } else {
      toast.warning("Nenhuma data válida na semana do mês atual");
    }
  };

  const weekdayTranslations: Record<string, string> = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo",
  };

  const getDatesForWeekday = (weekday: string, periodStart: Date, periodEnd: Date): Date[] => {
    const weekdayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    };
    const targetDay = weekdayMap[weekday];
    const dates: Date[] = [];
    let current = new Date(periodStart);

    while (current <= periodEnd) {
      if (current.getDay() === targetDay) {
        dates.push(new Date(current));
      }
      current = addDays(current, 1);
    }

    return dates;
  };

  if (locationType === "internal") {
    return (
      <>
        <div className="space-y-6 w-full">
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-semibold">📅 Período de Funcionamento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Mês</Label>
                <Select 
                  value={periodForm.month.toString()} 
                  onValueChange={(v) => setPeriodForm({ ...periodForm, month: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Janeiro</SelectItem>
                    <SelectItem value="2">Fevereiro</SelectItem>
                    <SelectItem value="3">Março</SelectItem>
                    <SelectItem value="4">Abril</SelectItem>
                    <SelectItem value="5">Maio</SelectItem>
                    <SelectItem value="6">Junho</SelectItem>
                    <SelectItem value="7">Julho</SelectItem>
                    <SelectItem value="8">Agosto</SelectItem>
                    <SelectItem value="9">Setembro</SelectItem>
                    <SelectItem value="10">Outubro</SelectItem>
                    <SelectItem value="11">Novembro</SelectItem>
                    <SelectItem value="12">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  min="2024"
                  max="2030"
                  value={periodForm.year}
                  onChange={(e) => setPeriodForm({ ...periodForm, year: parseInt(e.target.value) || new Date().getFullYear() })}
                />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-6">
            <h3 className="text-lg font-semibold">⏰ Horários de Plantão</h3>
            
            <div className="space-y-6">
              {/* Segunda a Sexta com checkboxes individuais */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Segunda a Sexta</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedWeekdays(["monday", "tuesday", "wednesday", "thursday", "friday"])}
                  >
                    Selecionar Todos
                  </Button>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pb-3 border-b">
                  {[
                    { value: "monday", label: "Seg" },
                    { value: "tuesday", label: "Ter" },
                    { value: "wednesday", label: "Qua" },
                    { value: "thursday", label: "Qui" },
                    { value: "friday", label: "Sex" },
                  ].map((day) => {
                    const isSelected = selectedWeekdays.includes(day.value);
                    return (
                      <Button
                        key={day.value}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedWeekdays(selectedWeekdays.filter(d => d !== day.value));
                          } else {
                            setSelectedWeekdays([...selectedWeekdays, day.value]);
                          }
                        }}
                      >
                        {day.label}
                      </Button>
                    );
                  })}
                </div>

                {selectedWeekdays.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">🌅 Manhã</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Início</Label>
                          <Input
                            type="time"
                            value={internalSchedule.weekday_morning_start}
                            onChange={(e) => setInternalSchedule({ ...internalSchedule, weekday_morning_start: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fim</Label>
                          <Input
                            type="time"
                            value={internalSchedule.weekday_morning_end}
                            onChange={(e) => setInternalSchedule({ ...internalSchedule, weekday_morning_end: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">🌆 Tarde</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Início</Label>
                          <Input
                            type="time"
                            value={internalSchedule.weekday_afternoon_start}
                            onChange={(e) => setInternalSchedule({ ...internalSchedule, weekday_afternoon_start: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fim</Label>
                          <Input
                            type="time"
                            value={internalSchedule.weekday_afternoon_end}
                            onChange={(e) => setInternalSchedule({ ...internalSchedule, weekday_afternoon_end: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sábado */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={saturdayEnabled}
                    onCheckedChange={(checked) => setSaturdayEnabled(checked as boolean)}
                  />
                  <Label className="text-base font-medium">Sábado</Label>
                </div>
                {saturdayEnabled && (
                  <div className="space-y-2 pl-6">
                    <Label className="text-sm font-medium">🌅 Horário</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Início</Label>
                        <Input
                          type="time"
                          value={internalSchedule.saturday_start}
                          onChange={(e) => setInternalSchedule({ ...internalSchedule, saturday_start: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Fim</Label>
                        <Input
                          type="time"
                          value={internalSchedule.saturday_end}
                          onChange={(e) => setInternalSchedule({ ...internalSchedule, saturday_end: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Domingo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={sundayEnabled}
                    onCheckedChange={(checked) => setSundayEnabled(checked as boolean)}
                  />
                  <Label className="text-base font-medium">Domingo</Label>
                </div>
                {sundayEnabled && (
                  <div className="space-y-2 pl-6">
                    <Label className="text-sm font-medium">🌅 Horário</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Início</Label>
                        <Input
                          type="time"
                          value={internalSchedule.sunday_start}
                          onChange={(e) => setInternalSchedule({ ...internalSchedule, sunday_start: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Fim</Label>
                        <Input
                          type="time"
                          value={internalSchedule.sunday_end}
                          onChange={(e) => setInternalSchedule({ ...internalSchedule, sunday_end: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => handleCreatePeriod()}
              disabled={(selectedWeekdays.length === 0 && !saturdayEnabled && !sundayEnabled)}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Período
            </Button>
          </div>

          {periods && periods.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Períodos Configurados</h3>
              <div className="space-y-3">
                {periods.map((period) => {
                  const dayConfigs = dayConfigsByPeriod[period.id] || [];
                  const hasConfigs = dayConfigs.length > 0;
                  
                  // Calcular total de dias considerando ocorrências no período
                  let totalDays = 0;
                  if (hasConfigs) {
                    for (const dayConfig of dayConfigs) {
                      totalDays += countWeekdayOccurrences(
                        period.start_date,
                        period.end_date,
                        dayConfig.weekday
                      );
                    }
                  }
                  
                  return (
                    <Collapsible key={period.id}>
                      <div className="border rounded-lg p-3 space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              📅 {format(new Date(period.start_date + "T00:00:00"), "dd/MM/yyyy")} -{" "}
                              {format(new Date(period.end_date + "T00:00:00"), "dd/MM/yyyy")}
                            </span>
                            <Badge variant={hasConfigs ? "default" : "destructive"} className="text-xs">
                              {hasConfigs ? `✓ ${totalDays} dias` : "⚠ Sem configuração"}
                            </Badge>
                          </div>
                          
                          <div className="flex gap-1 flex-shrink-0">
                            {hasConfigs && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setExpandedPeriods(prev => ({ ...prev, [period.id]: !prev[period.id] }))}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditPeriod(period.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeletePeriod(period.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {expandedPeriods[period.id] && hasConfigs && (
                          <div className="pt-2 border-t space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Dias Configurados:</p>
                            {dayConfigs.map((config, idx) => {
                              const dates = getDatesForWeekday(
                                config.weekday,
                                new Date(period.start_date + "T00:00:00"),
                                new Date(period.end_date + "T00:00:00")
                              );
                              return (
                                <div key={idx} className="text-xs space-y-1 pl-2">
                                  <div className="font-medium">{weekdayTranslations[config.weekday]}:</div>
                                  <div className="text-muted-foreground ml-2">
                                    📅 {dates.map(d => format(d, "dd/MM", { locale: ptBR })).join(", ")}
                                  </div>
                                  <div className="text-muted-foreground ml-2">
                                    {config.has_morning && <Badge variant="outline" className="mr-1">☀️ {config.morning_start}-{config.morning_end}</Badge>}
                                    {config.has_afternoon && <Badge variant="outline">🌙 {config.afternoon_start}-{config.afternoon_end}</Badge>}
                                    <span className="ml-2 text-[10px]">({config.max_brokers_count} corretor{config.max_brokers_count > 1 ? "es" : ""})</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Diálogo de Configuração de Período Interno */}
        <InternalPeriodConfigDialog
          open={!!editingInternalPeriod}
          onOpenChange={(open) => {
            console.log(`🔄 InternalPeriodConfigDialog onOpenChange: ${open}`);
            if (!open) {
              setEditingInternalPeriod(null);
            }
          }}
          periodId={editingInternalPeriod?.id || ""}
          periodName={editingInternalPeriod?.name || ""}
        />
      </>
    );
  }

  // Interface para locais EXTERNOS
  return (
    <div className="space-y-4 w-full">
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-semibold">📅 Adicionar Período Mensal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Mês</Label>
            <Select 
              value={periodForm.month.toString()} 
              onValueChange={(v) => setPeriodForm({ ...periodForm, month: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Janeiro</SelectItem>
                <SelectItem value="2">Fevereiro</SelectItem>
                <SelectItem value="3">Março</SelectItem>
                <SelectItem value="4">Abril</SelectItem>
                <SelectItem value="5">Maio</SelectItem>
                <SelectItem value="6">Junho</SelectItem>
                <SelectItem value="7">Julho</SelectItem>
                <SelectItem value="8">Agosto</SelectItem>
                <SelectItem value="9">Setembro</SelectItem>
                <SelectItem value="10">Outubro</SelectItem>
                <SelectItem value="11">Novembro</SelectItem>
                <SelectItem value="12">Dezembro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Input
              type="number"
              min="2024"
              max="2030"
              value={periodForm.year}
              onChange={(e) => setPeriodForm({ ...periodForm, year: parseInt(e.target.value) || new Date().getFullYear() })}
            />
          </div>
        </div>
        <Button
          onClick={() => handleCreatePeriod()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Período
        </Button>
      </div>

      {periods && periods.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Períodos Configurados</h3>
          <div className="space-y-3">
            {periods.map((period) => {
              const dayConfigs = dayConfigsByPeriod[period.id] || [];
              const specificConfigs = specificDateConfigsByPeriod[period.id] || [];
              
              // ✅ PRIORIZAR configs específicas se existirem (independente do shift_config_mode)
              const isSpecificDateMode = currentLocation?.shift_config_mode === "specific_date";
              
              // Calcular total de dias
              let configCount = 0;
              if (specificConfigs.length > 0) {
                // ✅ Se tem configs específicas, contar elas (mesmo em modo weekday)
                configCount = specificConfigs.length;
              } else if (dayConfigs.length > 0) {
                // ✅ Se não tem configs específicas, calcular por dias da semana
                for (const dayConfig of dayConfigs) {
                  configCount += countWeekdayOccurrences(
                    period.start_date,
                    period.end_date,
                    dayConfig.weekday
                  );
                }
              }
              
              const hasConfigs = configCount > 0;
              
              return (
                <div key={period.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        📅 {format(new Date(period.start_date + "T00:00:00"), "dd/MM/yyyy")} -{" "}
                        {format(new Date(period.end_date + "T00:00:00"), "dd/MM/yyyy")}
                      </span>
                      <Badge variant={hasConfigs ? "default" : "destructive"} className="text-xs">
                        {hasConfigs ? `✓ ${configCount} dias` : "⚠ Sem dias"}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-1 flex-wrap">
                      {!hasConfigs && (
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => handleOpenCalendar(period.id)}
                        >
                          Configurar Dias
                        </Button>
                      )}
                      {hasConfigs && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setExpandedPeriods(prev => ({ ...prev, [period.id]: !prev[period.id] }))}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditPeriod(period.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeletePeriod(period.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {expandedPeriods[period.id] && hasConfigs && (
                    <div className="pt-2 border-t space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Dias Configurados:</p>
                      {isSpecificDateMode ? (
                        // Renderizar dias específicos para modo specific_date
                        specificConfigs.map((config, idx) => (
                          <div key={idx} className="text-xs space-y-1 pl-2 pb-2 border-b last:border-0">
                            <div className="font-medium">
                              📅 {format(new Date(config.specific_date + "T00:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                            </div>
                            <div className="text-muted-foreground ml-2">
                              {config.has_morning && <Badge variant="outline" className="mr-1">☀️ {config.morning_start}-{config.morning_end}</Badge>}
                              {config.has_afternoon && <Badge variant="outline">🌙 {config.afternoon_start}-{config.afternoon_end}</Badge>}
                              {config.max_brokers_count && <span className="ml-2 text-[10px]">({config.max_brokers_count} corretor{config.max_brokers_count > 1 ? "es" : ""})</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        // Renderizar dias da semana para modo weekday - buscar datas específicas configuradas
                        (() => {
                          const specificConfigs = specificDateConfigsByPeriod[period.id] || [];
                          
                          interface WeekdayGroup {
                            weekday: string;
                            dates: Date[];
                            config: {
                              has_morning: boolean;
                              has_afternoon: boolean;
                              morning_start: string;
                              morning_end: string;
                              afternoon_start: string;
                              afternoon_end: string;
                              max_brokers_count: number;
                            };
                          }
                          
                          // Agrupar por dia da semana
                          const groupedByWeekday = specificConfigs.reduce((acc, config) => {
                            const date = new Date(config.specific_date + "T00:00:00");
                            const day = getDay(date);
                            const weekdayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day];
                            
                            if (!acc[weekdayKey]) {
                              acc[weekdayKey] = {
                                weekday: weekdayKey,
                                dates: [],
                                config: config
                              };
                            }
                            acc[weekdayKey].dates.push(date);
                            return acc;
                          }, {} as Record<string, WeekdayGroup>);
                          
                          // Renderizar agrupado
                          return (Object.values(groupedByWeekday) as WeekdayGroup[]).map((group, idx) => (
                            <div key={idx} className="text-xs space-y-1 pl-2">
                              <div className="font-medium">{weekdayTranslations[group.weekday]}:</div>
                              <div className="text-muted-foreground ml-2">
                                📅 {group.dates.map(d => format(d, "dd/MM", { locale: ptBR })).join(", ")}
                              </div>
                              <div className="text-muted-foreground ml-2">
                                {group.config.has_morning && <Badge variant="outline" className="mr-1">☀️ {group.config.morning_start}-{group.config.morning_end}</Badge>}
                                {group.config.has_afternoon && <Badge variant="outline">🌙 {group.config.afternoon_start}-{group.config.afternoon_end}</Badge>}
                                <span className="ml-2 text-[10px]">({group.config.max_brokers_count} corretor{group.config.max_brokers_count > 1 ? "es" : ""})</span>
                              </div>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={calendarDialogOpen} onOpenChange={handleCloseCalendar}>
            <DialogContent className={`max-h-[90vh] overflow-y-auto overflow-x-hidden p-2 gap-0 w-[calc(100vw-2rem)] sm:w-full ${
              currentLocation?.shift_config_mode === "weekday" ? "max-w-[950px]" : "max-w-2xl"
            }`}>
          <div className="mb-2">
            <DialogTitle className="text-base">
              {editingPeriodId ? "Editar Dias com Plantão" : "Selecione os Dias com Plantão"} - {locationName}
            </DialogTitle>
          </div>

          {currentLocation?.shift_config_mode === "weekday" ? (
            // 2-column layout for weekday mode
            <div className="flex flex-col lg:flex-row gap-2">
              {/* Left: Calendar */}
              <div className="space-y-1 w-fit">
                <div className="flex gap-2 flex-wrap mb-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectWeek}
                  >
                    <CalendarDays className="mr-2 h-3 w-3" />
                    Selecionar Semana (Seg-Sáb)
                  </Button>
                </div>

                <Calendar
                  mode="multiple"
                  selected={selectedWeekdayDates}
                  onSelect={(dates) => {
                    setSelectedWeekdayDates(dates || []);
                  }}
                  showOutsideDays={false}
                  defaultMonth={getDefaultMonth()}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  fromDate={getPeriodRange().periodStart}
                  toDate={getPeriodRange().periodEnd}
                  disabled={(date) => {
                    const { periodStart, periodEnd } = getPeriodRange();
                    if (!periodStart || !periodEnd) return false;
                    return date < periodStart || date > periodEnd;
                  }}
                  locale={ptBR}
                  className="rounded-md border text-sm"
                />
                
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedWeekdayDates.length} dia(s)
                  {weekdayDates.length > 0 && ` • ${weekdayDates.length} seg-sex`}
                  {saturdayDates.length > 0 && ` • ${saturdayDates.length} sáb`}
                  {sundayDates.length > 0 && ` • ${sundayDates.length} dom`}
                </p>
              </div>

              {/* Right: Configuration Panels */}
              <div className="border-l pl-2 space-y-2 max-h-[600px] overflow-y-auto w-[550px] flex-shrink-0">
                {selectedWeekdayDates.length > 0 ? (
                  <>
                    {/* Painel 1: Seg-Sex */}
                    {weekdayDates.length > 0 && (
                      <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <div>
                          <h4 className="font-semibold text-sm">Configurar turnos (seg-sex)</h4>
                          <p className="text-xs text-muted-foreground">
                            {weekdayDates.length} dia(s) útil(eis)
                          </p>
                        </div>

                        {/* Manhã */}
                        <div className="space-y-2 p-2 border rounded bg-background">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="weekday_morning"
                              checked={tempWeekdayConfig.has_morning}
                              onCheckedChange={(checked) => 
                                setTempWeekdayConfig({ ...tempWeekdayConfig, has_morning: checked as boolean })
                              }
                            />
                            <Label htmlFor="weekday_morning" className="text-sm font-medium cursor-pointer">
                              Manhã
                            </Label>
                          </div>
                          {tempWeekdayConfig.has_morning && (
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  value={tempWeekdayConfig.morning_start}
                                  onChange={(e) => 
                                    setTempWeekdayConfig({ ...tempWeekdayConfig, morning_start: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Fim</Label>
                                <Input
                                  type="time"
                                  value={tempWeekdayConfig.morning_end}
                                  onChange={(e) => 
                                    setTempWeekdayConfig({ ...tempWeekdayConfig, morning_end: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tarde */}
                        <div className="space-y-2 p-2 border rounded bg-background">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="weekday_afternoon"
                              checked={tempWeekdayConfig.has_afternoon}
                              onCheckedChange={(checked) => 
                                setTempWeekdayConfig({ ...tempWeekdayConfig, has_afternoon: checked as boolean })
                              }
                            />
                            <Label htmlFor="weekday_afternoon" className="text-sm font-medium cursor-pointer">
                              Tarde
                            </Label>
                          </div>
                          {tempWeekdayConfig.has_afternoon && (
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  value={tempWeekdayConfig.afternoon_start}
                                  onChange={(e) => 
                                    setTempWeekdayConfig({ ...tempWeekdayConfig, afternoon_start: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Fim</Label>
                                <Input
                                  type="time"
                                  value={tempWeekdayConfig.afternoon_end}
                                  onChange={(e) => 
                                    setTempWeekdayConfig({ ...tempWeekdayConfig, afternoon_end: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Painel 2: Sábado */}
                    {saturdayDates.length > 0 && (
                      <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <div>
                          <h4 className="font-semibold text-sm">Configurar turnos sábado</h4>
                          <p className="text-xs text-muted-foreground">
                            {saturdayDates.length} sábado(s)
                          </p>
                        </div>

                        {/* Manhã */}
                        <div className="space-y-2 p-2 border rounded bg-background">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="saturday_morning"
                              checked={tempSaturdayConfig.has_morning}
                              onCheckedChange={(checked) => 
                                setTempSaturdayConfig({ ...tempSaturdayConfig, has_morning: checked as boolean })
                              }
                            />
                            <Label htmlFor="saturday_morning" className="text-sm font-medium cursor-pointer">
                              Manhã
                            </Label>
                          </div>
                          {tempSaturdayConfig.has_morning && (
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  value={tempSaturdayConfig.morning_start}
                                  onChange={(e) => 
                                    setTempSaturdayConfig({ ...tempSaturdayConfig, morning_start: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Fim</Label>
                                <Input
                                  type="time"
                                  value={tempSaturdayConfig.morning_end}
                                  onChange={(e) => 
                                    setTempSaturdayConfig({ ...tempSaturdayConfig, morning_end: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tarde */}
                        <div className="space-y-2 p-2 border rounded bg-background">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="saturday_afternoon"
                              checked={tempSaturdayConfig.has_afternoon}
                              onCheckedChange={(checked) => 
                                setTempSaturdayConfig({ ...tempSaturdayConfig, has_afternoon: checked as boolean })
                              }
                            />
                            <Label htmlFor="saturday_afternoon" className="text-sm font-medium cursor-pointer">
                              Tarde
                            </Label>
                          </div>
                          {tempSaturdayConfig.has_afternoon && (
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  value={tempSaturdayConfig.afternoon_start}
                                  onChange={(e) => 
                                    setTempSaturdayConfig({ ...tempSaturdayConfig, afternoon_start: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Fim</Label>
                                <Input
                                  type="time"
                                  value={tempSaturdayConfig.afternoon_end}
                                  onChange={(e) => 
                                    setTempSaturdayConfig({ ...tempSaturdayConfig, afternoon_end: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Painel 3: Domingo */}
                    {sundayDates.length > 0 && (
                      <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <div>
                          <h4 className="font-semibold text-sm">Configurar turno domingo</h4>
                          <p className="text-xs text-muted-foreground">
                            {sundayDates.length} domingo(s)
                          </p>
                        </div>

                        {/* Manhã */}
                        <div className="space-y-2 p-2 border rounded bg-background">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="sunday_morning"
                              checked={tempSundayConfig.has_morning}
                              onCheckedChange={(checked) => 
                                setTempSundayConfig({ ...tempSundayConfig, has_morning: checked as boolean })
                              }
                            />
                            <Label htmlFor="sunday_morning" className="text-sm font-medium cursor-pointer">
                              Manhã
                            </Label>
                          </div>
                          {tempSundayConfig.has_morning && (
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  value={tempSundayConfig.morning_start}
                                  onChange={(e) => 
                                    setTempSundayConfig({ ...tempSundayConfig, morning_start: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Fim</Label>
                                <Input
                                  type="time"
                                  value={tempSundayConfig.morning_end}
                                  onChange={(e) => 
                                    setTempSundayConfig({ ...tempSundayConfig, morning_end: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tarde */}
                        <div className="space-y-2 p-2 border rounded bg-background">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="sunday_afternoon"
                              checked={tempSundayConfig.has_afternoon}
                              onCheckedChange={(checked) => 
                                setTempSundayConfig({ ...tempSundayConfig, has_afternoon: checked as boolean })
                              }
                            />
                            <Label htmlFor="sunday_afternoon" className="text-sm font-medium cursor-pointer">
                              Tarde
                            </Label>
                          </div>
                          {tempSundayConfig.has_afternoon && (
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Início</Label>
                                <Input
                                  type="time"
                                  value={tempSundayConfig.afternoon_start}
                                  onChange={(e) => 
                                    setTempSundayConfig({ ...tempSundayConfig, afternoon_start: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Fim</Label>
                                <Input
                                  type="time"
                                  value={tempSundayConfig.afternoon_end}
                                  onChange={(e) => 
                                    setTempSundayConfig({ ...tempSundayConfig, afternoon_end: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={handleCloseCalendar} className="flex-1 h-9 text-sm">
                        Cancelar
                      </Button>
                      <Button 
                        onClick={async () => {
                          if (selectedWeekdayDates.length === 0) {
                            toast.error("Selecione pelo menos um dia");
                            return;
                          }

                          // Validar se pelo menos um turno foi configurado para cada tipo de dia selecionado
                          if (weekdayDates.length > 0 && !tempWeekdayConfig.has_morning && !tempWeekdayConfig.has_afternoon) {
                            toast.error("Configure pelo menos um turno para os dias úteis");
                            return;
                          }
                          if (saturdayDates.length > 0 && !tempSaturdayConfig.has_morning && !tempSaturdayConfig.has_afternoon) {
                            toast.error("Configure pelo menos um turno para sábado");
                            return;
                          }
                          if (sundayDates.length > 0 && !tempSundayConfig.has_morning && !tempSundayConfig.has_afternoon) {
                            toast.error("Configure pelo menos um turno para domingo");
                            return;
                          }

                          try {
                            const periodId = editingPeriodId || createdPeriodId;
                            const weekdayMap: Record<number, string> = {
                              0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
                              4: "thursday", 5: "friday", 6: "saturday",
                            };

                            // 1️⃣ Processar dias úteis (seg-sex)
                            if (weekdayDates.length > 0) {
                              const uniqueWeekdays = Array.from(
                                new Set(weekdayDates.map(d => weekdayMap[getDay(d)]))
                              );

                              // Salvar em period_day_configs
                              for (const weekday of uniqueWeekdays) {
                                const { error } = await supabase
                                  .from("period_day_configs")
                                  .upsert({
                                    period_id: periodId,
                                    weekday: weekday,
                                    has_morning: tempWeekdayConfig.has_morning,
                                    has_afternoon: tempWeekdayConfig.has_afternoon,
                                    morning_start: tempWeekdayConfig.morning_start,
                                    morning_end: tempWeekdayConfig.morning_end,
                                    afternoon_start: tempWeekdayConfig.afternoon_start,
                                    afternoon_end: tempWeekdayConfig.afternoon_end,
                                    max_brokers_count: 1,
                                  }, {
                                    onConflict: "period_id,weekday"
                                  });
                                if (error) throw error;
                              }

                              // Salvar em period_specific_day_configs
                              const weekdayConfigs = weekdayDates.map(date => ({
                                period_id: periodId,
                                specific_date: format(date, "yyyy-MM-dd"),
                                has_morning: tempWeekdayConfig.has_morning,
                                has_afternoon: tempWeekdayConfig.has_afternoon,
                                morning_start: tempWeekdayConfig.morning_start,
                                morning_end: tempWeekdayConfig.morning_end,
                                afternoon_start: tempWeekdayConfig.afternoon_start,
                                afternoon_end: tempWeekdayConfig.afternoon_end,
                                max_brokers_count: 1,
                              }));

                              const { error: weekdayError } = await supabase
                                .from("period_specific_day_configs")
                                .upsert(weekdayConfigs, {
                                  onConflict: "period_id,specific_date"
                                });
                              if (weekdayError) throw weekdayError;
                            }

                            // 2️⃣ Processar sábados
                            if (saturdayDates.length > 0) {
                              const { error } = await supabase
                                .from("period_day_configs")
                                .upsert({
                                  period_id: periodId,
                                  weekday: "saturday",
                                  has_morning: tempSaturdayConfig.has_morning,
                                  has_afternoon: tempSaturdayConfig.has_afternoon,
                                  morning_start: tempSaturdayConfig.morning_start,
                                  morning_end: tempSaturdayConfig.morning_end,
                                  afternoon_start: tempSaturdayConfig.afternoon_start,
                                  afternoon_end: tempSaturdayConfig.afternoon_end,
                                  max_brokers_count: 1,
                                }, {
                                  onConflict: "period_id,weekday"
                                });
                              if (error) throw error;

                              const saturdayConfigs = saturdayDates.map(date => ({
                                period_id: periodId,
                                specific_date: format(date, "yyyy-MM-dd"),
                                has_morning: tempSaturdayConfig.has_morning,
                                has_afternoon: tempSaturdayConfig.has_afternoon,
                                morning_start: tempSaturdayConfig.morning_start,
                                morning_end: tempSaturdayConfig.morning_end,
                                afternoon_start: tempSaturdayConfig.afternoon_start,
                                afternoon_end: tempSaturdayConfig.afternoon_end,
                                max_brokers_count: 1,
                              }));

                              const { error: saturdayError } = await supabase
                                .from("period_specific_day_configs")
                                .upsert(saturdayConfigs, {
                                  onConflict: "period_id,specific_date"
                                });
                              if (saturdayError) throw saturdayError;
                            }

                            // 3️⃣ Processar domingos
                            if (sundayDates.length > 0) {
                              const { error } = await supabase
                                .from("period_day_configs")
                                .upsert({
                                  period_id: periodId,
                                  weekday: "sunday",
                                  has_morning: tempSundayConfig.has_morning,
                                  has_afternoon: tempSundayConfig.has_afternoon,
                                  morning_start: tempSundayConfig.morning_start,
                                  morning_end: tempSundayConfig.morning_end,
                                  afternoon_start: tempSundayConfig.afternoon_start,
                                  afternoon_end: tempSundayConfig.afternoon_end,
                                  max_brokers_count: 1,
                                }, {
                                  onConflict: "period_id,weekday"
                                });
                              if (error) throw error;

                              const sundayConfigs = sundayDates.map(date => ({
                                period_id: periodId,
                                specific_date: format(date, "yyyy-MM-dd"),
                                has_morning: tempSundayConfig.has_morning,
                                has_afternoon: tempSundayConfig.has_afternoon,
                                morning_start: tempSundayConfig.morning_start,
                                morning_end: tempSundayConfig.morning_end,
                                afternoon_start: tempSundayConfig.afternoon_start,
                                afternoon_end: tempSundayConfig.afternoon_end,
                                max_brokers_count: 1,
                              }));

                              const { error: sundayError } = await supabase
                                .from("period_specific_day_configs")
                                .upsert(sundayConfigs, {
                                  onConflict: "period_id,specific_date"
                                });
                              if (sundayError) throw sundayError;
                            }

                            toast.success(`${selectedWeekdayDates.length} dia(s) configurado(s)!`);

                            await queryClient.invalidateQueries({ 
                              queryKey: ["period-day-configs", locationId] 
                            });
                            await queryClient.invalidateQueries({ 
                              queryKey: ["period-specific-day-configs", locationId] 
                            });
                            await queryClient.invalidateQueries({ 
                              queryKey: ["locations"] 
                            });

                            handleCloseCalendar();
                          } catch (error) {
                            console.error(error);
                            toast.error("Erro ao salvar configurações");
                          }
                        }}
                        className="flex-1 h-9 text-sm"
                      >
                        Salvar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Selecione dias no calendário para configurar</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Original 1-column layout for specific_date mode
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione todos os dias do mês que terão plantão neste local.
                {editingPeriodId && " (Os dias já configurados aparecerão pré-selecionados)"}
              </p>
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSelectWeek}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Selecionar Semana (Seg-Sáb)
                </Button>
              </div>

              <Calendar
                mode="multiple"
                selected={selectedDays}
                onDayClick={(day, modifiers) => {
                  // Ignorar dias desabilitados
                  if (modifiers.disabled) return;
                  
                  // Abrir dialog diretamente com o dia clicado
                  setEditingSpecificDate(day);
                  setSpecificDateDialogOpen(true);
                }}
                onSelect={(days) => {
                  // Apenas sincronizar selectedDays com dias salvos
                  const savedDays = specificDateConfigs
                    ?.filter((c: any) => c.period_id === (editingPeriodId || createdPeriodId))
                    ?.map((c: any) => new Date(c.specific_date + "T00:00:00")) || [];
                  
                  setSelectedDays(savedDays);
                }}
                modifiers={{
                  configured: specificDateConfigs
                    ?.filter((c: any) => c.period_id === (editingPeriodId || createdPeriodId))
                    ?.map((c: any) => new Date(c.specific_date + "T00:00:00")) || []
                }}
                modifiersClassNames={{
                  configured: "bg-blue-100 dark:bg-blue-900 font-semibold"
                }}
                showOutsideDays={false}
                defaultMonth={getDefaultMonth()}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                fromDate={getPeriodRange().periodStart}
                toDate={getPeriodRange().periodEnd}
                disabled={(date) => {
                  const { periodStart, periodEnd } = getPeriodRange();
                  if (!periodStart || !periodEnd) return false;
                  return date < periodStart || date > periodEnd;
                }}
                locale={ptBR}
                className="rounded-md border pointer-events-auto mx-auto"
              />
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {specificDateConfigs?.filter((c: any) => c.period_id === createdPeriodId).length || 0} dia(s) configurado(s)
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={handleCloseCalendar} className="flex-1 sm:flex-none">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleConfirmDays}
                    disabled={createDayConfigsMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    Concluir Configuração
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Specific Date Shift Configuration Dialog */}
            <SpecificDateShiftDialog
              open={specificDateDialogOpen}
              onOpenChange={setSpecificDateDialogOpen}
              date={editingSpecificDate}
              onSave={handleSaveSpecificDateConfig}
              onDelete={handleDeleteSpecificDateConfig}
              hasExistingConfig={editingSpecificDate ? !!getConfigForDate(editingSpecificDate) : false}
              initialConfig={
                editingSpecificDate
                  ? getConfigForDate(editingSpecificDate) || undefined
                  : undefined
              }
              suggestedConfig={
                editingSpecificDate && !getConfigForDate(editingSpecificDate)
                  ? getSuggestedConfigForDate(editingSpecificDate)
                  : undefined
              }
              suggestedFromLabel={inheritedFromLabel}
            />
    </div>
  );
}
