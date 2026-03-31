import { useMemo } from "react";
import { createPortal } from "react-dom";
import { format, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleAssignment {
  id?: string;
  broker?: any;
  location?: any;
  assignment_date: string;
  shift_type: "morning" | "afternoon";
  start_time: string;
  end_time: string;
}

interface SchedulePDFGeneratorProps {
  assignments: ScheduleAssignment[];
  brokers?: Array<{ id: string; name: string; creci?: string }>;
  scheduleWeekStart?: string;
  scheduleWeekEnd?: string;
  generatedAt?: string;
  updatedAt?: string;
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

export function SchedulePDFGenerator({ assignments, scheduleWeekStart, scheduleWeekEnd, generatedAt, updatedAt, scheduleId }: SchedulePDFGeneratorProps) {
  // Load observation for PDF
  const { data: observation } = useQuery({
    queryKey: ["schedule-observation", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null;
      const { data, error } = await supabase
        .from("schedule_observations" as any)
        .select("content")
        .eq("schedule_id", scheduleId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!scheduleId,
  });
  const observationContent = observation?.content || "";
  const processedData = useMemo(() => {
    if (!assignments || assignments.length === 0) {
      return { brokerSchedule: {}, weekDays: [], sortedBrokers: [], uniqueLocations: [], weekStart: null, weekEnd: null };
    }

    // Priorizar datas fornecidas do schedule (igual ao ScheduleCalendarView)
    const weekStart = scheduleWeekStart 
      ? new Date(scheduleWeekStart + "T00:00:00")
      : new Date(Math.min(...assignments.map(a => new Date(a.assignment_date + "T00:00:00").getTime())));
      
    const weekEnd = scheduleWeekEnd
      ? new Date(scheduleWeekEnd + "T00:00:00")
      : new Date(Math.max(...assignments.map(a => new Date(a.assignment_date + "T00:00:00").getTime())));

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

    const sortedBrokers = Array.from(
      new Set(assignments.map(a => a.broker.id))
    )
      .map(id => assignments.find(a => a.broker.id === id)?.broker)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

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
      sortedBrokers,
      uniqueLocations,
      weekStart,
      weekEnd,
    };
  }, [assignments, scheduleWeekStart, scheduleWeekEnd]);

  const { brokerSchedule, weekDays, sortedBrokers, uniqueLocations, weekStart, weekEnd } = processedData;

  // Buscar configurações reais dos períodos
  const { data: periodConfigs } = useQuery({
    queryKey: ["period-configs-for-legend", uniqueLocations.map(l => l.id)],
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
        .in("location_periods.location_id", locationIds);
      
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
        .in("location_periods.location_id", locationIds);
      
      return { dayConfigs: dayConfigs || [], specificConfigs: specificConfigs || [] };
    },
    enabled: uniqueLocations.length > 0,
  });

  // Nova função para obter horários das configurações
  const getScheduleForLocation = (locationId: string, dayType: "weekday" | "saturday" | "sunday") => {
    if (!periodConfigs) return { morning: null, afternoon: null };
    
    const { dayConfigs, specificConfigs } = periodConfigs;
    
    // Mapear dayType para weekday string
    const weekdayMap: Record<string, string[]> = {
      weekday: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      saturday: ["saturday"],
      sunday: ["sunday"],
    };
    
    // Buscar nas configurações por dia da semana (filtrar períodos vigentes)
    const relevantDayConfigs = dayConfigs.filter((config: any) => {
      if (config.location_periods.location_id !== locationId) return false;
      if (!weekdayMap[dayType].includes(config.weekday)) return false;
      // Filtrar apenas períodos vigentes na semana da escala
      const periodStart = new Date(config.location_periods.start_date + "T00:00:00");
      const periodEnd = config.location_periods.end_date 
        ? new Date(config.location_periods.end_date + "T00:00:00") 
        : new Date("2099-12-31");
      return periodStart <= weekEnd && periodEnd >= weekStart;
    });
    
    // Buscar nas configurações de datas específicas (filtrar períodos vigentes)
    const relevantSpecificConfigs = specificConfigs.filter((config: any) => {
      if (config.location_periods.location_id !== locationId) return false;
      
      // Filtrar apenas períodos vigentes na semana da escala
      const periodStart = new Date(config.location_periods.start_date + "T00:00:00");
      const periodEnd = config.location_periods.end_date 
        ? new Date(config.location_periods.end_date + "T00:00:00") 
        : new Date("2099-12-31");
      if (!(periodStart <= weekEnd && periodEnd >= weekStart)) return false;
      
      // Filtrar apenas datas dentro do período da escala
      const configDate = new Date(config.specific_date + "T00:00:00");
      if (configDate < weekStart || configDate > weekEnd) return false;
      
      const dow = configDate.getDay();
      
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

  const pdfContent = (
    <div id="pdf-content" className="bg-white" style={{ padding: "1mm" }}>
        {/* CABEÇALHO */}
        <div className="text-center" style={{ marginBottom: "1mm" }}>
          <h1 style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", margin: 0 }}>
            PLANTÕES VOLUNTÁRIOS
          </h1>
          <p style={{ fontSize: "10px", color: "#666", margin: 0 }}>
            Período: {format(weekStart, "dd/MM/yyyy", { locale: ptBR })} a {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
            {updatedAt && ` | Atualizado em: ${format(new Date(updatedAt), "dd/MM/yyyy", { locale: ptBR })} às ${format(new Date(updatedAt), "HH:mm", { locale: ptBR })}`}
          </p>
        </div>

        {/* TABELA PRINCIPAL */}
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "10px",
          marginBottom: "1mm"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#dbeafe" }}>
              <th style={{
                border: "0.5px solid #93c5fd",
                padding: "1px 2px",
                width: "70px",
                textAlign: "center",
                backgroundColor: "#dbeafe"
              }}>Corretor</th>
              <th style={{
                border: "0.5px solid #93c5fd",
                padding: "1px 2px",
                width: "35px",
                textAlign: "center",
                backgroundColor: "#dbeafe"
              }}>Turno</th>
              {weekDays.map((day) => {
                const date = new Date(day + "T00:00:00");
                const weekdayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                <th key={day} style={{
                  border: "0.5px solid #93c5fd",
                  padding: "1px",
                  textAlign: "center",
                  backgroundColor: isWeekend ? "#fef9e7" : "#dbeafe"
                }}>
                  <div style={{ fontSize: "8px" }}>{weekdaysMap[weekdayKey as keyof typeof weekdaysMap]}</div>
                  <div style={{ fontSize: "6px", fontWeight: "normal" }}>{format(date, "dd/MM")}</div>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let brokerIndex = 0;
              return sortedBrokers.map((broker) => {
                // Definir cor do zebrado UMA VEZ por corretor (mais escura para melhor contraste)
                const zebraColor = brokerIndex % 2 === 0 ? '#ffffff' : '#d1d5db';
                const weekendZebraColor = brokerIndex % 2 === 0 ? '#fefce8' : '#fef08a';
                brokerIndex++;
                
                const allShifts: Array<{day: string, shift: ScheduleAssignment | null, type: 'morning' | 'afternoon'}> = [];
                
                weekDays.forEach(day => {
                  const dayAssignments = brokerSchedule[broker.id]?.[day] || [];
                  const morning = dayAssignments.find(a => a.shift_type === "morning");
                  const afternoon = dayAssignments.find(a => a.shift_type === "afternoon");
                  
                  if (morning || afternoon) {
                    if (morning) allShifts.push({day, shift: morning, type: 'morning'});
                    if (afternoon) allShifts.push({day, shift: afternoon, type: 'afternoon'});
                  }
                });
                
            if (allShifts.length === 0) {
              return (
                <tr key={broker.id}>
                  <td style={{
                    border: "0.5px solid #93c5fd",
                    padding: "1px 2px",
                    fontWeight: "600",
                    verticalAlign: "middle",
                    textAlign: "center",
                    backgroundColor: "#f3f4f6"
                  }}>{broker.name}</td>
                      <td style={{
                        border: "0.5px solid #93c5fd",
                        padding: "1px 2px",
                        textAlign: "center",
                        verticalAlign: "middle",
                        backgroundColor: zebraColor
                      }}>-</td>
                      {weekDays.map(day => {
                        const date = new Date(day + "T00:00:00");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <td key={day} style={{
                            border: "0.5px solid #93c5fd",
                            padding: "1px 2px",
                            verticalAlign: "top",
                            backgroundColor: isWeekend ? weekendZebraColor : zebraColor
                          }}>-</td>
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
                  rows.push(
                    <tr key={`${broker.id}-morning`}>
                      <td style={{
                        border: "0.5px solid #93c5fd",
                        padding: "1px 2px",
                        fontWeight: "600",
                        verticalAlign: "middle",
                        textAlign: "center",
                        backgroundColor: "#f3f4f6"
                      }} rowSpan={hasBothShifts ? 2 : 1}>
                        {broker.name}
                      </td>
                      <td style={{
                        border: "0.5px solid #93c5fd",
                        padding: "1px 2px",
                        textAlign: "center",
                        verticalAlign: "middle",
                        backgroundColor: "#eff6ff"
                      }}>
                        <span style={{ fontWeight: "600", color: "#1e40af" }}>Manhã</span>
                      </td>
                      {weekDays.map(day => {
                        const shift = morningShifts.find(s => s.day === day);
                        const date = new Date(day + "T00:00:00");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <td key={day} style={{
                            border: "0.5px solid #93c5fd",
                            padding: "1px 2px",
                            verticalAlign: "top",
                            textAlign: "center",
                            backgroundColor: isWeekend ? weekendZebraColor : zebraColor,
                            color: shift?.shift?.location?.location_type === "external" ? "#dc2626" : "#000000"
                          }}>
                            {shift?.shift ? shift.shift.location.name : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                
                if (afternoonShifts.length > 0) {
                  rows.push(
                    <tr key={`${broker.id}-afternoon`}>
                      {!hasBothShifts && (
                        <td style={{
                          border: "0.5px solid #93c5fd",
                          padding: "1px 2px",
                          fontWeight: "600",
                          verticalAlign: "middle",
                          textAlign: "center",
                          backgroundColor: "#f3f4f6"
                        }}>
                          {broker.name}
                        </td>
                      )}
                      <td style={{
                        border: "0.5px solid #93c5fd",
                        padding: "1px 2px",
                        textAlign: "center",
                        verticalAlign: "middle",
                        backgroundColor: "#ffedd5"
                      }}>
                        <span style={{ fontWeight: "600", color: "#c2410c" }}>Tarde</span>
                      </td>
                      {weekDays.map(day => {
                        const shift = afternoonShifts.find(s => s.day === day);
                        const date = new Date(day + "T00:00:00");
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <td key={day} style={{
                            border: "0.5px solid #93c5fd",
                            padding: "1px 2px",
                            verticalAlign: "top",
                            textAlign: "center",
                            backgroundColor: isWeekend ? weekendZebraColor : zebraColor,
                            color: shift?.shift?.location?.location_type === "external" ? "#dc2626" : "#000000"
                          }}>
                            {shift?.shift ? shift.shift.location.name : '-'}
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

        {/* LEGENDA SIMPLIFICADA */}
        <div style={{ marginTop: "1mm" }}>
          <h2 style={{ fontSize: "9px", fontWeight: "bold", margin: "0 0 1mm 0", borderBottom: "1px solid #3b82f6", paddingBottom: "0.5mm", color: "#3b82f6" }}>
            LEGENDA DE HORÁRIOS
          </h2>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "9px"
          }}>
            <thead>
              <tr style={{ backgroundColor: "#dbeafe" }}>
              <th style={{ border: "0.5px solid #93c5fd", padding: "1px 2px", textAlign: "left", backgroundColor: "#dbeafe" }}>Empreendimento</th>
              <th style={{ border: "0.5px solid #93c5fd", padding: "1px 2px", textAlign: "center", backgroundColor: "#dbeafe" }}>Seg-Sex</th>
              <th style={{ border: "0.5px solid #93c5fd", padding: "1px 2px", textAlign: "center", backgroundColor: "#fde68a" }}>Sábado</th>
              <th style={{ border: "0.5px solid #93c5fd", padding: "1px 2px", textAlign: "center", backgroundColor: "#fde68a" }}>Domingo</th>
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
              <tr key={location.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f5f5f5' }}>
                <td style={{ border: "0.5px solid #93c5fd", padding: "1px 2px" }}>{location.name}</td>
                <td style={{ border: "0.5px solid #93c5fd", padding: "1px 2px", textAlign: "center" }}>
                  {weekdaySchedule && (weekdaySchedule.morning || weekdaySchedule.afternoon) ? (
                    <span>
                      {weekdaySchedule.morning && <span style={{ color: "#1e40af" }}>Manhã: {weekdaySchedule.morning}</span>}
                      {weekdaySchedule.morning && weekdaySchedule.afternoon && " | "}
                      {weekdaySchedule.afternoon && <span style={{ color: "#c2410c" }}>Tarde: {weekdaySchedule.afternoon}</span>}
                    </span>
                  ) : "-"}
                </td>
                <td style={{ border: "0.5px solid #93c5fd", padding: "1px 2px", textAlign: "center", backgroundColor: "#fef9e7" }}>
                  {saturdaySchedule && (saturdaySchedule.morning || saturdaySchedule.afternoon) ? (
                    <span>
                      {saturdaySchedule.morning && <span style={{ color: "#1e40af" }}>Manhã: {saturdaySchedule.morning}</span>}
                      {saturdaySchedule.morning && saturdaySchedule.afternoon && " | "}
                      {saturdaySchedule.afternoon && <span style={{ color: "#c2410c" }}>Tarde: {saturdaySchedule.afternoon}</span>}
                    </span>
                  ) : "-"}
                </td>
                <td style={{ border: "0.5px solid #93c5fd", padding: "1px 2px", textAlign: "center", backgroundColor: "#fef9e7" }}>
                  {sundaySchedule && (sundaySchedule.morning || sundaySchedule.afternoon) ? (
                    <span>
                      {sundaySchedule.morning && <span style={{ color: "#1e40af" }}>Manhã: {sundaySchedule.morning}</span>}
                      {sundaySchedule.morning && sundaySchedule.afternoon && " | "}
                      {sundaySchedule.afternoon && <span style={{ color: "#c2410c" }}>Tarde: {sundaySchedule.afternoon}</span>}
                    </span>
                  ) : "-"}
                </td>
              </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* OBSERVAÇÕES */}
        {observationContent && (
          <div style={{ marginTop: "2mm" }}>
            <h2 style={{ fontSize: "12px", fontWeight: "bold", margin: "0 0 1mm 0", borderBottom: "1px solid #3b82f6", paddingBottom: "0.5mm", color: "#3b82f6" }}>
              OBSERVAÇÕES
            </h2>
            <p style={{ fontSize: "12px", color: "#333", whiteSpace: "pre-wrap", margin: 0, lineHeight: "1.5" }}>
              {observationContent}
            </p>
          </div>
        )}
    </div>
  );

  return (
    <>
      <style>{`
        @media screen {
          #pdf-content {
            display: none !important;
          }
        }
        
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          /* Esconder TODOS os filhos diretos do body EXCETO pdf-content */
          body > *:not(#pdf-content) {
            display: none !important;
          }
          
          #pdf-content {
            display: block !important;
            width: 190mm !important;
            padding: 5mm !important;
            background: white !important;
          }
          
          #pdf-content * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      {createPortal(pdfContent, document.body)}
    </>
  );
}
