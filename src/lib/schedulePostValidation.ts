// ═══════════════════════════════════════════════════════════
// VALIDADOR PÓS-GERAÇÃO DE ESCALAS
// Verifica TODAS as regras críticas para cada corretor
// ═══════════════════════════════════════════════════════════

import { format, getDay, differenceInDays, getISOWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export interface PostValidationViolation {
  rule: string;
  severity: "error" | "warning";
  brokerName: string;
  brokerId: string;
  details: string;
  dates?: string[];
  locations?: string[];
}

export interface UnallocatedDemand {
  locationId: string;
  locationName: string;
  date: string;
  shift: "morning" | "afternoon";
  reason?: string;
}

export interface PostValidationResult {
  isValid: boolean;
  violations: PostValidationViolation[];
  summary: {
    totalAssignments: number;
    totalBrokers: number;
    errorCount: number;
    warningCount: number;
    unallocatedCount: number;
  };
  brokerReports: BrokerValidationReport[];
  unallocatedDemands: UnallocatedDemand[];
}

export interface BrokerValidationReport {
  brokerId: string;
  brokerName: string;
  totalAssignments: number;
  externalCount: number;
  internalCount: number;
  saturdayCount: number;
  weeklyBreakdown: WeeklyBreakdown[];
  violations: PostValidationViolation[];
}

interface WeeklyBreakdown {
  weekLabel: string;
  weekStart: string;
  externalCount: number;
  internalCount: number;
  saturdayCount: number;
  locations: string[];
  dates: string[];
}

interface Assignment {
  broker_id: string;
  broker_name?: string;
  location_id: string;
  location_name?: string;
  location_type?: string;
  assignment_date: string;
  shift_type: string;
}

interface LocationInfo {
  id: string;
  name: string;
  type: string;
}

interface BrokerInfo {
  id: string;
  name: string;
  availableWeekdays?: string[];
}

// Configuração de turnos por local/data
interface LocationShiftConfig {
  hasMorning: boolean;
  hasAfternoon: boolean;
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════
export function validateGeneratedSchedule(
  assignments: Assignment[],
  brokers: BrokerInfo[],
  locations: LocationInfo[],
  unallocatedDemands: UnallocatedDemand[] = [],
  locationBrokerConfigs?: Map<string, string[]>, // Map<locationId, brokerId[]> - corretores CONFIGURADOS por local
  locationShiftConfigs?: Map<string, Map<string, LocationShiftConfig>> // Map<locationId, Map<dateStr, config>>
): PostValidationResult {
  const violations: PostValidationViolation[] = [];
  const brokerReports: BrokerValidationReport[] = [];

  // Criar mapas para lookup rápido
  const brokerMap = new Map(brokers.map(b => [b.id, b.name]));
  const locationMap = new Map(locations.map(l => [l.id, { name: l.name, type: l.type }]));

  // Agrupar assignments por corretor
  const assignmentsByBroker = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!assignmentsByBroker.has(a.broker_id)) {
      assignmentsByBroker.set(a.broker_id, []);
    }
    assignmentsByBroker.get(a.broker_id)!.push(a);
  }

  // Helper: dia da semana em inglês
  const dayOfWeekMap: Record<number, string> = {
    0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
    4: "thursday", 5: "friday", 6: "saturday"
  };

  // Validar cada corretor
  for (const [brokerId, brokerAssignments] of assignmentsByBroker) {
    const brokerName = brokerMap.get(brokerId) || "Desconhecido";
    const brokerViolations: PostValidationViolation[] = [];
    const broker = brokers.find(b => b.id === brokerId);

    // Enriquecer assignments com nomes
    const enrichedAssignments = brokerAssignments.map(a => ({
      ...a,
      broker_name: brokerName,
      location_name: locationMap.get(a.location_id)?.name || "Desconhecido",
      location_type: locationMap.get(a.location_id)?.type || "external"
    }));

    // Ordenar por data
    enrichedAssignments.sort((a, b) => a.assignment_date.localeCompare(b.assignment_date));

    // ═══════════════════════════════════════════════════════════
    // NOVA REGRA: Corretor alocado fora da disponibilidade
    // Verifica available_weekdays global
    // ═══════════════════════════════════════════════════════════
    if (broker?.availableWeekdays && broker.availableWeekdays.length > 0) {
      for (const a of enrichedAssignments) {
        const date = new Date(a.assignment_date + "T00:00:00");
        const dayIndex = getDay(date);
        const dayName = dayOfWeekMap[dayIndex];
        
        if (!broker.availableWeekdays.includes(dayName)) {
          const dayLabel = format(date, "EEEE dd/MM", { locale: ptBR });
          brokerViolations.push({
            rule: "FORA_DISPONIBILIDADE",
            severity: "error",
            brokerName,
            brokerId,
            details: `${brokerName} alocado(a) em ${dayLabel} mas "${dayName}" não está na sua disponibilidade`,
            dates: [a.assignment_date],
            locations: [a.location_name || ""]
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // NOVA REGRA: Interno + Externo no mesmo dia
    // ═══════════════════════════════════════════════════════════
    const assignmentsByDate = new Map<string, typeof enrichedAssignments>();
    for (const a of enrichedAssignments) {
      if (!assignmentsByDate.has(a.assignment_date)) {
        assignmentsByDate.set(a.assignment_date, []);
      }
      assignmentsByDate.get(a.assignment_date)!.push(a);
    }
    
    for (const [dateStr, dayAssignments] of assignmentsByDate) {
      const hasInternal = dayAssignments.some(a => a.location_type === "internal");
      const hasExternal = dayAssignments.some(a => a.location_type === "external");
      
      if (hasInternal && hasExternal) {
        const date = new Date(dateStr + "T00:00:00");
        const isSaturday = date.getDay() === 6;
        
        // Seg-Sex: interno + externo no mesmo dia é PERMITIDO (turnos diferentes)
        // Só gera violação no SÁBADO
        if (isSaturday) {
          const dayLabel = format(date, "EEEE dd/MM", { locale: ptBR });
          const internalLocs = dayAssignments.filter(a => a.location_type === "internal").map(a => a.location_name);
          const externalLocs = dayAssignments.filter(a => a.location_type === "external").map(a => a.location_name);
          
          brokerViolations.push({
            rule: "INTERNO_EXTERNO_MESMO_DIA",
            severity: "error",
            brokerName,
            brokerId,
            details: `${brokerName} com interno (${internalLocs.join(", ")}) e externo (${externalLocs.join(", ")}) no sábado (${dayLabel}) — proibido`,
            dates: [dateStr],
            locations: [...internalLocs, ...externalLocs]
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // NOVA REGRA: Turno alocado em horário não configurado
    // ═══════════════════════════════════════════════════════════
    if (locationShiftConfigs) {
      for (const a of enrichedAssignments) {
        const locConfigs = locationShiftConfigs.get(a.location_id);
        if (!locConfigs) continue;
        
        const dayConfig = locConfigs.get(a.assignment_date);
        if (!dayConfig) continue;
        
        const shiftLabel = a.shift_type === "morning" ? "manhã" : "tarde";
        const isAllowed = a.shift_type === "morning" ? dayConfig.hasMorning : dayConfig.hasAfternoon;
        
        if (!isAllowed) {
          const date = new Date(a.assignment_date + "T00:00:00");
          const dayLabel = format(date, "EEEE dd/MM", { locale: ptBR });
          
          brokerViolations.push({
            rule: "TURNO_NAO_CONFIGURADO",
            severity: "error",
            brokerName,
            brokerId,
            details: `${a.location_name} - ${dayLabel} tem turno da ${shiftLabel} alocado mas este turno não está configurado no local`,
            dates: [a.assignment_date],
            locations: [a.location_name || ""]
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // REGRA 1: Máximo 2 DIAS com externos por semana
    // IMPORTANTE: Conta DIAS únicos, não TURNOS
    // (Manhã + Tarde no mesmo dia = 1 DIA, não 2)
    // NOTA: 3 externos é WARNING, 4+ é ERROR CRÍTICO (nunca deve acontecer)
    // ═══════════════════════════════════════════════════════════
    const weeklyExternals = groupByWeek(enrichedAssignments.filter(a => a.location_type === "external"));
    for (const [weekKey, weekAssignments] of weeklyExternals) {
      // Contar DIAS únicos, não turnos
      const uniqueDays = new Set(weekAssignments.map(a => a.assignment_date));
      const dayCount = uniqueDays.size;
      
      if (dayCount >= 4) {
        // 4+ externos = ERRO CRÍTICO - nunca deve acontecer
        brokerViolations.push({
          rule: "LIMITE_ABSOLUTO_4_EXTERNOS",
          severity: "error",
          brokerName,
          brokerId,
          details: `PROIBIDO: ${brokerName} tem ${dayCount} DIAS com externo na semana ${weekKey} (máximo absoluto: 3). Isso NUNCA deve ocorrer.`,
          dates: [...uniqueDays],
          locations: [...new Set(weekAssignments.map(a => a.location_name!))]
        });
      } else if (dayCount === 3) {
        // 3 externos = Warning (pode ocorrer quando necessário)
        brokerViolations.push({
          rule: "MAX_2_EXTERNOS_SEMANA",
          severity: "warning",
          brokerName,
          brokerId,
          details: `${brokerName} tem ${dayCount} DIAS com externo na semana ${weekKey} (máx ideal: 2 dias) - EXCEDEU LIMITE (alta demanda)`,
          dates: [...uniqueDays],
          locations: [...new Set(weekAssignments.map(a => a.location_name!))]
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // REGRA 2: Externos consecutivos - REMOVIDA
    // Dias consecutivos são consequência natural de alta demanda
    // e a regra "2 antes de 3" já garante distribuição equânime
    // ═══════════════════════════════════════════════════════════
    const externalAssignments = enrichedAssignments.filter(a => a.location_type === "external");

    // ═══════════════════════════════════════════════════════════
    // REGRA 3: Sem repetição no mesmo local externo em semanas seguidas
    // NOTA: Aplica-se APENAS ao Artus Vivence - outros locais (como Botanic)
    // podem ter repetição devido ao alto volume de plantões
    // ═══════════════════════════════════════════════════════════
    const externalByLocation = new Map<string, Assignment[]>();
    for (const a of externalAssignments) {
      if (!externalByLocation.has(a.location_id)) {
        externalByLocation.set(a.location_id, []);
      }
      externalByLocation.get(a.location_id)!.push(a);
    }

    for (const [locationId, locAssignments] of externalByLocation) {
      const locationName = locationMap.get(locationId)?.name || "Desconhecido";
      
      // SOMENTE verificar para Artus Vivence - ignorar outros locais
      if (!locationName.toLowerCase().includes('vivence')) {
        continue;
      }
      
      if (locAssignments.length > 1) {
        const weeks = locAssignments.map(a => getWeekNumber(a.assignment_date));
        const uniqueWeeks = [...new Set(weeks)];
        
        // Verificar semanas consecutivas
        uniqueWeeks.sort((a, b) => a - b);
        for (let i = 1; i < uniqueWeeks.length; i++) {
          if (uniqueWeeks[i] - uniqueWeeks[i - 1] === 1) {
            // VERIFICAR SE É O ÚNICO CORRETOR CONFIGURADO PARA ESTE LOCAL
            // Usar locationBrokerConfigs se disponível, senão verificar alocados
            let isOnlyConfigured = false;
            
            if (locationBrokerConfigs) {
              const configuredBrokers = locationBrokerConfigs.get(locationId) || [];
              isOnlyConfigured = configuredBrokers.length === 1 && configuredBrokers[0] === brokerId;
            } else {
              // Fallback: verificar quantos corretores DIFERENTES estão neste local em toda a escala
              const allBrokersForLocation = new Set<string>();
              for (const a of externalAssignments) {
                if (a.location_id === locationId) {
                  allBrokersForLocation.add(a.broker_id);
                }
              }
              isOnlyConfigured = allBrokersForLocation.size === 1;
            }
            
            brokerViolations.push({
              rule: "SEM_REPETICAO_LOCAL_SEMANAS_SEGUIDAS",
              severity: isOnlyConfigured ? "warning" : "error",
              brokerName,
              brokerId,
              details: isOnlyConfigured 
                ? `${brokerName} repetido no ${locationName} em semanas consecutivas (único corretor configurado - inevitável)`
                : `${brokerName} repetido no ${locationName} em semanas consecutivas`,
              dates: locAssignments.map(a => a.assignment_date),
              locations: [locationName]
            });
            break;
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // REGRA 4: Sem sábado E domingo externos na mesma semana
    // ═══════════════════════════════════════════════════════════
    for (const [weekKey, weekAssignments] of weeklyExternals) {
      const days = weekAssignments.map(a => getDay(new Date(a.assignment_date + "T00:00:00")));
      const hasSaturday = days.includes(6);
      const hasSunday = days.includes(0);
      
      if (hasSaturday && hasSunday) {
        brokerViolations.push({
          rule: "SEM_SABADO_DOMINGO_EXTERNOS",
          severity: "error",
          brokerName,
          brokerId,
          details: `${brokerName} com externo sábado E domingo na semana ${weekKey}`,
          dates: weekAssignments.filter(a => [0, 6].includes(getDay(new Date(a.assignment_date + "T00:00:00")))).map(a => a.assignment_date),
          locations: weekAssignments.map(a => a.location_name!)
        });
      }
    }

    // Calcular estatísticas do corretor
    const externalCount = externalAssignments.length;
    const internalAssignments = enrichedAssignments.filter(a => a.location_type === "internal");
    const internalCount = internalAssignments.length;
    const saturdayCount = enrichedAssignments.filter(a => 
      getDay(new Date(a.assignment_date + "T00:00:00")) === 6
    ).length;

    // Gerar breakdown semanal
    const weeklyBreakdown: WeeklyBreakdown[] = [];
    const allByWeek = groupByWeek(enrichedAssignments);
    for (const [weekKey, weekAssignments] of allByWeek) {
      weeklyBreakdown.push({
        weekLabel: weekKey,
        weekStart: weekAssignments[0].assignment_date,
        externalCount: weekAssignments.filter(a => a.location_type === "external").length,
        internalCount: weekAssignments.filter(a => a.location_type === "internal").length,
        saturdayCount: weekAssignments.filter(a => getDay(new Date(a.assignment_date + "T00:00:00")) === 6).length,
        locations: [...new Set(weekAssignments.map(a => a.location_name!))],
        dates: weekAssignments.map(a => a.assignment_date)
      });
    }

    // ═══════════════════════════════════════════════════════════
    // REGRA 5: Rodízio de externos para corretores Seg-Dom
    // Corretores com sábado devem alternar: 1→2→1→2 ou 2→1→2→1
    // ═══════════════════════════════════════════════════════════
    const hasSaturday = broker?.availableWeekdays?.includes('saturday');
    
    if (hasSaturday && weeklyBreakdown.length >= 2) {
      // Ordenar semanas por data
      const sortedWeeks = [...weeklyBreakdown].sort((a, b) => 
        a.weekStart.localeCompare(b.weekStart)
      );
      
      // Contar DIAS únicos com externos por semana (não turnos)
      const externalDaysByWeek: { weekLabel: string; dayCount: number }[] = [];
      for (const week of sortedWeeks) {
        const weekExternals = enrichedAssignments.filter(a => 
          a.location_type === "external" && 
          week.dates.includes(a.assignment_date)
        );
        const uniqueDays = new Set(weekExternals.map(a => a.assignment_date));
        externalDaysByWeek.push({ weekLabel: week.weekLabel, dayCount: uniqueDays.size });
      }
      
      // Verificar se há duas semanas consecutivas com o mesmo número de dias externos
      for (let i = 1; i < externalDaysByWeek.length; i++) {
        const prev = externalDaysByWeek[i - 1];
        const curr = externalDaysByWeek[i];
        
        // Se ambas têm 1 dia externo (deveria alternar para 2)
        if (prev.dayCount === 1 && curr.dayCount === 1) {
          brokerViolations.push({
            rule: "RODIZIO_EXTERNOS_NAO_ALTERNADO",
            severity: "warning",
            brokerName,
            brokerId,
            details: `${brokerName} (Seg-Dom) teve 1 dia externo nas semanas ${prev.weekLabel} e ${curr.weekLabel}. Após 1 externo, deveria ter 2.`,
          });
        }
        
        // Se ambas têm 2 dias externos (deveria alternar para 1)
        if (prev.dayCount === 2 && curr.dayCount === 2) {
          brokerViolations.push({
            rule: "RODIZIO_EXTERNOS_NAO_ALTERNADO",
            severity: "warning",
            brokerName,
            brokerId,
            details: `${brokerName} (Seg-Dom) teve 2 dias externos nas semanas ${prev.weekLabel} e ${curr.weekLabel}. Após 2 externos, deveria ter 1.`,
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // REGRA 6: Concentração de domingos externos
    // Se um corretor recebeu mais de 50% dos domingos do mês, gerar warning
    // ═══════════════════════════════════════════════════════════
    const sundayExternals = externalAssignments.filter(a => 
      getDay(new Date(a.assignment_date + "T00:00:00")) === 0
    );
    
    if (sundayExternals.length > 0) {
      // Verificar por local - cada local deve ter rotação de domingos
      const sundaysByLocation = new Map<string, Assignment[]>();
      for (const a of sundayExternals) {
        if (!sundaysByLocation.has(a.location_id)) {
          sundaysByLocation.set(a.location_id, []);
        }
        sundaysByLocation.get(a.location_id)!.push(a);
      }
      
      for (const [locationId, locSundays] of sundaysByLocation) {
        const locationName = locationMap.get(locationId)?.name || "Desconhecido";
        // Se o corretor tem mais de 2 domingos no mesmo local, é concentração excessiva
        if (locSundays.length > 2) {
          brokerViolations.push({
            rule: "CONCENTRACAO_DOMINGOS",
            severity: "warning",
            brokerName,
            brokerId,
            details: `${brokerName} recebeu ${locSundays.length} domingos no ${locationName} - deveria haver mais rotação`,
            dates: locSundays.map(a => a.assignment_date),
            locations: [locationName]
          });
        }
      }
    }

    brokerReports.push({
      brokerId,
      brokerName,
      totalAssignments: enrichedAssignments.length,
      externalCount,
      internalCount,
      saturdayCount,
      weeklyBreakdown,
      violations: brokerViolations
    });

    violations.push(...brokerViolations);
  }

  // ═══════════════════════════════════════════════════════════
  // REGRA GLOBAL: DISTRIBUIÇÃO 2-ANTES-DE-3
  // Se um corretor tem 3+ externos enquanto outro tem menos de 2, é ERROR
  // IMPORTANTE: Corretores que só trabalham em internos (0 externos e tem
  // internos) são excluídos desta verificação — eles não estão cadastrados
  // nos locais externos, então não faz sentido compará-los.
  // ═══════════════════════════════════════════════════════════
  const externalCountsByBroker = new Map<string, { name: string; count: number }>();
  for (const report of brokerReports) {
    // Pular corretores que são exclusivamente internos (não têm nenhum externo e têm internos)
    if (report.externalCount === 0 && report.internalCount > 0) {
      continue;
    }
    externalCountsByBroker.set(report.brokerId, { 
      name: report.brokerName, 
      count: report.externalCount 
    });
  }
  
  const brokersWithLessThan2: string[] = [];
  const brokersWith3OrMore: string[] = [];
  
  for (const [brokerId, info] of externalCountsByBroker) {
    if (info.count < 2) {
      brokersWithLessThan2.push(`${info.name} (${info.count})`);
    }
    if (info.count >= 3) {
      brokersWith3OrMore.push(`${info.name} (${info.count})`);
    }
  }
  
  if (brokersWith3OrMore.length > 0 && brokersWithLessThan2.length > 0) {
    violations.push({
      rule: "DISTRIBUICAO_2_ANTES_3",
      severity: "error",
      brokerName: "Distribuição Geral",
      brokerId: "",
      details: `Distribuição desbalanceada de externos: Os corretores ${brokersWith3OrMore.join(", ")} já têm 3 ou mais plantões externos, mas ${brokersWithLessThan2.join(", ")} ainda não atingiram 2. Todos devem ter pelo menos 2 antes que alguém receba o 3º.`,
      dates: [],
      locations: []
    });
  }

  // Ordenar violations por severidade
  violations.sort((a, b) => {
    if (a.severity === "error" && b.severity !== "error") return -1;
    if (a.severity !== "error" && b.severity === "error") return 1;
    return a.brokerName.localeCompare(b.brokerName);
  });

  const errorCount = violations.filter(v => v.severity === "error").length;
  const warningCount = violations.filter(v => v.severity === "warning").length;
  
  // Adicionar demandas não alocadas como violações
  for (const demand of unallocatedDemands) {
    const formattedDate = formatDateBR(demand.date);
    const shiftLabel = demand.shift === "morning" ? "Manhã" : "Tarde";
    let detailsText = `Turno não alocado: ${demand.locationName} - ${formattedDate} (${shiftLabel})`;
    if (demand.reason) {
      detailsText += `. Motivo: ${demand.reason}`;
    }
    violations.push({
      rule: "TURNO_NAO_ALOCADO",
      severity: "error",
      brokerName: "—",
      brokerId: "",
      details: detailsText,
      dates: [demand.date],
      locations: [demand.locationName]
    });
  }
  
  const totalErrors = errorCount + unallocatedDemands.length;

  return {
    isValid: totalErrors === 0,
    violations,
    summary: {
      totalAssignments: assignments.length,
      totalBrokers: assignmentsByBroker.size,
      errorCount: totalErrors,
      warningCount,
      unallocatedCount: unallocatedDemands.length
    },
    brokerReports,
    unallocatedDemands
  };
}

// ═══════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════

// Formata data ISO para DD/MM/AAAA
function formatDateBR(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Usa semana ISO (segunda-feira como início da semana)
function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00");
  return getISOWeek(date);
}

function groupByWeek(assignments: Assignment[]): Map<string, Assignment[]> {
  const result = new Map<string, Assignment[]>();
  
  for (const a of assignments) {
    const date = new Date(a.assignment_date + "T00:00:00");
    const weekNum = getWeekNumber(a.assignment_date);
    const weekKey = `S${weekNum}`;
    
    if (!result.has(weekKey)) {
      result.set(weekKey, []);
    }
    result.get(weekKey)!.push(a);
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO PARA GERAR RELATÓRIO LEGÍVEL
// ═══════════════════════════════════════════════════════════
export function generateValidationReport(result: PostValidationResult): string {
  const lines: string[] = [];
  
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("           RELATÓRIO DE VALIDAÇÃO PÓS-GERAÇÃO              ");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`📊 RESUMO:`);
  lines.push(`   Total de alocações: ${result.summary.totalAssignments}`);
  lines.push(`   Total de corretores: ${result.summary.totalBrokers}`);
  lines.push(`   Erros encontrados: ${result.summary.errorCount}`);
  lines.push(`   Avisos encontrados: ${result.summary.warningCount}`);
  lines.push(`   Status: ${result.isValid ? "✅ VÁLIDO" : "❌ INVÁLIDO"}`);
  lines.push("");

  if (result.violations.length > 0) {
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("                      VIOLAÇÕES                            ");
    lines.push("═══════════════════════════════════════════════════════════");
    
    for (const v of result.violations) {
      const icon = v.severity === "error" ? "❌" : "⚠️";
      lines.push(`${icon} [${v.rule}] ${v.details}`);
      if (v.dates && v.dates.length > 0) {
        lines.push(`   Datas: ${v.dates.join(", ")}`);
      }
      if (v.locations && v.locations.length > 0) {
        lines.push(`   Locais: ${v.locations.join(", ")}`);
      }
      lines.push("");
    }
  }

  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("               RELATÓRIO POR CORRETOR                      ");
  lines.push("═══════════════════════════════════════════════════════════");

  for (const report of result.brokerReports) {
    const hasErrors = report.violations.some(v => v.severity === "error");
    const icon = hasErrors ? "❌" : "✅";
    
    lines.push("");
    lines.push(`${icon} ${report.brokerName}`);
    lines.push(`   Total: ${report.totalAssignments} | Externos: ${report.externalCount} | Internos: ${report.internalCount} | Sábados: ${report.saturdayCount}`);
    
    for (const week of report.weeklyBreakdown) {
      lines.push(`   ${week.weekLabel}: ${week.externalCount} ext, ${week.internalCount} int | ${week.locations.join(", ")}`);
    }
    
    if (report.violations.length > 0) {
      lines.push(`   ⚠️ Violações: ${report.violations.length}`);
      for (const v of report.violations) {
        lines.push(`      - ${v.rule}: ${v.details}`);
      }
    }
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO PARA LOG NO CONSOLE
// ═══════════════════════════════════════════════════════════
export function logValidationResult(result: PostValidationResult): void {
  console.log("\n" + generateValidationReport(result));
}

// ═══════════════════════════════════════════════════════════
// DETECÇÃO INDEPENDENTE DE DEMANDAS NÃO ALOCADAS
// Consulta Supabase para comparar configs vs alocações
// Funciona tanto na geração quanto na re-validação
// ═══════════════════════════════════════════════════════════
export async function detectUnallocatedDemands(
  assignments: { location_id: string; assignment_date: string; shift_type: string; broker_id?: string }[],
  weekStartDate: string,
  weekEndDate: string
): Promise<UnallocatedDemand[]> {
  const results: UnallocatedDemand[] = [];
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  console.log(`🔍 detectUnallocatedDemands: ${weekStartDate} → ${weekEndDate}`);

  // Buscar locais ativos com períodos e configs
  const { data: locations } = await supabase.from("locations").select(`
    id, name, location_type, shift_config_mode,
    location_periods (id, period_type, start_date, end_date, period_day_configs (weekday, has_morning, has_afternoon))
  `).eq("is_active", true);

  // Buscar configs de data específica
  const { data: allSpecificConfigs } = await supabase
    .from("period_specific_day_configs")
    .select("*");

  const specificConfigsMap = new Map<string, any>();
  allSpecificConfigs?.forEach((config: any) => {
    specificConfigsMap.set(`${config.period_id}-${config.specific_date}`, config);
  });

  // Buscar corretores configurados por local para justificativa
  const { data: locationBrokersData } = await supabase
    .from("location_brokers")
    .select("location_id, broker_id, brokers(name)");

  const locationBrokersMap = new Map<string, { brokerId: string; brokerName: string }[]>();
  locationBrokersData?.forEach((lb: any) => {
    if (!locationBrokersMap.has(lb.location_id)) {
      locationBrokersMap.set(lb.location_id, []);
    }
    locationBrokersMap.get(lb.location_id)!.push({
      brokerId: lb.broker_id,
      brokerName: lb.brokers?.name || "Desconhecido"
    });
  });

  // Iterar cada dia do range
  const start = new Date(weekStartDate + "T00:00:00");
  const end = new Date(weekEndDate + "T00:00:00");

  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = weekdays[date.getDay()];

    for (const location of locations || []) {
      // Encontrar período ativo para esta data
      const period = (location as any).location_periods?.find(
        (p: any) => p.start_date <= dateStr && p.end_date >= dateStr
      );
      if (!period) continue;

      let expectedMorning = false;
      let expectedAfternoon = false;

      // Verificar config de data específica primeiro
      const specificConfig = specificConfigsMap.get(`${period.id}-${dateStr}`);

      if (specificConfig) {
        expectedMorning = specificConfig.has_morning;
        expectedAfternoon = specificConfig.has_afternoon;
      } else if ((location as any).shift_config_mode === 'specific_date') {
        continue;
      } else {
        const dayConfig = period.period_day_configs?.find((dc: any) => dc.weekday === dayOfWeek);
        if (dayConfig) {
          expectedMorning = dayConfig.has_morning;
          expectedAfternoon = dayConfig.has_afternoon;
        }
      }

      // Comparar com alocações existentes
      const hasMorningAssignment = assignments.some(
        a => a.location_id === location.id && a.assignment_date === dateStr && a.shift_type === "morning"
      );
      const hasAfternoonAssignment = assignments.some(
        a => a.location_id === location.id && a.assignment_date === dateStr && a.shift_type === "afternoon"
      );

      const missingShifts: ("morning" | "afternoon")[] = [];
      if (expectedMorning && !hasMorningAssignment) missingShifts.push("morning");
      if (expectedAfternoon && !hasAfternoonAssignment) missingShifts.push("afternoon");

      for (const shift of missingShifts) {
        const shiftLabel = shift === "morning" ? "Manhã" : "Tarde";
        console.error(`❌ FALTANDO: ${location.name} - ${dateStr} - ${shiftLabel}`);

        // Gerar justificativa
        const configuredBrokers = locationBrokersMap.get(location.id) || [];
        let reason: string;

        if (configuredBrokers.length === 0) {
          reason = "Nenhum corretor está configurado para este local.";
        } else {
          // Verificar onde cada corretor configurado está alocado neste dia/turno
          const brokerReasons: string[] = [];
          for (const cb of configuredBrokers) {
            const brokerAssignment = assignments.find(
              a => a.location_id !== location.id && 
                   a.assignment_date === dateStr && 
                   a.shift_type === shift &&
                   a.broker_id === cb.brokerId
            );
            // Also check if broker has ANY assignment on this date/shift (even same location different context)
            const anyAssignment = assignments.find(
              a => a.assignment_date === dateStr && 
                   a.shift_type === shift &&
                   a.broker_id === cb.brokerId
            );

            if (anyAssignment) {
              // Find the location name for where the broker is
              const allocatedLocation = locations?.find(l => l.id === anyAssignment.location_id);
              const locName = allocatedLocation?.name || "outro local";
              brokerReasons.push(`${cb.brokerName} (já alocado no ${locName})`);
            } else {
              // Broker not allocated on this shift — could be unavailable, blocked by rules, etc.
              const otherShiftAssignment = assignments.find(
                a => a.assignment_date === dateStr && 
                     a.shift_type !== shift &&
                     a.broker_id === cb.brokerId
              );
              if (otherShiftAssignment) {
                const allocatedLocation = locations?.find(l => l.id === otherShiftAssignment.location_id);
                const locName = allocatedLocation?.name || "outro local";
                brokerReasons.push(`${cb.brokerName} (alocado no turno da ${otherShiftAssignment.shift_type === "morning" ? "manhã" : "tarde"} no ${locName})`);
              } else {
                brokerReasons.push(`${cb.brokerName} (não alocado — possível bloqueio por regras de escala)`);
              }
            }
          }
          reason = `Corretores configurados: ${brokerReasons.join("; ")}. Nenhum pôde ser alocado.`;
        }

        results.push({
          locationId: location.id,
          locationName: location.name,
          date: dateStr,
          shift,
          reason
        });
      }
    }
  }

  console.log(`🔍 detectUnallocatedDemands: ${results.length} turnos não alocados encontrados`);
  return results;
}
