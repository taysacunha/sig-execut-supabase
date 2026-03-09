import { useMemo, useState, useEffect, useCallback } from "react";
import { format, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare } from "lucide-react";
interface ScheduleAssignment {
  id?: string;
  broker?: any;
  location?: any;
  assignment_date: string;
  shift_type: "morning" | "afternoon";
  start_time: string;
  end_time: string;
}

interface ScheduleCalendarViewProps {
  assignments: ScheduleAssignment[];
  scheduleWeekStart?: string;
  scheduleWeekEnd?: string;
  scheduleId?: string;
}

const weekdaysMap: Record<string, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
  sunday: "Dom",
};

export function ScheduleCalendarView({ assignments, scheduleWeekStart, scheduleWeekEnd, scheduleId }: ScheduleCalendarViewProps) {
  const queryClient = useQueryClient();
  const [observationText, setObservationText] = useState("");
  const [observationDirty, setObservationDirty] = useState(false);

  // Load existing observation
  const { data: savedObservation } = useQuery({
    queryKey: ["schedule-observation", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null;
      const { data, error } = await supabase
        .from("schedule_observations" as any)
        .select("*")
        .eq("schedule_id", scheduleId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!scheduleId,
  });

  useEffect(() => {
    if (savedObservation) {
      setObservationText(savedObservation.content || "");
    } else {
      setObservationText("");
    }
  }, [savedObservation]);

  // Auto-save mutation
  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!scheduleId) return;
      const { error } = await supabase
        .from("schedule_observations" as any)
        .upsert({ schedule_id: scheduleId, content } as any, { onConflict: "schedule_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-observation", scheduleId] });
    },
  });

  const handleObservationChange = useCallback((value: string) => {
    setObservationText(value);
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(() => {
      saveMutation.mutate(value);
    }, 1000);
    setSaveTimeout(timeout);
  }, [saveTimeout, saveMutation]);
  // Buscar todos os corretores ativos do banco
  const { data: activeBrokers } = useQuery({
    queryKey: ["active-brokers-for-calendar"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brokers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const processedData = useMemo(() => {
    // Priorizar datas fornecidas do schedule
    const weekStart = scheduleWeekStart 
      ? new Date(scheduleWeekStart + "T00:00:00")
      : (assignments.length > 0 
          ? new Date(Math.min(...assignments.map(a => new Date(a.assignment_date + "T00:00:00").getTime())))
          : null);
        
    const weekEnd = scheduleWeekEnd
      ? new Date(scheduleWeekEnd + "T00:00:00")
      : (assignments.length > 0
          ? new Date(Math.max(...assignments.map(a => new Date(a.assignment_date + "T00:00:00").getTime())))
          : null);

    if (!weekStart || !weekEnd) {
      return { brokerSchedule: {}, weekDays: [], uniqueLocations: [], weekStart: null, weekEnd: null };
    }

    const allDates = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const weekDays = allDates.map(d => format(d, "yyyy-MM-dd"));

    const brokerSchedule: Record<string, Record<string, ScheduleAssignment[]>> = {};

    assignments.forEach((a) => {
      if (!brokerSchedule[a.broker.id]) {
        brokerSchedule[a.broker.id] = {};
      }
      if (!brokerSchedule[a.broker.id][a.assignment_date]) {
        brokerSchedule[a.broker.id][a.assignment_date] = [];
      }
      brokerSchedule[a.broker.id][a.assignment_date].push(a);
    });

    const uniqueLocations = Array.from(
      new Set(assignments.map(a => a.location.id))
    )
      .map(id => assignments.find(a => a.location.id === id)?.location)
      .filter(Boolean)
      .sort((a, b) => {
        if (a.location_type === "external" && b.location_type !== "external") return -1;
        if (a.location_type !== "external" && b.location_type === "external") return 1;
        return a.name.localeCompare(b.name);
      });

    return {
      brokerSchedule,
      weekDays,
      uniqueLocations,
      weekStart,
      weekEnd,
    };
  }, [assignments, scheduleWeekStart, scheduleWeekEnd]);

  const { brokerSchedule, weekDays, uniqueLocations, weekStart, weekEnd } = processedData;
  
  // Usar corretores ativos do banco (ordenados por nome)
  const sortedBrokers = activeBrokers || [];

  const { data: periodConfigs } = useQuery({
    queryKey: ["period-configs-for-legend", uniqueLocations.map(l => l.id), weekStart, weekEnd],
    queryFn: async () => {
      const locationIds = uniqueLocations.map(l => l.id);
      
      // Buscar configurações por dia da semana
      const { data: dayConfigs } = await supabase
        .from("period_day_configs")
        .select(`
          *,
          location_periods!inner(
            location_id,
            start_date,
            end_date,
            period_type
          )
        `)
        .in("location_periods.location_id", locationIds)
        .lte("location_periods.start_date", weekEnd.toISOString().split('T')[0])
        .gte("location_periods.end_date", weekStart.toISOString().split('T')[0]);
      
      // Buscar configurações de datas específicas
      const { data: specificConfigs } = await supabase
        .from("period_specific_day_configs")
        .select(`
          *,
          location_periods!inner(
            location_id,
            start_date,
            end_date,
            period_type
          )
        `)
        .in("location_periods.location_id", locationIds)
        .gte("specific_date", weekStart.toISOString().split('T')[0])
        .lte("specific_date", weekEnd.toISOString().split('T')[0]);
      
      return { dayConfigs: dayConfigs || [], specificConfigs: specificConfigs || [] };
    },
    enabled: uniqueLocations.length > 0,
  });

  const getScheduleForLocation = (locationId: string, dayType: "weekday" | "saturday" | "sunday") => {
    if (!periodConfigs) return { morning: null, afternoon: null };
    
    const { dayConfigs, specificConfigs } = periodConfigs;
    
    // Mapear dayType para weekday string
    const weekdayMap: Record<string, string[]> = {
      weekday: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      saturday: ["saturday"],
      sunday: ["sunday"],
    };
    
    // Buscar nas configurações por dia da semana
    const relevantDayConfigs = dayConfigs.filter(
      (config: any) =>
        config.location_periods.location_id === locationId &&
        weekdayMap[dayType].includes(config.weekday)
    );
    
    // Buscar nas configurações de datas específicas
    const relevantSpecificConfigs = specificConfigs.filter((config: any) => {
      if (config.location_periods.location_id !== locationId) return false;
      
      // Filtrar apenas datas dentro do período da escala (se houver)
      if (weekStart && weekEnd) {
        const configDate = new Date(config.specific_date + "T00:00:00");
        if (configDate < weekStart || configDate > weekEnd) return false;
      }
      
      const dow = new Date(config.specific_date + "T00:00:00").getDay();
      
      if (dayType === "weekday") return dow >= 1 && dow <= 5;
      if (dayType === "saturday") return dow === 6;
      if (dayType === "sunday") return dow === 0;
      return false;
    });
    
    // Combinar ambas as fontes
    const allConfigs = [...relevantDayConfigs, ...relevantSpecificConfigs];
    
    // Extrair horários únicos
    const morningTimes = new Set<string>();
    const afternoonTimes = new Set<string>();
    
    allConfigs.forEach((config: any) => {
      if (config.has_morning && config.morning_start && config.morning_end) {
        morningTimes.add(`${config.morning_start.substring(0, 5)}-${config.morning_end.substring(0, 5)}`);
      }
      if (config.has_afternoon && config.afternoon_start && config.afternoon_end) {
        afternoonTimes.add(`${config.afternoon_start.substring(0, 5)}-${config.afternoon_end.substring(0, 5)}`);
      }
    });
    
    return {
      morning: morningTimes.size > 0 ? Array.from(morningTimes).join(", ") : null,
      afternoon: afternoonTimes.size > 0 ? Array.from(afternoonTimes).join(", ") : null,
    };
  };

  if (!weekStart || !weekEnd) return null;

  return (
    <div className="border rounded-lg p-6 bg-background">
      {/* CABEÇALHO */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold uppercase mb-2">PLANTÕES VOLUNTÁRIOS</h1>
        <p className="text-sm text-muted-foreground">
          Período: {format(weekStart, "dd/MM/yyyy", { locale: ptBR })} a {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
        </p>
        <p className="text-xs text-muted-foreground">
          Atualizado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse border text-base">
          <thead>
            <tr className="bg-primary/10">
              <th className="border border-primary/20 px-3 py-2 font-bold text-center bg-primary/5" style={{ width: "140px" }}>Corretor</th>
              <th className="border border-primary/20 px-3 py-2 font-bold text-center bg-primary/5" style={{ width: "80px" }}>Turno</th>
              {weekDays.map((day) => {
                const date = new Date(day + "T00:00:00");
                const weekdayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <th key={day} className={`border border-primary/20 px-2 py-2 font-bold text-center ${isWeekend ? 'bg-amber-50' : 'bg-primary/5'}`} style={{ width: "120px" }}>
                    <div className="text-base">{weekdaysMap[weekdayKey as keyof typeof weekdaysMap]}</div>
                    <div className="font-normal text-xs text-muted-foreground">{format(date, "dd/MM")}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let rowIndex = 0;
              return sortedBrokers.map((broker) => {
                const allShifts: Array<{day: string, shift: ScheduleAssignment | null, type: 'morning' | 'afternoon'}> = [];
                
              weekDays.forEach(day => {
                const dayAssignments = brokerSchedule[broker.id]?.[day] || [];
                // Filtrar por turno e PRIORIZAR EXTERNO se houver duplicata
                const morningAssignments = dayAssignments.filter(a => a.shift_type === "morning");
                const afternoonAssignments = dayAssignments.filter(a => a.shift_type === "afternoon");
                
                // Log warning se houver duplicatas
                if (morningAssignments.length > 1) {
                  console.warn(`⚠️ DUPLICATA DETECTADA: ${broker.name} tem ${morningAssignments.length} alocações de manhã em ${day}:`, 
                    morningAssignments.map(a => a.location?.name).join(", "));
                }
                if (afternoonAssignments.length > 1) {
                  console.warn(`⚠️ DUPLICATA DETECTADA: ${broker.name} tem ${afternoonAssignments.length} alocações de tarde em ${day}:`,
                    afternoonAssignments.map(a => a.location?.name).join(", "));
                }
                
                // Priorizar EXTERNO sobre INTERNO se houver duplicata
                const morning = morningAssignments.find(a => a.location?.location_type === "external") 
                              || morningAssignments[0];
                const afternoon = afternoonAssignments.find(a => a.location?.location_type === "external") 
                                || afternoonAssignments[0];
                
                if (morning) {
                  allShifts.push({day, shift: morning, type: 'morning'});
                }
                if (afternoon) {
                  allShifts.push({day, shift: afternoon, type: 'afternoon'});
                }
              });
                
                if (allShifts.length === 0) {
                  const zebraClass = rowIndex % 2 === 0 ? 'bg-white' : 'bg-muted/20';
                  rowIndex++;
                  return (
                    <tr key={broker.id} className={zebraClass}>
                      <td className="border border-primary/20 px-3 py-2 font-semibold align-middle bg-muted/30 text-center">{broker.name}</td>
                      <td className="border border-primary/20 px-3 py-2 text-center align-middle">-</td>
                      {weekDays.map(day => {
                        const date = new Date(day + "T00:00:00");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <td key={day} className={`border border-primary/20 px-2 py-2 text-center align-middle text-sm hover:bg-primary/5 transition-colors ${isWeekend ? 'bg-amber-50/30' : ''}`}>
                            -
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                
                const morningShifts = allShifts.filter(s => s.type === 'morning');
                const afternoonShifts = allShifts.filter(s => s.type === 'afternoon');
                
                const rows: JSX.Element[] = [];
                const hasBothShifts = morningShifts.length > 0 && afternoonShifts.length > 0;
                
                if (morningShifts.length > 0) {
                  const zebraClass = rowIndex % 2 === 0 ? 'bg-white' : 'bg-muted/20';
                  rowIndex++;
                  rows.push(
                    <tr key={`${broker.id}-morning`} className={zebraClass}>
                      <td 
                        className="border border-primary/20 px-3 py-2 font-semibold align-middle bg-muted/30 text-center"
                        rowSpan={hasBothShifts ? 2 : 1}
                      >
                        {broker.name}
                      </td>
                      <td className="border border-primary/20 px-3 py-2 text-center align-middle bg-blue-50/50">
                        <span className="font-medium text-blue-700">Manhã</span>
                      </td>
                      {weekDays.map((day) => {
                        const shiftForDay = morningShifts.find(s => s.day === day);
                        const date = new Date(day + "T00:00:00");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <td key={day} className={`border border-primary/20 px-2 py-2 text-center align-middle text-sm hover:bg-primary/5 transition-colors ${isWeekend ? 'bg-amber-50/30' : ''}`}>
                            {shiftForDay ? (
                              <span 
                                className="font-medium"
                                style={{ 
                                  color: shiftForDay.shift?.location?.location_type === "external" ? "#dc2626" : "inherit" 
                                }}
                              >
                                {shiftForDay.shift?.location?.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                
                if (afternoonShifts.length > 0) {
                  const zebraClass = hasBothShifts 
                    ? (rowIndex - 1) % 2 === 0 ? 'bg-white' : 'bg-muted/20'
                    : rowIndex % 2 === 0 ? 'bg-white' : 'bg-muted/20';
                  if (!hasBothShifts) rowIndex++;
                  rows.push(
                    <tr key={`${broker.id}-afternoon`} className={zebraClass}>
                      {!hasBothShifts && (
                        <td className="border border-primary/20 px-3 py-2 font-semibold align-middle bg-muted/30 text-center">
                          {broker.name}
                        </td>
                      )}
                      <td className="border border-primary/20 px-3 py-2 text-center align-middle bg-orange-50/50">
                        <span className="font-medium text-orange-700">Tarde</span>
                      </td>
                      {weekDays.map((day) => {
                        const shiftForDay = afternoonShifts.find(s => s.day === day);
                        const date = new Date(day + "T00:00:00");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <td key={day} className={`border border-primary/20 px-2 py-2 text-center align-middle text-sm hover:bg-primary/5 transition-colors ${isWeekend ? 'bg-amber-50/30' : ''}`}>
                            {shiftForDay ? (
                              <span 
                                className="font-medium"
                                style={{ 
                                  color: shiftForDay.shift?.location?.location_type === "external" ? "#dc2626" : "inherit" 
                                }}
                              >
                                {shiftForDay.shift?.location?.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                
                return rows;
              });
            })()}
          </tbody>
        </table>
      </div>

      {/* LEGENDA SIMPLIFICADA */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3 text-primary border-b-2 border-primary pb-2">
          Legenda de Horários
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-base">
            <thead>
              <tr className="bg-primary/10">
                <th className="border border-primary/20 px-3 py-2 text-left font-bold bg-primary/5">
                  Empreendimento
                </th>
                <th className="border border-primary/20 px-3 py-2 text-center font-bold bg-primary/5">
                  Segunda a Sexta
                </th>
                <th className="border border-primary/20 px-3 py-2 text-center font-bold bg-amber-100/70">
                  Sábado
                </th>
                <th className="border border-primary/20 px-3 py-2 text-center font-bold bg-amber-100/70">
                  Domingo
                </th>
              </tr>
            </thead>
            <tbody>
              {uniqueLocations.map((location, idx) => {
                // Verificar quais dias da semana realmente têm plantões para esse local
                const locationAssignments = assignments.filter(a => a.location.id === location.id);
                const daysOfWeek = new Set(locationAssignments.map(a => new Date(a.assignment_date + "T00:00:00").getDay()));
                
                const hasWeekday = Array.from(daysOfWeek).some(d => d >= 1 && d <= 5);
                const hasSaturday = daysOfWeek.has(6);
                const hasSunday = daysOfWeek.has(0);
                
                const weekdaySchedule = hasWeekday ? getScheduleForLocation(location.id, "weekday") : null;
                const saturdaySchedule = hasSaturday ? getScheduleForLocation(location.id, "saturday") : null;
                const sundaySchedule = hasSunday ? getScheduleForLocation(location.id, "sunday") : null;
                
                // Só mostrar a linha se tiver pelo menos um tipo de dia com plantão
                if (!hasWeekday && !hasSaturday && !hasSunday) return null;
                
                return (
                  <tr key={location.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/30'}>
                    <td className="border border-primary/20 px-3 py-2 font-medium">{location.name}</td>
                    <td className="border border-primary/20 px-3 py-2 text-center text-sm">
                      {weekdaySchedule && (weekdaySchedule.morning || weekdaySchedule.afternoon) ? (
                        <>
                          {weekdaySchedule.morning && (
                            <div>
                              <span className="font-semibold text-blue-700">Manhã:</span> {weekdaySchedule.morning}
                            </div>
                          )}
                          {weekdaySchedule.afternoon && (
                            <div className={weekdaySchedule.morning ? "mt-1" : ""}>
                              <span className="font-semibold text-orange-700">Tarde:</span> {weekdaySchedule.afternoon}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="border border-primary/20 px-3 py-2 text-center text-sm bg-amber-50/30">
                      {saturdaySchedule && (saturdaySchedule.morning || saturdaySchedule.afternoon) ? (
                        <>
                          {saturdaySchedule.morning && (
                            <div>
                              <span className="font-semibold text-blue-700">Manhã:</span> {saturdaySchedule.morning}
                            </div>
                          )}
                          {saturdaySchedule.afternoon && (
                            <div className={saturdaySchedule.morning ? "mt-1" : ""}>
                              <span className="font-semibold text-orange-700">Tarde:</span> {saturdaySchedule.afternoon}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="border border-primary/20 px-3 py-2 text-center text-sm bg-amber-50/30">
                      {sundaySchedule && (sundaySchedule.morning || sundaySchedule.afternoon) ? (
                        <>
                          {sundaySchedule.morning && (
                            <div>
                              <span className="font-semibold text-blue-700">Manhã:</span> {sundaySchedule.morning}
                            </div>
                          )}
                          {sundaySchedule.afternoon && (
                            <div className={sundaySchedule.morning ? "mt-1" : ""}>
                              <span className="font-semibold text-orange-700">Tarde:</span> {sundaySchedule.afternoon}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OBSERVAÇÕES */}
      {scheduleId && (
        <div className="mt-6 border-t pt-4">
          <Label className="flex items-center gap-2 text-sm font-semibold mb-2">
            <MessageSquare className="h-4 w-4" />
            Observações
          </Label>
          <Textarea
            value={observationText}
            onChange={(e) => handleObservationChange(e.target.value)}
            placeholder="Adicione observações sobre esta escala..."
            className="min-h-[80px] resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {saveMutation.isPending ? "Salvando..." : saveMutation.isSuccess ? "✓ Salvo" : "Auto-save ativado"}
          </p>
        </div>
      )}
    </div>
  );
}
