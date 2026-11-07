import { useState, useEffect, useMemo } from "react";
import { buildExcludedShiftsMap, isShiftExcludedFor } from "@/lib/schedulePostValidation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeText } from "@/lib/textUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MapPin, User, ChevronLeft, Sun, Moon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Assignment {
  id?: string;
  broker_id: string;
  location_id: string;
  assignment_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  broker?: { id: string; name: string; creci: string };
  location?: { id: string; name: string; location_type: string; city: string };
}

interface AddAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: string;
  weekEnd: string;
  allAssignments: Assignment[];
  generatedScheduleId: string;
  onSave: (data: {
    brokerId: string;
    locationId: string;
    date: string;
    shift: string;
    startTime: string;
    endTime: string;
  }) => void;
}

interface Broker {
  id: string;
  name: string;
  creci: string;
  is_active: boolean;
  available_weekdays: string[];
}

interface DaySlot {
  date: string;
  dayName: string;
  shortDate: string;
  morningAssignment: Assignment | null;
  afternoonAssignment: Assignment | null;
  isAvailableDay: boolean;
}

interface LocationOption {
  id: string;
  name: string;
  location_type: string;
  city: string;
  startTime: string;
  endTime: string;
  isEligible: boolean;
  currentAssignment: Assignment | null;
}

export function AddAssignmentDialog({
  open,
  onOpenChange,
  weekStart,
  weekEnd,
  allAssignments,
  generatedScheduleId,
  onSave,
}: AddAssignmentDialogProps) {
  const [step, setStep] = useState<"broker" | "dayshift" | "location">("broker");
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<"morning" | "afternoon" | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Alert dialog states
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertType, setAlertType] = useState<"not_eligible" | "location_occupied" | "broker_occupied" | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("broker");
      setSelectedBroker(null);
      setSelectedDate(null);
      setSelectedShift(null);
      setSelectedLocation(null);
      setSearchTerm("");
      setAlertDialogOpen(false);
      setAlertType(null);
    }
  }, [open]);

  // Fetch all active brokers
  const { data: brokers, isLoading: loadingBrokers } = useQuery({
    queryKey: ["brokers-for-add-dialog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brokers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Broker[];
    },
    enabled: open,
  });

  // Calculate empty slots for each broker
  const brokersWithSlots = useMemo(() => {
    if (!brokers || !weekStart || !weekEnd) return [];
    
    const weekDays = eachDayOfInterval({
      start: parseISO(weekStart),
      end: parseISO(weekEnd)
    });
    
    const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    
    return brokers.map(broker => {
      const brokerAssignments = allAssignments.filter(a => a.broker_id === broker.id);
      
      // Calculate possible slots based on available_weekdays
      let possibleSlots = 0;
      weekDays.forEach(day => {
        const dayName = weekdayNames[day.getDay()];
        if (broker.available_weekdays?.includes(dayName)) {
          possibleSlots += 2; // morning + afternoon
        }
      });
      
      const occupiedSlots = brokerAssignments.length;
      const emptySlots = Math.max(0, possibleSlots - occupiedSlots);
      
      return {
        ...broker,
        possibleSlots,
        occupiedSlots,
        emptySlots
      };
    }).sort((a, b) => b.emptySlots - a.emptySlots);
  }, [brokers, weekStart, weekEnd, allAssignments]);

  // Filter brokers by search (com normalização de acentos)
  const normalizedBrokerSearch = normalizeText(searchTerm);
  const filteredBrokers = brokersWithSlots.filter(broker =>
    normalizeText(broker.name).includes(normalizedBrokerSearch) ||
    normalizeText(broker.creci).includes(normalizedBrokerSearch)
  );

  // Generate day slots for selected broker
  const daySlots: DaySlot[] = useMemo(() => {
    if (!selectedBroker || !weekStart || !weekEnd) return [];
    
    const weekDays = eachDayOfInterval({
      start: parseISO(weekStart),
      end: parseISO(weekEnd)
    });
    
    const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    
    return weekDays.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayName = weekdayNames[day.getDay()];
      
      const morningAssignment = allAssignments.find(
        a => a.broker_id === selectedBroker.id && a.assignment_date === dateStr && a.shift_type === "morning"
      ) || null;
      
      const afternoonAssignment = allAssignments.find(
        a => a.broker_id === selectedBroker.id && a.assignment_date === dateStr && a.shift_type === "afternoon"
      ) || null;
      
      return {
        date: dateStr,
        dayName: format(day, "EEEE", { locale: ptBR }),
        shortDate: format(day, "dd/MM"),
        morningAssignment,
        afternoonAssignment,
        isAvailableDay: selectedBroker.available_weekdays?.includes(dayName) ?? false
      };
    });
  }, [selectedBroker, weekStart, weekEnd, allAssignments]);

  // Fetch locations for selected day/shift
  const { data: availableLocations, isLoading: loadingLocations } = useQuery({
    queryKey: ["locations-for-add", selectedDate, selectedShift, selectedBroker?.id],
    queryFn: async () => {
      if (!selectedDate || !selectedShift) return [];
      
      const dayOfWeekNum = new Date(selectedDate + "T00:00:00").getDay();
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayOfWeek = weekdays[dayOfWeekNum];

      // Fetch locations with their configurations
      const { data: locations, error } = await supabase
        .from("locations")
        .select(`
          id, name, location_type, city, morning_start, morning_end, afternoon_start, afternoon_end,
          location_periods (
            id, start_date, end_date,
            period_day_configs (weekday, has_morning, has_afternoon, morning_start, morning_end, afternoon_start, afternoon_end)
          ),
          location_brokers (
            broker_id, available_morning, available_afternoon
          )
        `)
        .eq("is_active", true);

      if (error) throw error;

      // Fetch specific day configs
      const { data: specificConfigs } = await supabase
        .from("period_specific_day_configs")
        .select("*")
        .eq("specific_date", selectedDate);

      const { data: whitelistRows } = await supabase
        .from("period_specific_day_configs")
        .select("period_id");
      const periodsWithSpecific = new Set((whitelistRows || []).map((r: any) => r.period_id));

      // Feriados / datas excluídas nesta data
      const { data: excludedRows } = await supabase
        .from("period_excluded_dates")
        .select("period_id, excluded_date, excluded_shifts")
        .eq("excluded_date", selectedDate);
      const periodToLocation = new Map<string, string>();
      locations?.forEach((l: any) => (l.location_periods || []).forEach((p: any) => periodToLocation.set(p.id, l.id)));
      const excludedMap = buildExcludedShiftsMap((excludedRows || []) as any, periodToLocation);

      // Filter locations that have shifts configured for this day
      const validLocations = locations?.filter((loc: any) => {
        if (isShiftExcludedFor(excludedMap, null, loc.id, selectedDate, selectedShift)) return false;
        const specificConfig = specificConfigs?.find((sc: any) => {
          const period = loc.location_periods?.find((p: any) => p.id === sc.period_id);
          return period !== undefined;
        });

        if (specificConfig) {
          return selectedShift === "morning" 
            ? specificConfig.has_morning 
            : specificConfig.has_afternoon;
        }

        const currentDate = new Date(selectedDate + "T00:00:00");
        const period = loc.location_periods?.find((p: any) => {
          const start = new Date(p.start_date + "T00:00:00");
          const end = new Date(p.end_date + "T00:00:00");
          return currentDate >= start && currentDate <= end;
        });

        if (!period) return false;
        if (periodsWithSpecific.has(period.id)) return false;

        const dayConfig = period.period_day_configs?.find((dc: any) => dc.weekday === dayOfWeek);
        if (!dayConfig) return false;

        return selectedShift === "morning" 
          ? dayConfig.has_morning 
          : dayConfig.has_afternoon;
      });

      // Map locations with additional info
      return validLocations?.map((loc: any) => {
        const specificConfig = specificConfigs?.find((sc: any) => {
          const period = loc.location_periods?.find((p: any) => p.id === sc.period_id);
          return period !== undefined;
        });

        let startTime = "08:00";
        let endTime = "12:00";

        if (specificConfig) {
          startTime = selectedShift === "morning" 
            ? specificConfig.morning_start?.substring(0, 5) || "08:00"
            : specificConfig.afternoon_start?.substring(0, 5) || "13:00";
          endTime = selectedShift === "morning"
            ? specificConfig.morning_end?.substring(0, 5) || "12:00"
            : specificConfig.afternoon_end?.substring(0, 5) || "18:00";
        } else {
          const currentDate = new Date(selectedDate + "T00:00:00");
          const period = loc.location_periods?.find((p: any) => {
            const start = new Date(p.start_date + "T00:00:00");
            const end = new Date(p.end_date + "T00:00:00");
            return currentDate >= start && currentDate <= end;
          });

          const dayConfig = period?.period_day_configs?.find((dc: any) => dc.weekday === dayOfWeek);
          
          if (dayConfig) {
            startTime = selectedShift === "morning"
              ? dayConfig.morning_start?.substring(0, 5) || "08:00"
              : dayConfig.afternoon_start?.substring(0, 5) || "13:00";
            endTime = selectedShift === "morning"
              ? dayConfig.morning_end?.substring(0, 5) || "12:00"
              : dayConfig.afternoon_end?.substring(0, 5) || "18:00";
          }
        }

        // Check if broker is eligible for this location
        const brokerEligibility = loc.location_brokers?.find(
          (lb: any) => lb.broker_id === selectedBroker?.id
        );
        const isEligible = brokerEligibility 
          ? (selectedShift === "morning" ? brokerEligibility.available_morning : brokerEligibility.available_afternoon)
          : false;

        // Check if location already has assignment
        const currentAssignment = allAssignments.find(
          a => a.location_id === loc.id && a.assignment_date === selectedDate && a.shift_type === selectedShift
        ) || null;

        return {
          id: loc.id,
          name: loc.name,
          location_type: loc.location_type,
          city: loc.city,
          startTime,
          endTime,
          isEligible,
          currentAssignment
        } as LocationOption;
      }) || [];
    },
    enabled: open && step === "location" && !!selectedDate && !!selectedShift,
  });

  // Filter locations by search (com normalização de acentos)
  const normalizedLocationSearch = normalizeText(searchTerm);
  const filteredLocations = (availableLocations || []).filter(loc =>
    normalizeText(loc.name).includes(normalizedLocationSearch) ||
    normalizeText(loc.city || "").includes(normalizedLocationSearch)
  );

  // Handlers
  const handleBrokerSelect = (broker: Broker & { emptySlots: number }) => {
    setSelectedBroker(broker);
    setStep("dayshift");
    setSearchTerm("");
  };

  const handleSlotSelect = (date: string, shift: "morning" | "afternoon", currentAssignment: Assignment | null) => {
    setSelectedDate(date);
    setSelectedShift(shift);
    
    if (currentAssignment) {
      // Broker already has assignment at this time
      setAlertType("broker_occupied");
      setAlertDialogOpen(true);
    } else {
      setStep("location");
      setSearchTerm("");
    }
  };

  const handleLocationSelect = (location: LocationOption) => {
    setSelectedLocation(location);
    
    // ✅ Se for plantão INTERNO, salvar diretamente sem verificações
    if (location.location_type === "internal") {
      saveAssignment(location);
      return;
    }
    
    // Verificações apenas para plantões EXTERNOS
    if (!location.isEligible && location.currentAssignment) {
      setAlertType("not_eligible");
      setAlertDialogOpen(true);
    } else if (location.currentAssignment) {
      setAlertType("location_occupied");
      setAlertDialogOpen(true);
    } else if (!location.isEligible) {
      setAlertType("not_eligible");
      setAlertDialogOpen(true);
    } else {
      // No warnings, save directly
      saveAssignment(location);
    }
  };

  const saveAssignment = (location: LocationOption) => {
    if (!selectedBroker || !selectedDate || !selectedShift) return;
    
    onSave({
      brokerId: selectedBroker.id,
      locationId: location.id,
      date: selectedDate,
      shift: selectedShift,
      startTime: location.startTime,
      endTime: location.endTime,
    });
    onOpenChange(false);
  };

  const handleConfirmAlert = () => {
    if (selectedLocation) {
      saveAssignment(selectedLocation);
    } else if (alertType === "broker_occupied") {
      // Continue to location selection anyway
      setStep("location");
      setSearchTerm("");
    }
    setAlertDialogOpen(false);
    setAlertType(null);
  };

  const goBack = () => {
    if (step === "location") {
      setStep("dayshift");
      setSelectedDate(null);
      setSelectedShift(null);
      setSearchTerm("");
    } else if (step === "dayshift") {
      setStep("broker");
      setSelectedBroker(null);
      setSearchTerm("");
    }
  };

  const weekLabel = weekStart && weekEnd 
    ? `${format(parseISO(weekStart), "dd/MM")} - ${format(parseISO(weekEnd), "dd/MM/yyyy")}`
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Adicionar Alocação</DialogTitle>
            <DialogDescription>
              Escala: {weekLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Step 1: Broker Selection */}
            {step === "broker" && (
              <>
                <div>
                  <Label htmlFor="search-broker">Buscar Corretor</Label>
                  <Input
                    id="search-broker"
                    placeholder="Nome ou CRECI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">
                    Selecione um corretor (ordenado por slots vazios)
                  </Label>
                  {loadingBrokers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] mt-2 border rounded-md">
                      <div className="p-2 space-y-1">
                        {filteredBrokers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum corretor encontrado
                          </p>
                        ) : (
                          filteredBrokers.map((broker) => (
                            <button
                              key={broker.id}
                              onClick={() => handleBrokerSelect(broker)}
                              className="w-full p-3 text-left rounded-md transition-colors hover:bg-accent"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <span className="font-medium">{broker.name}</span>
                                    <p className="text-xs text-muted-foreground">CRECI: {broker.creci}</p>
                                  </div>
                                </div>
                                <Badge 
                                  variant={broker.emptySlots > 0 ? "outline" : "secondary"}
                                  className={broker.emptySlots > 5 ? "border-amber-500 text-amber-600" : ""}
                                >
                                  {broker.emptySlots} slots vazios
                                </Badge>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </>
            )}

            {/* Step 2: Day/Shift Selection */}
            {step === "dayshift" && selectedBroker && (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Corretor Selecionado:</p>
                      <p className="font-semibold">{selectedBroker.name}</p>
                      <p className="text-xs text-muted-foreground">CRECI: {selectedBroker.creci}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={goBack}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Trocar
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">
                    Selecione o dia e turno
                  </Label>
                  <ScrollArea className="h-[280px] mt-2">
                    <div className="space-y-2 pr-4">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.date}
                          className={`p-2 border rounded-lg ${!slot.isAvailableDay ? "opacity-50 bg-muted" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize text-sm">{slot.dayName}</span>
                            <span className="text-xs text-muted-foreground">{slot.shortDate}</span>
                          </div>
                          
                          {!slot.isAvailableDay ? (
                            <p className="text-xs text-muted-foreground italic">Não disponível neste dia</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {/* Morning */}
                              <button
                                onClick={() => handleSlotSelect(slot.date, "morning", slot.morningAssignment)}
                                className={`p-2 rounded-md text-left text-sm transition-colors ${
                                  slot.morningAssignment
                                    ? "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900"
                                    : "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900"
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <Sun className="h-3 w-3" />
                                  <span>Manhã</span>
                                </div>
                                {slot.morningAssignment ? (
                                  <p className="text-xs text-amber-600 mt-1 truncate">
                                    {slot.morningAssignment.location?.name}
                                  </p>
                                ) : (
                                  <p className="text-xs text-green-600 mt-1">Vazio</p>
                                )}
                              </button>

                              {/* Afternoon */}
                              <button
                                onClick={() => handleSlotSelect(slot.date, "afternoon", slot.afternoonAssignment)}
                                className={`p-2 rounded-md text-left text-sm transition-colors ${
                                  slot.afternoonAssignment
                                    ? "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900"
                                    : "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900"
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <Moon className="h-3 w-3" />
                                  <span>Tarde</span>
                                </div>
                                {slot.afternoonAssignment ? (
                                  <p className="text-xs text-amber-600 mt-1 truncate">
                                    {slot.afternoonAssignment.location?.name}
                                  </p>
                                ) : (
                                  <p className="text-xs text-green-600 mt-1">Vazio</p>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {/* Step 3: Location Selection */}
            {step === "location" && selectedBroker && selectedDate && selectedShift && (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{selectedBroker.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedDate), "EEEE, dd/MM", { locale: ptBR })} • {selectedShift === "morning" ? "Manhã" : "Tarde"}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={goBack}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Voltar
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="search-location">Buscar Local</Label>
                  <Input
                    id="search-location"
                    placeholder="Nome ou cidade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">
                    Locais disponíveis para este dia/turno
                  </Label>
                  {loadingLocations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[250px] mt-2 border rounded-md">
                      <div className="p-2 space-y-1">
                        {filteredLocations.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum local encontrado para este dia/turno
                          </p>
                        ) : (
                          filteredLocations.map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleLocationSelect(loc)}
                              className={`w-full p-3 text-left rounded-md transition-colors ${
                                loc.currentAssignment && loc.location_type !== "internal"
                                  ? "hover:bg-amber-50 dark:hover:bg-amber-950 border border-amber-200 dark:border-amber-800"
                                  : "hover:bg-accent"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{loc.name}</span>
                                    <Badge variant={loc.location_type === "external" ? "default" : "secondary"} className="text-xs">
                                      {loc.location_type === "external" ? "Ext" : "Int"}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground ml-6">
                                    {loc.city} • {loc.startTime} - {loc.endTime}
                                  </p>
                                  {/* Status indicators - only for external locations */}
                                  {loc.location_type !== "internal" && (
                                    <div className="flex items-center gap-2 ml-6 mt-1">
                                      {loc.isEligible ? (
                                        <span className="text-xs text-green-600 flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Corretor elegível
                                        </span>
                                      ) : (
                                        <span className="text-xs text-amber-600 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          Não está na lista
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {/* Occupied badge - only for external locations */}
                                {loc.currentAssignment && loc.location_type !== "internal" && (
                                  <div className="text-right">
                                    <Badge variant="outline" className="text-amber-600 border-amber-400">
                                      Ocupado
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {loc.currentAssignment.broker?.name}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog for warnings */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Atenção
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertType === "broker_occupied" && (
                <>
                  O corretor <strong>{selectedBroker?.name}</strong> já possui uma alocação neste dia/turno.
                  <br /><br />
                  Ao continuar, você poderá selecionar um local e a alocação anterior será mantida 
                  (o corretor ficará com duas alocações no mesmo horário).
                </>
              )}
              {alertType === "not_eligible" && selectedLocation && (
                <>
                  O corretor <strong>{selectedBroker?.name}</strong> não está na lista de corretores elegíveis 
                  para o local <strong>{selectedLocation.name}</strong>.
                  {selectedLocation.currentAssignment && (
                    <>
                      <br /><br />
                      Além disso, este local já possui <strong>{selectedLocation.currentAssignment.broker?.name}</strong> alocado.
                      O corretor <strong>{selectedBroker?.name}</strong> será <strong>adicionado</strong> ao mesmo local (ambos ficarão alocados).
                    </>
                  )}
                  <br /><br />
                  Deseja continuar mesmo assim?
                </>
              )}
              {alertType === "location_occupied" && selectedLocation && !selectedLocation.isEligible === false && (
                <>
                  O local <strong>{selectedLocation.name}</strong> já possui{" "}
                  <strong>{selectedLocation.currentAssignment?.broker?.name}</strong> alocado neste turno.
                  <br /><br />
                  Ao continuar, <strong>{selectedBroker?.name}</strong> será <strong>adicionado</strong> ao local (ambos os corretores ficarão alocados).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAlert}>
              Sim, Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
