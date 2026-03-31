import { supabase } from "@/integrations/supabase/client";
import { format, addDays, subDays, differenceInDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  syncSaturdayQueueForLocation,
  getSaturdayQueueForLocation,
  updateSaturdayQueueAfterAllocation,
  getPreviousWeekStatsWithFallback,
  saveBrokerWeeklyStats,
  SaturdayQueueItem,
  BrokerWeeklyStat,
} from "@/hooks/useSaturdayQueue";
import {
  syncAllLocationRotationQueues,
  getMultipleLocationRotationQueues,
  bulkUpdateLocationQueuesAfterAllocation,
  LocationRotationQueueItem,
} from "@/hooks/useLocationRotationQueue";
import { validateAllRulesCompliance, logViolations, RuleViolation } from "./scheduleValidator";
import { DecisionTraceEntry, BrokerAllocationDiagnostic, EligibilityExclusion, CompetitionTraceEntry, SubAllocatedForensic, BrokerExternalEligibility, BrokerLocationEligibility, setLastGenerationTrace } from "./generationTrace";
export type { DecisionTraceEntry, BrokerAllocationDiagnostic, EligibilityExclusion, BrokerExternalEligibility };
export { getLastGenerationTrace } from "./generationTrace";

// ═══════════════════════════════════════════════════════════
// INTERFACES PARA RETRY SYSTEM
// ═══════════════════════════════════════════════════════════
export interface RetryResult {
  assignments: ScheduleAssignment[];
  success: boolean;
  attempts: number;
  violations?: RuleViolation[];
}

interface BrokerInfoForValidation {
  id: string;
  name: string;
}

interface LocationInfoForValidation {
  id: string;
  name: string;
  type: string;
  builderCompany?: string;
}

// ═══════════════════════════════════════════════════════════
// SHUFFLE DETERMINÍSTICO COM SEED
// Permite variar a ordem de forma reproduzível entre tentativas
// ═══════════════════════════════════════════════════════════
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Pseudo-random baseado na seed (algoritmo LCG)
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

export interface ScheduleAssignment {
  id?: string;
  broker_id: string;
  broker?: any;
  location_id: string;
  location?: any;
  assignment_date: string;
  shift_type: "morning" | "afternoon";
  start_time: string;
  end_time: string;
}

interface BrokerQueueItem {
  brokerId: string;
  brokerName: string;
  externalShiftCount: number;
  lastExternalDate: Date | null;
  availableWeekdays: string[];
  internalLocation?: "bessa" | "tambau" | null;
  recentSaturdayTotalCount: number;
  previousWeekExternals?: number;
  // Número de locais externos configurados para este corretor
  externalLocationCount: number;
  // SISTEMA DE CRÉDITO: Quantos externos este corretor DEVE receber esta semana
  externalCredit: number;
  // Target original calculado para esta semana
  targetExternals: number;
  // Flag: trabalhou sábado interno na SEMANA ANTERIOR
  // Quem trabalhou sábado na semana passada recebe compensação dinâmica esta semana
  workedSaturdayLastWeek: boolean;
}

interface ExternalDemand {
  locationId: string;
  locationName: string;
  date: Date;
  dateStr: string;
  dayOfWeek: string;
  shift: "morning" | "afternoon";
  startTime: string;
  endTime: string;
  eligibleBrokerIds: string[];
  builderCompany: string | null;
  needsSameBroker: boolean;
  locationBrokerMap: Map<string, { available_morning: boolean; available_afternoon: boolean }>;
}

// DecisionTraceEntry e BrokerAllocationDiagnostic agora importados de ./generationTrace

export interface GenerationQualityReport {
  totalExternalDemands: number;
  allocatedPass1: number;
  allocatedPass2: number;
  allocatedPass3: number;
  allocatedPass4: number;
  allocatedPass5: number;
  unallocated: number;
  impossibleDemands: ExternalDemand[];
  brokerDistribution: { brokerId: string; brokerName: string; count: number }[];
  relaxedAllocations: { demand: string; pass: number; reason: string }[];
  decisionTrace: DecisionTraceEntry[];
  brokerDiagnostics: BrokerAllocationDiagnostic[];
}

interface WeeklyAccumulator {
  saturdayCounts: { [brokerId: string]: number };
  saturdayQueue: SaturdayQueueItem[];
  bessaSaturdayQueue: SaturdayQueueItem[]; // Fila de sábado do Bessa
  previousWeekStats: BrokerWeeklyStat[];
  lastWeekExternals: { brokerId: string; date: string }[];
  externalCountsThisMonth: { [brokerId: string]: number };
  lastWeekTambauSaturdayBrokers: string[]; // Corretores que trabalharam no sábado de Tambaú da semana anterior
  // FILA DE ROTAÇÃO POR LOCAL - Carregada UMA VEZ e passada entre semanas
  locationRotationQueues: Map<string, LocationRotationQueueItem[]>;
  // ═══════════════════════════════════════════════════════════
  // NOVOS CONTADORES MENSAIS para balanceamento de sábado/domingo
  // ═══════════════════════════════════════════════════════════
  monthSaturdayCount: { [brokerId: string]: number }; // Total de sábados (qualquer local) no mês
  monthSundayCount: { [brokerId: string]: number }; // Total de domingos no mês
  // Domingos por local específico (para evitar concentração ex: Taciana 4x Nammos)
  monthSundayAtLocation: { [locationId: string]: { [brokerId: string]: number } };
}

// ═══════════════════════════════════════════════════════════
// FASE NOVA: ANÁLISE DE GARGALOS E RESERVAS OBRIGATÓRIAS
// ═══════════════════════════════════════════════════════════

interface BottleneckAnalysis {
  demandKey: string;
  demand: ExternalDemand;
  eligibleBrokers: string[];
  priority: 'critical' | 'high' | 'normal';
  reservedBrokerId?: string;
  reservationReason?: string;
}

interface MandatoryReservation {
  brokerId: string;
  brokerName: string;
  demandKey: string;
  demandLocationName: string;
  demandDateStr: string;
  demandShift: string;
  reason: string;
}

// Mapa global de reservas obrigatórias para a semana
type ReservationMap = Map<string, MandatoryReservation>;

async function getPreviousSchedules(weeksToFetch: number = 3) {
  const { data } = await supabase
    .from("generated_schedules")
    .select(`
      id,
      week_start_date,
      schedule_assignments (
        broker_id,
        assignment_date,
        location_id,
        locations (location_type)
      )
    `)
    .order("week_start_date", { ascending: false })
    .limit(weeksToFetch);

  if (!data || data.length === 0) return { brokerCounts: {}, brokerLastDates: {}, saturdayTotalCounts: {} };

  const brokerCounts: { [key: string]: number } = {};
  const brokerLastDates: { [key: string]: Date } = {};
  const saturdayTotalCounts: { [key: string]: number } = {};

  data.forEach((schedule: any) => {
    schedule.schedule_assignments?.forEach((assignment: any) => {
      const assignmentDate = new Date(assignment.assignment_date + "T00:00:00");
      
      if (assignmentDate.getDay() === 6) {
        saturdayTotalCounts[assignment.broker_id] = (saturdayTotalCounts[assignment.broker_id] || 0) + 1;
      }
      
      if (assignment.locations?.location_type === "external") {
        brokerCounts[assignment.broker_id] = (brokerCounts[assignment.broker_id] || 0) + 1;
        
        if (!brokerLastDates[assignment.broker_id] || assignmentDate > brokerLastDates[assignment.broker_id]) {
          brokerLastDates[assignment.broker_id] = assignmentDate;
        }
      }
    });
  });

  return { brokerCounts, brokerLastDates, saturdayTotalCounts };
}

function sortBrokerQueueForSaturday(queue: BrokerQueueItem[], isSaturday: boolean, seed?: number): BrokerQueueItem[] {
  // CORREÇÃO: Aplicar shuffle com seed ANTES de ordenar para eliminar viés alfabético
  // Quando critérios de ordenação são iguais, a ordem do shuffle prevalece
  const shuffledQueue = seed ? shuffleWithSeed([...queue], seed) : [...queue];
  
  return shuffledQueue.sort((a, b) => {
    if (isSaturday) {
      if (a.internalLocation === "tambau" && b.internalLocation !== "tambau") return -1;
      if (b.internalLocation === "tambau" && a.internalLocation !== "tambau") return 1;
      if (a.internalLocation === "bessa" && b.internalLocation !== "bessa") return 1;
      if (b.internalLocation === "bessa" && a.internalLocation !== "bessa") return -1;
      
      if (a.recentSaturdayTotalCount !== b.recentSaturdayTotalCount) {
        return a.recentSaturdayTotalCount - b.recentSaturdayTotalCount;
      }
    }
    
    if (a.externalShiftCount !== b.externalShiftCount) {
      return a.externalShiftCount - b.externalShiftCount;
    }
    if (!a.lastExternalDate) return -1;
    if (!b.lastExternalDate) return 1;
    return a.lastExternalDate.getTime() - b.lastExternalDate.getTime();
  });
}

function sortBrokerQueue(queue: BrokerQueueItem[], seed?: number): BrokerQueueItem[] {
  return sortBrokerQueueForSaturday(queue, false, seed);
}

// ═══════════════════════════════════════════════════════════
// SISTEMA DE PASSES COM RELAXAMENTO PROGRESSIVO
// ═══════════════════════════════════════════════════════════

interface AllocationContext {
  assignments: ScheduleAssignment[];
  brokerQueue: BrokerQueueItem[];
  externalShiftTargets: Map<string, number>;
  dailyExternalAssignments: Map<string, Set<string>>;
  weekendExternalAssignments: Map<string, string>;
  externalLocations: any[];
  saturdayBessaExternalCount: Map<string, number>;
  lastWeekExternals: { brokerId: string; date: string }[];
  allocatedExternalDays: Map<string, Set<string>>;
  // NOVO: Mapa de reservas obrigatórias
  mandatoryReservations: ReservationMap;
  // NOVO: Corretores pré-identificados para trabalhar sábado interno (Tambaú)
  saturdayInternalWorkers: Set<string>;
  // NOVO: Corretores que foram alocados para sábado EXTERNO (target = 1 externo após isso)
  saturdayExternalWorkers: Set<string>;
  // NOVO: Filas de rotação por local externo
  locationRotationQueues: Map<string, LocationRotationQueueItem[]>;
  // NOVO: Rastrear alocações para atualizar filas
  locationAllocationsForQueueUpdate: Array<{ location_id: string; broker_id: string; assignment_date: string }>;
  // NOVO: IDs de locais internos para verificar regra de fim de semana
  internalLocationIds?: Set<string>;
  // NOVO: Contador diário de corretores do Bessa com externos (para proteção em dias de semana)
  dailyBessaExternalCount: Map<string, number>;
  // ═══════════════════════════════════════════════════════════
  // NOVOS CONTADORES MENSAIS para balanceamento de domingo
  // ═══════════════════════════════════════════════════════════
  monthSundayCount?: { [brokerId: string]: number };
  monthSundayAtLocation?: { [locationId: string]: { [brokerId: string]: number } };
}

const MAX_EXTERNAL_SHIFTS_PER_WEEK = 2;
const MAX_EXTERNAL_SHIFTS_HARD_CAP = 3; // NUNCA pode exceder 3 - hard limit absoluto

// ═══════════════════════════════════════════════════════════
// FUNÇÃO AUXILIAR: VERIFICAR 3 DIAS EXTERNOS CONSECUTIVOS
// REGRA ABSOLUTAMENTE INVIOLÁVEL - NUNCA PODE SER RELAXADA
// ═══════════════════════════════════════════════════════════
function hasThreeConsecutiveExternals(
  brokerId: string,
  newDateStr: string,
  context: AllocationContext
): boolean {
  // Coletar todas as datas com externo para este corretor (incluindo a nova)
  const existingExternalDates: Date[] = [];
  
  for (const [dateStr, brokerSet] of context.dailyExternalAssignments.entries()) {
    if (brokerSet.has(brokerId)) {
      existingExternalDates.push(new Date(dateStr + "T00:00:00"));
    }
  }
  
  // Adicionar a nova data
  const newDate = new Date(newDateStr + "T00:00:00");
  const allDates = [...existingExternalDates, newDate].sort((a, b) => a.getTime() - b.getTime());
  
  // Se menos de 3 datas, impossível ter 3 consecutivos
  if (allDates.length < 3) return false;
  
  // Verificar se há sequência de 3 dias consecutivos
  for (let i = 0; i < allDates.length - 2; i++) {
    const diff1 = differenceInDays(allDates[i + 1], allDates[i]);
    const diff2 = differenceInDays(allDates[i + 2], allDates[i + 1]);
    
    if (diff1 === 1 && diff2 === 1) {
      console.log(`   ❌ BLOQUEIO ABSOLUTO: ${brokerId} teria 3 dias externos consecutivos: ${format(allDates[i], "dd/MM")}, ${format(allDates[i+1], "dd/MM")}, ${format(allDates[i+2], "dd/MM")}`);
      return true; // Encontrou 3 dias consecutivos
    }
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO AUXILIAR: VERIFICAR SE CORRETOR TEM QUALQUER PLANTÃO NO FIM DE SEMANA
// REGRA CORRIGIDA: Sábado OU Domingo, não ambos (INTERNO OU EXTERNO)
// NOVA VERSÃO: Aceita saturdayInternalWorkers para verificar pré-identificados
// ═══════════════════════════════════════════════════════════
function hasWeekendConflict(
  brokerId: string,
  demandDate: Date,
  demandDayOfWeek: string,
  assignments: ScheduleAssignment[],
  saturdayInternalWorkers?: Set<string>
): { hasConflict: boolean; conflictDay: string } {
  // Se a demanda é sábado, verificar se já tem QUALQUER plantão no domingo
  if (demandDayOfWeek === "saturday") {
    const sundayStr = format(addDays(demandDate, 1), "yyyy-MM-dd");
    const hasSunday = assignments.some(a => 
      a.broker_id === brokerId && 
      a.assignment_date === sundayStr
    );
    if (hasSunday) {
      return { hasConflict: true, conflictDay: "domingo" };
    }
  }
  
  // Se a demanda é domingo, verificar se já tem QUALQUER plantão no sábado
  if (demandDayOfWeek === "sunday") {
    const saturdayStr = format(subDays(demandDate, 1), "yyyy-MM-dd");
    
    // REMOVIDO: Bloqueio fantasma por pré-reserva de sábado interno
    // O bloqueio real ocorre naturalmente após ETAPA 8.9 quando a alocação real existe
    
    // Verificar alocações já realizadas
    const hasSaturday = assignments.some(a => 
      a.broker_id === brokerId && 
      a.assignment_date === saturdayStr
    );
    if (hasSaturday) {
      return { hasConflict: true, conflictDay: "sábado" };
    }
  }
  
  return { hasConflict: false, conflictDay: "" };
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO AUXILIAR: CONTAR PARES CONSECUTIVOS QUE SERIAM CRIADOS
// Usada para escolher o corretor que minimiza impacto de consecutivos
// ═══════════════════════════════════════════════════════════
function countConsecutivePairsIfAllocated(
  brokerId: string,
  newDateStr: string,
  context: AllocationContext
): number {
  const newDate = new Date(newDateStr + "T00:00:00");
  const prevDateStr = format(subDays(newDate, 1), "yyyy-MM-dd");
  const nextDateStr = format(addDays(newDate, 1), "yyyy-MM-dd");
  
  let pairs = 0;
  
  // Verificar se tem externo no dia anterior
  if (context.dailyExternalAssignments.get(prevDateStr)?.has(brokerId)) {
    pairs++;
  }
  
  // Verificar se tem externo no dia seguinte
  if (context.dailyExternalAssignments.get(nextDateStr)?.has(brokerId)) {
    pairs++;
  }
  
  return pairs;
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO CENTRALIZADA DE VERIFICAÇÃO DE REGRAS INVIOLÁVEIS
// Esta função DEVE ser chamada em TODOS os pontos de alocação
// ═══════════════════════════════════════════════════════════
interface InviolableRulesCheck {
  allowed: boolean;
  reason: string;
  rule?: string;
}

// ═══════════════════════════════════════════════════════════
// REGRAS VERDADEIRAMENTE INVIOLÁVEIS (NUNCA RELAXAR)
// NÃO inclui limite de 2 externos por semana - isso pode ser relaxado
// INCLUI: Regra 4 (locais diferentes no mesmo dia) e Regra 6 (construtoras)
// ATUALIZADO: Regra 9 agora verifica QUALQUER plantão (interno ou externo)
// ═══════════════════════════════════════════════════════════
function checkTrulyInviolableRules(
  broker: BrokerQueueItem,
  demand: ExternalDemand,
  context: AllocationContext
): InviolableRulesCheck {
  // ═══════════════════════════════════════════════════════════
  // REGRA ABSOLUTAMENTE INVIOLÁVEL: 3 DIAS EXTERNOS CONSECUTIVOS
  // Esta regra NUNCA pode ser relaxada sob nenhuma circunstância
  // ═══════════════════════════════════════════════════════════
  if (hasThreeConsecutiveExternals(broker.brokerId, demand.dateStr, context)) {
    return { 
      allowed: false, 
      reason: "PROIBIDO: 3 dias externos consecutivos - regra absoluta",
      rule: "REGRA_3_DIAS_SEGUIDOS"
    };
  }
  
  // REGRA FÍSICA 1: Conflito físico - mesmo turno em outro local
  const hasPhysicalConflict = context.assignments.some(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.shift_type === demand.shift &&
    a.location_id !== demand.locationId
  );
  
  if (hasPhysicalConflict) {
    return { 
      allowed: false, 
      reason: "Conflito físico: mesmo turno em outro local",
      rule: "FÍSICO"
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 4: Não pode ter externo no mesmo dia em OUTRO local externo
  // Esta regra é INVIOLÁVEL - não pode ser relaxada
  // ═══════════════════════════════════════════════════════════
  const hasOtherExternalSameDay = context.assignments.some(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id !== demand.locationId &&
    // Verificar se é um local externo (não interno)
    context.externalLocations?.some(l => l.id === a.location_id)
  );
  
  if (hasOtherExternalSameDay) {
    const otherAssignment = context.assignments.find(a =>
      a.broker_id === broker.brokerId &&
      a.assignment_date === demand.dateStr &&
      a.location_id !== demand.locationId &&
      context.externalLocations?.some(l => l.id === a.location_id)
    );
    const otherLocName = context.externalLocations?.find(l => l.id === otherAssignment?.location_id)?.name || "outro local";
    return { 
      allowed: false, 
      reason: `REGRA 4: Já tem externo em ${otherLocName} no mesmo dia`,
      rule: "REGRA4_MULTIPLOS_LOCAIS"
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 6: Conflito de construtora - mesmo dia, construtoras diferentes
  // Esta regra é INVIOLÁVEL - não pode ser relaxada
  // ═══════════════════════════════════════════════════════════
  if (demand.builderCompany) {
    const hasOtherBuilder = context.assignments.some(a => {
      if (a.broker_id !== broker.brokerId) return false;
      if (a.assignment_date !== demand.dateStr) return false;
      
      // Encontrar a construtora do outro local
      const otherLocation = context.externalLocations?.find(l => l.id === a.location_id);
      if (!otherLocation?.builder_company) return false;
      
      // Conflito: construtoras diferentes
      return otherLocation.builder_company !== demand.builderCompany;
    });
    
    if (hasOtherBuilder) {
      const otherAssignment = context.assignments.find(a =>
        a.broker_id === broker.brokerId &&
        a.assignment_date === demand.dateStr &&
        context.externalLocations?.find(l => l.id === a.location_id)?.builder_company &&
        context.externalLocations?.find(l => l.id === a.location_id)?.builder_company !== demand.builderCompany
      );
      const otherBuilder = context.externalLocations?.find(l => l.id === otherAssignment?.location_id)?.builder_company || "outra";
      return { 
        allowed: false, 
        reason: `REGRA 6: Conflito de construtora (${demand.builderCompany} vs ${otherBuilder})`,
        rule: "REGRA6_CONSTRUTORA"
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA: Interno + Externo no mesmo dia
  // SÁBADO: PROIBIDO (erro hard)
  // SEG-SEX: Permitido se em turnos diferentes (interno manhã + externo tarde, etc.)
  // ═══════════════════════════════════════════════════════════
  const isSaturday = getDay(demand.date) === 6;
  const internalSameDayAssignments = context.assignments.filter(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id !== demand.locationId &&
    context.internalLocationIds?.has(a.location_id)
  );
  if (internalSameDayAssignments.length > 0) {
    if (isSaturday) {
      // Sábado: proibido sempre
      return { 
        allowed: false, 
        reason: "Já tem plantão interno no sábado - não pode acumular externo",
        rule: "INTERNO_EXTERNO_MESMO_DIA"
      };
    }
    // Seg-sex: proibido apenas se mesmo turno (conflito físico, não regra de negócio)
    const hasSameShiftConflict = internalSameDayAssignments.some(a => a.shift_type === demand.shift);
    if (hasSameShiftConflict) {
      return { 
        allowed: false, 
        reason: "Já tem plantão interno no mesmo turno - conflito de horário",
        rule: "FÍSICO"
      };
    }
    // Seg-sex em turnos diferentes: permitido (segue verificação)
  }
  
  // REGRA 8: Dias consecutivos externos - NÃO verificada aqui
  // Esta regra foi movida para checkTrulyInviolableRulesWithRelaxation()
  // para permitir relaxamento como último recurso
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 9 CORRIGIDA: Sábado OU Domingo (QUALQUER plantão, não só externo)
  // Se tem QUALQUER plantão no sábado → não pode ter nada no domingo
  // Se tem QUALQUER plantão no domingo → não pode ter nada no sábado
  // ═══════════════════════════════════════════════════════════
  const weekendCheck = hasWeekendConflict(
    broker.brokerId, 
    demand.date, 
    demand.dayOfWeek, 
    context.assignments
  );
  
  if (weekendCheck.hasConflict) {
    return { 
      allowed: false, 
      reason: `REGRA 9: Já tem plantão no ${weekendCheck.conflictDay}`,
      rule: "REGRA9_SAB_DOM"
    };
  }
  
  // REGRA FÍSICA 4: needsSameBroker - se manhã requer mesmo corretor à tarde
  if (demand.shift === "morning" && demand.needsSameBroker) {
    if (!demand.locationBrokerMap.get(broker.brokerId)?.available_afternoon) {
      return { 
        allowed: false, 
        reason: "Requer mesmo corretor mas não tem tarde disponível",
        rule: "SAME_BROKER"
      };
    }
  }
  
  // REGRA FÍSICA 5: Corretor não pode ter dois turnos no mesmo local externo (ABSOLUTA - SEM EXCEÇÕES)
  const hasOtherShiftSameLocation = context.assignments.some(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id === demand.locationId &&
    a.shift_type !== demand.shift
  );
  if (hasOtherShiftSameLocation) {
    return { 
      allowed: false, 
      reason: "PROIBIDO: Já tem outro turno no mesmo local externo",
      rule: "DOIS_TURNOS_MESMO_LOCAL"
    };
  }
  
  // REGRA FÍSICA 6: Deve estar na lista de elegíveis
  if (!demand.eligibleBrokerIds.includes(broker.brokerId)) {
    return { 
      allowed: false, 
      reason: "Não configurado para este local",
      rule: "ELEGIBILIDADE"
    };
  }
  
  return { allowed: true, reason: "OK" };
}

// ═══════════════════════════════════════════════════════════
// VERIFICAÇÃO DE REGRAS PARA ÚLTIMO RECURSO - REGRA 8 RELAXÁVEL
// Esta versão permite relaxar a Regra 8 (dias consecutivos) como último recurso
// ═══════════════════════════════════════════════════════════
interface RelaxableRulesCheck extends InviolableRulesCheck {
  relaxedRule8?: boolean; // true se Regra 8 foi relaxada
}

function checkTrulyInviolableRulesWithRelaxation(
  broker: BrokerQueueItem,
  demand: ExternalDemand,
  context: AllocationContext,
  allowRelaxRule8: boolean = false
): RelaxableRulesCheck {
  // ═══════════════════════════════════════════════════════════
  // REGRA ABSOLUTAMENTE INVIOLÁVEL: 3 DIAS EXTERNOS CONSECUTIVOS
  // MESMO COM REGRA 8 RELAXADA, esta regra NUNCA pode ser violada
  // ═══════════════════════════════════════════════════════════
  if (hasThreeConsecutiveExternals(broker.brokerId, demand.dateStr, context)) {
    return { 
      allowed: false, 
      reason: "PROIBIDO: 3 dias externos consecutivos (regra absoluta, mesmo com Regra 8 relaxada)",
      rule: "REGRA_3_DIAS_SEGUIDOS"
    };
  }
  
  // REGRA FÍSICA 1: Conflito físico - mesmo turno em outro local
  const hasPhysicalConflict = context.assignments.some(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.shift_type === demand.shift &&
    a.location_id !== demand.locationId
  );
  
  if (hasPhysicalConflict) {
    return { 
      allowed: false, 
      reason: "Conflito físico: mesmo turno em outro local",
      rule: "FÍSICO"
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 4: Não pode ter externo no mesmo dia em OUTRO local externo
  // INVIOLÁVEL - não pode ser relaxada
  // ═══════════════════════════════════════════════════════════
  const hasOtherExternalSameDay = context.assignments.some(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id !== demand.locationId &&
    context.externalLocations?.some(l => l.id === a.location_id)
  );
  
  if (hasOtherExternalSameDay) {
    const otherAssignment = context.assignments.find(a =>
      a.broker_id === broker.brokerId &&
      a.assignment_date === demand.dateStr &&
      a.location_id !== demand.locationId &&
      context.externalLocations?.some(l => l.id === a.location_id)
    );
    const otherLocName = context.externalLocations?.find(l => l.id === otherAssignment?.location_id)?.name || "outro local";
    return { 
      allowed: false, 
      reason: `REGRA 4: Já tem externo em ${otherLocName} no mesmo dia`,
      rule: "REGRA4_MULTIPLOS_LOCAIS"
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 6: Conflito de construtora - mesmo dia, construtoras diferentes
  // INVIOLÁVEL - não pode ser relaxada
  // ═══════════════════════════════════════════════════════════
  if (demand.builderCompany) {
    const hasOtherBuilder = context.assignments.some(a => {
      if (a.broker_id !== broker.brokerId) return false;
      if (a.assignment_date !== demand.dateStr) return false;
      
      const otherLocation = context.externalLocations?.find(l => l.id === a.location_id);
      if (!otherLocation?.builder_company) return false;
      
      return otherLocation.builder_company !== demand.builderCompany;
    });
    
    if (hasOtherBuilder) {
      const otherAssignment = context.assignments.find(a =>
        a.broker_id === broker.brokerId &&
        a.assignment_date === demand.dateStr &&
        context.externalLocations?.find(l => l.id === a.location_id)?.builder_company &&
        context.externalLocations?.find(l => l.id === a.location_id)?.builder_company !== demand.builderCompany
      );
      const otherBuilder = context.externalLocations?.find(l => l.id === otherAssignment?.location_id)?.builder_company || "outra";
      return { 
        allowed: false, 
        reason: `REGRA 6: Conflito de construtora (${demand.builderCompany} vs ${otherBuilder})`,
        rule: "REGRA6_CONSTRUTORA"
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA: Interno + Externo no mesmo dia (relaxamento)
  // SÁBADO: PROIBIDO sempre
  // SEG-SEX: Permitido se em turnos diferentes
  // ═══════════════════════════════════════════════════════════
  const isSaturdayRelax = getDay(demand.date) === 6;
  const internalSameDayRelax = context.assignments.filter(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id !== demand.locationId &&
    context.internalLocationIds?.has(a.location_id)
  );
  if (internalSameDayRelax.length > 0) {
    if (isSaturdayRelax) {
      return { 
        allowed: false, 
        reason: "Já tem plantão interno no sábado - não pode acumular externo",
        rule: "INTERNO_EXTERNO_MESMO_DIA"
      };
    }
    const hasSameShiftConflictRelax = internalSameDayRelax.some(a => a.shift_type === demand.shift);
    if (hasSameShiftConflictRelax) {
      return { 
        allowed: false, 
        reason: "Já tem plantão interno no mesmo turno - conflito de horário",
        rule: "FÍSICO"
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 8: Dias consecutivos externos - RELAXÁVEL como último recurso
  // ═══════════════════════════════════════════════════════════
  const prevDay = format(subDays(demand.date, 1), "yyyy-MM-dd");
  const nextDay = format(addDays(demand.date, 1), "yyyy-MM-dd");
  
  const hasConsecutivePrev = context.dailyExternalAssignments.get(prevDay)?.has(broker.brokerId);
  const hasConsecutiveNext = context.dailyExternalAssignments.get(nextDay)?.has(broker.brokerId);
  
  if (hasConsecutivePrev || hasConsecutiveNext) {
    if (allowRelaxRule8) {
      // Permitir com flag de relaxamento
      console.log(`   ⚠️ REGRA 8 RELAXADA: ${broker.brokerName} terá dias consecutivos (${hasConsecutivePrev ? prevDay : nextDay} + ${demand.dateStr})`);
      // Continua a verificação, mas marca que relaxou
    } else {
      const consecutiveDay = hasConsecutivePrev ? prevDay : nextDay;
      return { 
        allowed: false, 
        reason: `REGRA 8: Externo em ${consecutiveDay} (dia consecutivo)`,
        rule: "REGRA8_CONSECUTIVO"
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 9 CORRIGIDA: Sábado OU Domingo (QUALQUER plantão)
  // SEM bloqueio fantasma — só verifica alocações REAIS
  // ═══════════════════════════════════════════════════════════
  const weekendCheck = hasWeekendConflict(
    broker.brokerId, 
    demand.date, 
    demand.dayOfWeek, 
    context.assignments
  );
  
  if (weekendCheck.hasConflict) {
    return { 
      allowed: false, 
      reason: `REGRA 9: Já tem plantão no ${weekendCheck.conflictDay}`,
      rule: "REGRA9_SAB_DOM"
    };
  }
  
  // REGRA FÍSICA 5: Corretor não pode ter dois turnos no mesmo local externo (ABSOLUTA - SEM EXCEÇÕES)
  const hasOtherShiftSameLocationRelax = context.assignments.some(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id === demand.locationId &&
    a.shift_type !== demand.shift
  );
  if (hasOtherShiftSameLocationRelax) {
    return { 
      allowed: false, 
      reason: "PROIBIDO: Já tem outro turno no mesmo local externo",
      rule: "DOIS_TURNOS_MESMO_LOCAL"
    };
  }
  
  // REGRA: Deve estar na lista de elegíveis
  if (!demand.eligibleBrokerIds.includes(broker.brokerId)) {
    return { 
      allowed: false, 
      reason: "Não configurado para este local",
      rule: "ELEGIBILIDADE"
    };
  }
  
  return { 
    allowed: true, 
    reason: "OK",
    relaxedRule8: allowRelaxRule8 && (hasConsecutivePrev || hasConsecutiveNext)
  };
}

// ═══════════════════════════════════════════════════════════
// VERIFICA SE PODE EXCEDER O LIMITE DE 2 EXTERNOS
// Retorna true APENAS se TODOS os elegíveis já têm 2 ou estão bloqueados
// ═══════════════════════════════════════════════════════════
function canExceedLimit(
  demand: ExternalDemand,
  context: AllocationContext
): boolean {
  for (const eligibleId of demand.eligibleBrokerIds) {
    const broker = context.brokerQueue.find(b => b.brokerId === eligibleId);
    if (!broker) continue;
    
    // Se algum corretor elegível tem menos de 2 externos E pode receber esta demanda
    if (broker.externalShiftCount < MAX_EXTERNAL_SHIFTS_PER_WEEK) {
      // Usar helper unificado COM relaxamento de Regra 8 (corretor com <2 pode ter consecutivo)
      const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
      if (check.allowed) {
        // Ainda há corretor com menos de 2 que pode receber
        return false;
      }
    }
  }
  
  // Todos os elegíveis já têm 2 ou estão bloqueados por regras invioláveis
  return true;
}

// ═══════════════════════════════════════════════════════════
// GATE GLOBAL: Verifica se ALGUM corretor elegível (em QUALQUER demanda
// ainda não alocada) tem menos de 2 externos e pode receber
// Se sim, NINGUÉM pode receber o 3º externo
// ═══════════════════════════════════════════════════════════
function canAnyoneStillReachTwo(
  unallocatedDemands: ExternalDemand[],
  context: AllocationContext
): { canReach: boolean; brokersUnderTwo: string[] } {
  const brokersUnderTwo: string[] = [];
  
  for (const broker of context.brokerQueue) {
    if (broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_PER_WEEK) continue;
    
    // ═══════════════════════════════════════════════════════════
    // ELEGIBILIDADE REAL: Verificar as mesmas regras que findBrokerForDemand usa
    // Evita "possibilidade fantasma" onde o gate fica ativo mas ninguém é alocado
    // ═══════════════════════════════════════════════════════════
    
    // Corretor de sábado interno não pode pegar domingo externo
    const isSaturdayInternalWorker = context.saturdayInternalWorkers?.has(broker.brokerId);
    
    // Corretor de sábado externo tem limite de 2
    const isSaturdayExternalWorker = context.saturdayExternalWorkers?.has(broker.brokerId);
    if (isSaturdayExternalWorker && broker.externalShiftCount >= 2) continue;
    
    let canReceiveAny = false;
    
    for (const demand of unallocatedDemands) {
      if (!demand.eligibleBrokerIds.includes(broker.brokerId)) continue;
      
      // Verificar dia da semana disponível
      if (!broker.availableWeekdays.includes(demand.dayOfWeek)) continue;
      
      // REMOVIDO: Bloqueio fantasma de sáb/dom para saturdayInternalWorkers
      // O bloqueio real ocorre após ETAPA 8.9 via alocações reais
      
      // Sexta com sábado externo
      if (isSaturdayExternalWorker && demand.dayOfWeek === "friday" && broker.externalShiftCount >= 1) continue;
      
      // Sábado externo com 1+ externos
      if (demand.dayOfWeek === "saturday" && broker.externalShiftCount >= 1) continue;
      
      const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
      if (check.allowed) {
        canReceiveAny = true;
        break;
      }
    }
    
    if (canReceiveAny && !brokersUnderTwo.includes(broker.brokerName)) {
      brokersUnderTwo.push(broker.brokerName);
    }
  }
  
  return {
    canReach: brokersUnderTwo.length > 0,
    brokersUnderTwo
  };
}

// checkInviolableRules REMOVIDO — era dead code e mantinha Regra 8 como absoluta.
// Toda verificação agora passa por checkTrulyInviolableRulesWithRelaxation()
// que tem modo estrito (allowRelaxRule8=false) e relaxado (allowRelaxRule8=true).

// ═══════════════════════════════════════════════════════════
// REGRAS ABSOLUTAS (Verificadas ANTES dos passes)
// ATUALIZADO: Regra 9 verifica QUALQUER plantão (interno ou externo)
// ═══════════════════════════════════════════════════════════

interface BlockedBrokerInfo {
  brokerId: string;
  brokerName: string;
  rule: string;
  reason: string;
}

function checkAbsoluteRules(
  broker: BrokerQueueItem,
  demand: ExternalDemand,
  context: AllocationContext,
  pass: number = 1
): { allowed: boolean; reason: string; rule: string } {
  // REGRA ABSOLUTA 1: Máximo de externos por semana
  // RELAXAMENTO: Em passes 4-5, corretores com compensação pendente (sábado) podem ir até HARD_CAP
  const hasCompensation = broker.workedSaturdayLastWeek || context.saturdayInternalWorkers?.has(broker.brokerId);
  const effectiveLimit = (pass >= 3 && hasCompensation) ? MAX_EXTERNAL_SHIFTS_HARD_CAP : MAX_EXTERNAL_SHIFTS_PER_WEEK;
  if (broker.externalShiftCount >= effectiveLimit) {
    return { allowed: false, reason: `Já tem ${broker.externalShiftCount} externos (máx ${effectiveLimit}, pass ${pass})`, rule: "REGRA 1: Máx externos/semana" };
  }

  // REGRA ABSOLUTA 2: Deve estar na lista de elegíveis
  if (!demand.eligibleBrokerIds.includes(broker.brokerId)) {
    return { allowed: false, reason: "Não configurado para este local", rule: "REGRA 2: Elegibilidade" };
  }

  // REGRA ABSOLUTA 3: Se manhã e needsSameBroker, deve ter tarde disponível
  if (demand.shift === "morning" && demand.needsSameBroker) {
    if (!demand.locationBrokerMap.get(broker.brokerId)?.available_afternoon) {
      return { allowed: false, reason: "Precisa do mesmo corretor mas não tem tarde", rule: "REGRA 3: Mesmo corretor M/T" };
    }
  }

// REGRA ABSOLUTA 4: Não pode ter externo no mesmo dia em OUTRO local EXTERNO
  // CORRIGIDO: Apenas verifica locais EXTERNOS, não internos
  // Interno + externo no mesmo dia (turnos diferentes) É PERMITIDO
  const otherExternalAssignment = context.assignments.find(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id !== demand.locationId &&
    context.externalLocations?.some(l => l.id === a.location_id) // Apenas se for local EXTERNO
  );
  if (otherExternalAssignment) {
    const otherLocName = context.externalLocations?.find(l => l.id === otherExternalAssignment.location_id)?.name || "outro local";
    return { allowed: false, reason: `Já tem externo em ${otherLocName}`, rule: "REGRA 4: Conflito de local externo" };
  }

  // REGRA ABSOLUTA 5: Corretor não pode ter dois turnos no mesmo local externo - SEM EXCEÇÕES
  const hasOtherShiftSameLoc = context.assignments.some(a =>
    a.broker_id === broker.brokerId &&
    a.assignment_date === demand.dateStr &&
    a.location_id === demand.locationId &&
    a.shift_type !== demand.shift
  );
  if (hasOtherShiftSameLoc) {
    return { allowed: false, reason: "PROIBIDO: Dois turnos no mesmo local", rule: "REGRA 5: Dois turnos" };
  }

  // REGRA ABSOLUTA 6: Regra de construtora
  if (demand.builderCompany) {
    const hasOtherBuilder = context.assignments.some(a =>
      a.broker_id === broker.brokerId &&
      a.assignment_date === demand.dateStr &&
      context.externalLocations?.find(l => l.id === a.location_id)?.builder_company !== demand.builderCompany &&
      context.externalLocations?.find(l => l.id === a.location_id)?.builder_company
    );
    if (hasOtherBuilder) {
      return { allowed: false, reason: "Conflito de construtora", rule: "REGRA 6: Construtora" };
    }
  }

  // REGRA ABSOLUTA 7: Não pode ser o último do local interno
  // (mantida igual - não modificada)
  const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
  const isReservedForDemand = context.mandatoryReservations.get(`${broker.brokerId}-${demand.dateStr}-${demand.shift}`)?.demandKey === demandKey;
  
  if (!isReservedForDemand && broker.internalLocation) {
    // Verificar se outros corretores do mesmo local interno podem cobrir
    const sameSiteWorkers = context.brokerQueue.filter(b => b.internalLocation === broker.internalLocation && b.brokerId !== broker.brokerId);
    
    if (sameSiteWorkers.length === 0) {
      // Único do local - pode ir para externo
    } else {
      // Verificar disponibilidade dos outros
      const othersAvailable = sameSiteWorkers.some(other => {
        const isAvailableToday = other.availableWeekdays.includes(demand.dayOfWeek);
        const hasAssignmentToday = context.assignments.some(a => 
          a.broker_id === other.brokerId && 
          a.assignment_date === demand.dateStr
        );
        return isAvailableToday && !hasAssignmentToday;
      });
      
      // Se outros não estão disponíveis, este corretor não pode ir para externo
      if (!othersAvailable) {
        // Permitir apenas se for dia de semana (não sábado) - para sábado interno é crítico
        if (demand.dayOfWeek === "saturday") {
          return { allowed: false, reason: `Único disponível para ${broker.internalLocation} sábado`, rule: "REGRA 7: Último interno" };
        }
      }
    }
  }

  // REGRA 8 (Dias consecutivos) REMOVIDA daqui — agora tratada via 
  // checkTrulyInviolableRulesWithRelaxation no findBrokerForDemand,
  // permitindo relaxamento para corretores com <2 externos.

  // ═══════════════════════════════════════════════════════════
  // REGRA ABSOLUTA 9 CORRIGIDA: Sábado OU Domingo (QUALQUER plantão)
  // INCLUI verificação de saturdayInternalWorkers pré-identificados
  // ═══════════════════════════════════════════════════════════
  const weekendCheck = hasWeekendConflict(
    broker.brokerId, 
    demand.date, 
    demand.dayOfWeek, 
    context.assignments,
    context.saturdayInternalWorkers
  );
  
  if (weekendCheck.hasConflict) {
    return { 
      allowed: false, 
      reason: `Já tem plantão no ${weekendCheck.conflictDay}`, 
      rule: "REGRA 9: Sáb ou Dom" 
    };
  }

  // REGRA 10: Se trabalha sábado EXTERNO, máximo 2 externos na semana
  // Sábado INTERNO NÃO limita — pelo contrário, quem pega sábado interno
  // deve receber MAIS externos durante a semana para compensar
  const worksSaturdayExternal = context.saturdayExternalWorkers?.has(broker.brokerId);
  
  if (worksSaturdayExternal) {
    if (broker.externalShiftCount >= 2) {
      return { 
        allowed: false, 
        reason: `Trabalha sábado externo, já tem ${broker.externalShiftCount} externos (máx 2)`, 
        rule: "REGRA 10: Sábado externo + máx 2 externos" 
      };
    }
  }

  return { allowed: true, reason: "OK", rule: "" };
}

// ═══════════════════════════════════════════════════════════
// VERIFICAÇÃO SIMPLIFICADA PARA ANÁLISE DE GARGALOS
// Apenas regras fixas que não dependem do estado de alocação
// ATUALIZADO: Verificar conflito de fim de semana da semana anterior
// ═══════════════════════════════════════════════════════════
function checkFixedRulesForBottleneck(
  broker: BrokerQueueItem,
  demand: ExternalDemand,
  lastWeekExternals: { brokerId: string; date: string }[]
): { allowed: boolean; reason: string } {
  // REGRA 2: Deve estar na lista de elegíveis
  if (!demand.eligibleBrokerIds.includes(broker.brokerId)) {
    return { allowed: false, reason: "Não configurado para este local" };
  }

  // REGRA 3: Se manhã e needsSameBroker, deve ter tarde disponível
  if (demand.shift === "morning" && demand.needsSameBroker) {
    if (!demand.locationBrokerMap.get(broker.brokerId)?.available_afternoon) {
      return { allowed: false, reason: "Precisa do mesmo corretor mas não tem tarde" };
    }
  }

  // REGRA 8: Dias consecutivos (verificar apenas semana anterior)
  const prevDay = format(subDays(demand.date, 1), "yyyy-MM-dd");
  const hasExternalPrevDayLastWeek = lastWeekExternals.some(
    e => e.brokerId === broker.brokerId && e.date === prevDay
  );
  if (hasExternalPrevDayLastWeek) {
    return { allowed: false, reason: `Externo em ${prevDay} (semana anterior)` };
  }

  // REGRA 9 CORRIGIDA: Verificar se teve QUALQUER plantão no outro dia do fim de semana
  // (semana anterior - verificar apenas externos, já que não temos dados de internos aqui)
  if (demand.dayOfWeek === "saturday") {
    const sundayStr = format(addDays(demand.date, 1), "yyyy-MM-dd");
    const hasSundayLastWeek = lastWeekExternals.some(
      e => e.brokerId === broker.brokerId && e.date === sundayStr
    );
    if (hasSundayLastWeek) {
      return { allowed: false, reason: "Externo no domingo (semana anterior)" };
    }
  }
  
  if (demand.dayOfWeek === "sunday") {
    const saturdayStr = format(subDays(demand.date, 1), "yyyy-MM-dd");
    const hasSaturdayLastWeek = lastWeekExternals.some(
      e => e.brokerId === broker.brokerId && e.date === saturdayStr
    );
    if (hasSaturdayLastWeek) {
      return { allowed: false, reason: "Externo no sábado (semana anterior)" };
    }
  }

  return { allowed: true, reason: "OK" };
}

// ═══════════════════════════════════════════════════════════
// ANÁLISE AVANÇADA DE GARGALOS COM CONTEXTO INTRA-SEMANA
// Considera regras de bloqueio que dependem de outras alocações na semana
// ═══════════════════════════════════════════════════════════
interface BottleneckContext {
  dailyExternalAssignments: Map<string, Set<string>>; // dateStr -> broker IDs alocados
  brokerExternalCounts: Map<string, number>; // broker ID -> contagem de externos
  brokerDailyAssignments: Map<string, Map<string, string[]>>; // broker ID -> dateStr -> location IDs
}

function checkRulesWithContext(
  broker: BrokerQueueItem,
  demand: ExternalDemand,
  context: BottleneckContext
): { allowed: boolean; reason: string } {
  // REGRA 1: Máximo 2 externos por semana
  const currentExternals = context.brokerExternalCounts.get(broker.brokerId) || 0;
  if (currentExternals >= 2) {
    return { allowed: false, reason: `Já tem ${currentExternals} externos (máx 2)` };
  }

  // REGRA 8: Dias consecutivos externos (intra-semana)
  const prevDay = format(subDays(demand.date, 1), "yyyy-MM-dd");
  const nextDay = format(addDays(demand.date, 1), "yyyy-MM-dd");
  
  if (context.dailyExternalAssignments.get(prevDay)?.has(broker.brokerId)) {
    return { allowed: false, reason: `Externo em ${prevDay} (dia anterior)` };
  }
  if (context.dailyExternalAssignments.get(nextDay)?.has(broker.brokerId)) {
    return { allowed: false, reason: `Externo em ${nextDay} (dia seguinte)` };
  }

  return { allowed: true, reason: "OK" };
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL: ANÁLISE DE GARGALOS
// Executa ANTES de qualquer alocação
// ═══════════════════════════════════════════════════════════
function analyzeBottlenecks(
  demands: ExternalDemand[],
  brokerQueue: BrokerQueueItem[],
  lastWeekExternals: { brokerId: string; date: string }[]
): { analyses: BottleneckAnalysis[]; reservations: ReservationMap } {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🔍 ANÁLISE DE GARGALOS COM LOOKAHEAD E CONTEXTO (V2)");
  console.log("═══════════════════════════════════════════════════════════");

  const analyses: BottleneckAnalysis[] = [];
  const reservations: ReservationMap = new Map();
  
  // Mapa para rastrear quantas demandas cada corretor pode atender
  // e para quais demandas ele está sendo considerado
  const brokerDemandCount = new Map<string, number>();
  const brokerPotentialDemands = new Map<string, string[]>();
  
  // Mapa para rastrear quantos corretores podem atender cada demanda
  const demandEligibleMap = new Map<string, string[]>();
  
  // ═══════════════════════════════════════════════════════════
  // MAPA DE RESTRIÇÕES POR DIA CONSECUTIVO
  // Se um corretor é alocado em dia X, ele não pode ir no dia X-1 e X+1
  // ═══════════════════════════════════════════════════════════
  const brokerDateConstraints = new Map<string, Set<string>>(); // brokerId -> datas bloqueadas
  
  // ═══════════════════════════════════════════════════════════
  // SIMULAÇÃO DE ALOCAÇÃO - para detectar gargalos reais
  // ═══════════════════════════════════════════════════════════
  const simulatedContext: BottleneckContext = {
    dailyExternalAssignments: new Map(),
    brokerExternalCounts: new Map(),
    brokerDailyAssignments: new Map()
  };
  
  // Inicializar contexto com externos da semana anterior
  for (const external of lastWeekExternals) {
    if (!simulatedContext.dailyExternalAssignments.has(external.date)) {
      simulatedContext.dailyExternalAssignments.set(external.date, new Set());
    }
    simulatedContext.dailyExternalAssignments.get(external.date)!.add(external.brokerId);
  }
  
  // Função para verificar se uma alocação hipotética bloquearia outras demandas críticas
  const wouldBlockCriticalDemand = (
    brokerId: string, 
    demandDateStr: string,
    allDemands: ExternalDemand[],
    eligibleMapSnapshot: Map<string, string[]>
  ): { blocks: boolean; blockedDemand?: ExternalDemand } => {
    const prevDay = format(subDays(new Date(demandDateStr + "T00:00:00"), 1), "yyyy-MM-dd");
    const nextDay = format(addDays(new Date(demandDateStr + "T00:00:00"), 1), "yyyy-MM-dd");
    
    // Verificar demandas no dia anterior e posterior
    for (const otherDemand of allDemands) {
      if (otherDemand.dateStr === prevDay || otherDemand.dateStr === nextDay) {
        const otherDemandKey = `${otherDemand.locationId}-${otherDemand.dateStr}-${otherDemand.shift}`;
        const otherEligible = eligibleMapSnapshot.get(otherDemandKey) || [];
        
        // Se a outra demanda tem poucos elegíveis e este corretor é um deles
        if (otherEligible.includes(brokerId) && otherEligible.length <= 2) {
          // Verificar quantos elegíveis sobrariam se remover este corretor
          const remainingEligible = otherEligible.filter(id => id !== brokerId);
          if (remainingEligible.length === 0) {
            return { blocks: true, blockedDemand: otherDemand };
          }
        }
      }
    }
    return { blocks: false };
  };

  // PASSO 1: Para cada demanda externa, calcular corretores elegíveis
  // usando regras FIXAS + regras de CONTEXTO (consecutivos da semana anterior)
  console.log("\n📊 PASSO 1: Calculando elegibilidade com contexto...");
  
  for (const demand of demands) {
    const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
    const eligibleForDemand: string[] = [];
    
    for (const broker of brokerQueue) {
      // Verificar disponibilidade de dia
      if (!broker.availableWeekdays.includes(demand.dayOfWeek)) {
        continue;
      }
      
      // Verificar regras fixas
      const fixedCheck = checkFixedRulesForBottleneck(broker, demand, lastWeekExternals);
      if (!fixedCheck.allowed) {
        continue;
      }
      
      eligibleForDemand.push(broker.brokerId);
      
      // Atualizar contagem de demandas por corretor
      brokerDemandCount.set(broker.brokerId, (brokerDemandCount.get(broker.brokerId) || 0) + 1);
      
      // Atualizar lista de demandas potenciais do corretor
      const potentialDemands = brokerPotentialDemands.get(broker.brokerId) || [];
      potentialDemands.push(demandKey);
      brokerPotentialDemands.set(broker.brokerId, potentialDemands);
    }
    
    demandEligibleMap.set(demandKey, eligibleForDemand);
    
    // Log especial para domingos
    if (demand.dayOfWeek === "sunday") {
      console.log(`   🌅 DOMINGO ${demand.dateStr} - ${demand.locationName} - ${demand.shift}: ${eligibleForDemand.length} elegíveis`);
      if (eligibleForDemand.length === 0) {
        console.log(`      ⚠️ NENHUM corretor elegível para domingo!`);
        // Verificar todos os corretores para entender por que
        for (const broker of brokerQueue) {
          const hasSunday = broker.availableWeekdays.includes("sunday");
          const isEligible = demand.eligibleBrokerIds.includes(broker.brokerId);
          if (!hasSunday) {
            console.log(`      - ${broker.brokerName}: não tem domingo em available_weekdays`);
          } else if (!isEligible) {
            console.log(`      - ${broker.brokerName}: não está na lista de elegíveis do local`);
          } else {
            const fixedCheck = checkFixedRulesForBottleneck(broker, demand, lastWeekExternals);
            if (!fixedCheck.allowed) {
              console.log(`      - ${broker.brokerName}: bloqueado por regra fixa - ${fixedCheck.reason}`);
            }
          }
        }
      } else {
        const brokerNames = eligibleForDemand.map(id => brokerQueue.find(b => b.brokerId === id)?.brokerName || "?").join(", ");
        console.log(`      Elegíveis: ${brokerNames}`);
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // Classificar prioridade - DOMINGOS SÃO SEMPRE PELO MENOS "HIGH"
    // ═══════════════════════════════════════════════════════════
    let priority: 'critical' | 'high' | 'normal';
    if (eligibleForDemand.length === 0) {
      priority = 'critical'; // Impossível - será reportado como erro
    } else if (eligibleForDemand.length === 1) {
      priority = 'critical'; // Gargalo crítico - apenas 1 corretor
    } else if (eligibleForDemand.length === 2) {
      priority = 'high'; // Alto risco
    } else if (demand.dayOfWeek === "sunday" && eligibleForDemand.length <= 3) {
      // NOVO: Domingos com poucos elegíveis (até 3) são considerados HIGH priority
      priority = 'high';
      console.log(`   🌅 ${demand.locationName} ${demand.dateStr} domingo marcado como HIGH (${eligibleForDemand.length} elegíveis)`);
    } else {
      priority = 'normal';
    }
    
    analyses.push({
      demandKey,
      demand,
      eligibleBrokers: eligibleForDemand,
      priority
    });
  }
  
  // PASSO 2: Ordenar análises por criticidade E por data
  // Priorizar domingos e sábados que têm menos flexibilidade
  analyses.sort((a, b) => {
    const priorityOrder = { critical: 1, high: 2, normal: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    // Dentro da mesma prioridade, priorizar fins de semana (mais restritos)
    const weekendOrder = (day: string) => {
      if (day === "sunday") return 1;
      if (day === "saturday") return 2;
      return 3;
    };
    const weekendDiff = weekendOrder(a.demand.dayOfWeek) - weekendOrder(b.demand.dayOfWeek);
    if (weekendDiff !== 0) return weekendDiff;
    
    // Por data
    return a.demand.date.getTime() - b.demand.date.getTime();
  });
  
  // PASSO 3: LOOKAHEAD - Verificar impacto cascata antes de criar reservas
  console.log("\n📊 PASSO 2: LOOKAHEAD - Analisando impacto cascata...");
  
  // Criar snapshot do mapa de elegíveis para simulação
  const eligibleMapSnapshot = new Map(demandEligibleMap);
  
  // Para cada demanda crítica com apenas 1 elegível, verificar se esse corretor
  // é crítico para outras demandas em dias adjacentes
  for (const analysis of analyses) {
    if (analysis.priority === 'critical' && analysis.eligibleBrokers.length === 1) {
      const brokerId = analysis.eligibleBrokers[0];
      const broker = brokerQueue.find(b => b.brokerId === brokerId);
      
      // Verificar se alocar este corretor aqui bloquearia outra demanda crítica
      const blockCheck = wouldBlockCriticalDemand(
        brokerId, 
        analysis.demand.dateStr, 
        demands,
        eligibleMapSnapshot
      );
      
      if (blockCheck.blocks && blockCheck.blockedDemand) {
        console.log(`   ⚠️ CONFLITO DETECTADO:`);
        console.log(`      ${broker?.brokerName} é único para ${analysis.demand.locationName} (${analysis.demand.dateStr})`);
        console.log(`      MAS também é crítico para ${blockCheck.blockedDemand.locationName} (${blockCheck.blockedDemand.dateStr})`);
        console.log(`      → Isso é um gargalo de CONFIGURAÇÃO, não de geração`);
      }
    }
  }
  
  // PASSO 4: Criar reservas obrigatórias para gargalos críticos
  console.log("\n📊 PASSO 3: GARGALOS IDENTIFICADOS:");
  
  let criticalCount = 0;
  let highCount = 0;
  
  for (const analysis of analyses) {
    if (analysis.priority === 'critical' && analysis.eligibleBrokers.length === 1) {
      criticalCount++;
      const brokerId = analysis.eligibleBrokers[0];
      const broker = brokerQueue.find(b => b.brokerId === brokerId);
      const reservationKey = `${brokerId}-${analysis.demand.dateStr}-${analysis.demand.shift}`;
      
      // Criar reserva obrigatória
      const reservation: MandatoryReservation = {
        brokerId,
        brokerName: broker?.brokerName || "?",
        demandKey: analysis.demandKey,
        demandLocationName: analysis.demand.locationName,
        demandDateStr: analysis.demand.dateStr,
        demandShift: analysis.demand.shift,
        reason: `Único elegível para ${analysis.demand.locationName}`
      };
      
      reservations.set(reservationKey, reservation);
      analysis.reservedBrokerId = brokerId;
      analysis.reservationReason = reservation.reason;
      
      console.log(`   🔴 CRÍTICO: ${analysis.demand.locationName} - ${analysis.demand.dateStr} - ${analysis.demand.shift}`);
      console.log(`      → RESERVADO: ${broker?.brokerName} (único elegível)`);
      
      // Atualizar restrições de dias consecutivos
      const demandDate = analysis.demand.date;
      if (!brokerDateConstraints.has(brokerId)) {
        brokerDateConstraints.set(brokerId, new Set());
      }
      brokerDateConstraints.get(brokerId)!.add(format(subDays(demandDate, 1), "yyyy-MM-dd"));
      brokerDateConstraints.get(brokerId)!.add(format(addDays(demandDate, 1), "yyyy-MM-dd"));
      
    } else if (analysis.priority === 'high') {
      highCount++;
      const brokerNames = analysis.eligibleBrokers.map(id => brokerQueue.find(b => b.brokerId === id)?.brokerName || "?").join(", ");
      console.log(`   🟡 ALTO RISCO: ${analysis.demand.locationName} - ${analysis.demand.dateStr} - ${analysis.demand.shift}`);
      console.log(`      → Elegíveis (${analysis.eligibleBrokers.length}): ${brokerNames}`);
    }
  }
  
  console.log(`\n📊 RESUMO: ${criticalCount} críticos, ${highCount} alto risco, ${analyses.length - criticalCount - highCount} normais`);
  console.log(`   Reservas obrigatórias criadas: ${reservations.size}`);
  
  // Log especial para domingos
  const sundayDemands = analyses.filter(a => a.demand.dayOfWeek === "sunday");
  if (sundayDemands.length > 0) {
    console.log("\n🌅 ANÁLISE ESPECIAL DE DOMINGOS:");
    for (const sunday of sundayDemands) {
      console.log(`   ${sunday.demand.locationName} - ${sunday.demand.dateStr} - ${sunday.demand.shift}`);
      console.log(`      Prioridade: ${sunday.priority}`);
      console.log(`      Elegíveis: ${sunday.eligibleBrokers.length}`);
      if (sunday.reservedBrokerId) {
        const broker = brokerQueue.find(b => b.brokerId === sunday.reservedBrokerId);
        console.log(`      Reservado: ${broker?.brokerName}`);
      }
    }
  }
  
  console.log("═══════════════════════════════════════════════════════════\n");
  
  return { analyses, reservations };
}

// ... (continuar com o resto das funções)

// ═══════════════════════════════════════════════════════════
// FUNÇÃO DE ALOCAÇÃO DE DEMANDA
// ═══════════════════════════════════════════════════════════
function allocateDemand(
  demand: ExternalDemand,
  broker: BrokerQueueItem,
  context: AllocationContext
): void {
  const assignment: ScheduleAssignment = {
    broker_id: broker.brokerId,
    location_id: demand.locationId,
    assignment_date: demand.dateStr,
    shift_type: demand.shift,
    start_time: demand.startTime,
    end_time: demand.endTime,
  };
  
  context.assignments.push(assignment);
  broker.externalShiftCount++;
  broker.externalCredit--;
  
  // Atualizar dailyExternalAssignments
  if (!context.dailyExternalAssignments.has(demand.dateStr)) {
    context.dailyExternalAssignments.set(demand.dateStr, new Set());
  }
  context.dailyExternalAssignments.get(demand.dateStr)!.add(broker.brokerId);
  
  // ═══════════════════════════════════════════════════════════
  // NOVO: Atualizar contador diário de corretores do Bessa com externos
  // Isso permite bloquear mais de 2 do Bessa em externos no mesmo dia
  // ═══════════════════════════════════════════════════════════
  if (broker.internalLocation === "bessa") {
    const currentCount = context.dailyBessaExternalCount.get(demand.dateStr) || 0;
    context.dailyBessaExternalCount.set(demand.dateStr, currentCount + 1);
    console.log(`   📊 Bessa externo +1: ${demand.dateStr} → ${currentCount + 1} corretores`);
  }
  
  // Atualizar weekendExternalAssignments
  if (demand.dayOfWeek === "saturday" || demand.dayOfWeek === "sunday") {
    context.weekendExternalAssignments.set(broker.brokerId, demand.dayOfWeek);
    
    // Se foi alocado para sábado externo, marcar
    if (demand.dayOfWeek === "saturday") {
      context.saturdayExternalWorkers.add(broker.brokerId);
    }
  }
  
  // Rastrear para atualização de fila de rotação
  context.locationAllocationsForQueueUpdate.push({
    location_id: demand.locationId,
    broker_id: broker.brokerId,
    assignment_date: demand.dateStr
  });
  
  // Atualizar fila de rotação em memória - REORDENAR para FIFO correto
  const locationQueue = context.locationRotationQueues.get(demand.locationId);
  if (locationQueue) {
    const queueItemIndex = locationQueue.findIndex(q => q.broker_id === broker.brokerId);
    if (queueItemIndex !== -1) {
      const queueItem = locationQueue[queueItemIndex];
      queueItem.last_assignment_date = demand.dateStr;
      queueItem.times_assigned = (queueItem.times_assigned || 0) + 1;
      
      // ═══════════════════════════════════════════════════════════
      // CORREÇÃO FIFO: Remover da posição atual e mover para o FINAL
      // Depois recalcular todas as posições sequencialmente (1, 2, 3...)
      // ═══════════════════════════════════════════════════════════
      locationQueue.splice(queueItemIndex, 1); // Remove da posição atual
      locationQueue.push(queueItem); // Adiciona ao final
      
      // Recalcular queue_position para todos (1-indexed)
      locationQueue.forEach((item, idx) => {
        item.queue_position = idx + 1;
      });
      
      console.log(`   🔄 FIFO Reordenado: ${broker.brokerName} movido para posição ${locationQueue.length} em ${demand.locationName}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ETAPA 8.8: DESCONSECUTIVAR EXTERNOS (OTIMIZAÇÃO)
// Tenta quebrar pares de dias consecutivos trocando corretores
// ═══════════════════════════════════════════════════════════
function deConsecutivizeExternals(
  context: AllocationContext,
  possibleDemands: ExternalDemand[],
  internalLocIds: Set<string>
): { swapsAttempted: number; swapsSuccessful: number } {
  console.log("\n🔄 ETAPA 8.8: DESCONSECUTIVAR EXTERNOS (OTIMIZAÇÃO)");
  console.log("─────────────────────────────────────────────────────────────");
  
  let swapsAttempted = 0;
  let swapsSuccessful = 0;
  
  // 1. Identificar todos os pares de dias consecutivos externos
  const consecutivePairs: Array<{
    brokerId: string;
    brokerName: string;
    date1: string;
    date2: string;
  }> = [];
  
  for (const broker of context.brokerQueue) {
    // Coletar todas as datas com externo para este corretor
    const externalDates: string[] = [];
    for (const [dateStr, brokerSet] of context.dailyExternalAssignments.entries()) {
      if (brokerSet.has(broker.brokerId)) {
        externalDates.push(dateStr);
      }
    }
    
    // Ordenar e verificar consecutivos
    externalDates.sort();
    for (let i = 0; i < externalDates.length - 1; i++) {
      const date1 = new Date(externalDates[i] + "T00:00:00");
      const date2 = new Date(externalDates[i + 1] + "T00:00:00");
      const diff = differenceInDays(date2, date1);
      
      if (diff === 1) {
        consecutivePairs.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          date1: externalDates[i],
          date2: externalDates[i + 1]
        });
      }
    }
  }
  
  if (consecutivePairs.length === 0) {
    console.log("   ✅ Nenhum par de dias consecutivos encontrado!");
    return { swapsAttempted: 0, swapsSuccessful: 0 };
  }
  
  console.log(`   📊 ${consecutivePairs.length} pares de dias consecutivos encontrados`);
  
  // 2. Para cada par, tentar trocar UM dos plantões para outro corretor
  for (const pair of consecutivePairs) {
    console.log(`   🔍 Analisando: ${pair.brokerName} - ${pair.date1} + ${pair.date2}`);
    
    // Tentar trocar o plantão do date2 (segundo dia) - geralmente mais flexível
    const assignmentsToSwap = context.assignments.filter(a =>
      a.broker_id === pair.brokerId &&
      a.assignment_date === pair.date2 &&
      !internalLocIds.has(a.location_id)
    );
    
    for (const assignment of assignmentsToSwap) {
      swapsAttempted++;
      
      // Encontrar a demanda original
      const demand = possibleDemands.find(d =>
        d.locationId === assignment.location_id &&
        d.dateStr === assignment.assignment_date &&
        d.shift === assignment.shift_type
      );
      
      if (!demand) continue;
      
      // Buscar corretores alternativos que podem assumir este plantão
      const alternativeBrokers = context.brokerQueue.filter(b => {
        if (b.brokerId === pair.brokerId) return false;
        if (!demand.eligibleBrokerIds.includes(b.brokerId)) return false;
        
        // Verificar regras invioláveis (modo estrito — swap não deve criar consecutivos)
        const check = checkTrulyInviolableRulesWithRelaxation(b, demand, context, false);
        if (!check.allowed) return false;
        
        // Verificar se NÃO criaria novo par consecutivo para este corretor
        const prevDay = format(subDays(demand.date, 1), "yyyy-MM-dd");
        const nextDay = format(addDays(demand.date, 1), "yyyy-MM-dd");
        const hasConsecutive = 
          context.dailyExternalAssignments.get(prevDay)?.has(b.brokerId) ||
          context.dailyExternalAssignments.get(nextDay)?.has(b.brokerId);
        
        if (hasConsecutive) return false;
        
        // Preferir corretores com menos externos
        return b.externalShiftCount <= context.brokerQueue.find(br => br.brokerId === pair.brokerId)!.externalShiftCount;
      });
      
      if (alternativeBrokers.length > 0) {
        // Ordenar por menos externos e selecionar o melhor
        alternativeBrokers.sort((a, b) => a.externalShiftCount - b.externalShiftCount);
        const newBroker = alternativeBrokers[0];
        
        // Executar swap
        const oldBroker = context.brokerQueue.find(b => b.brokerId === pair.brokerId)!;
        
        // Remover da alocação antiga
        assignment.broker_id = newBroker.brokerId;
        
        // Atualizar contadores
        oldBroker.externalShiftCount--;
        newBroker.externalShiftCount++;
        
        // Atualizar dailyExternalAssignments
        context.dailyExternalAssignments.get(pair.date2)?.delete(pair.brokerId);
        if (!context.dailyExternalAssignments.get(pair.date2)) {
          context.dailyExternalAssignments.set(pair.date2, new Set());
        }
        context.dailyExternalAssignments.get(pair.date2)!.add(newBroker.brokerId);
        
        swapsSuccessful++;
        console.log(`   ✅ SWAP: ${demand.locationName} ${pair.date2} ${demand.shift}`);
        console.log(`      ${oldBroker.brokerName} → ${newBroker.brokerName}`);
        console.log(`      Consecutivo quebrado!`);
        
        break; // Só precisa trocar um plantão do par
      }
    }
  }
  
  console.log(`\n📊 RESULTADO: ${swapsSuccessful}/${swapsAttempted} swaps bem-sucedidos`);
  
  return { swapsAttempted, swapsSuccessful };
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO FINDBROKERFORDEMAND - BUSCA O MELHOR CORRETOR
// ═══════════════════════════════════════════════════════════
function findBrokerForDemand(
  demand: ExternalDemand,
  context: AllocationContext,
  pass: number,
  bessaBrokersAvailableSaturday: number = 0,
  collectBlockedBrokers: boolean = false,
  attemptSeed: number = 1
): { broker: BrokerQueueItem | null; reason: string; blockedBrokers?: BlockedBrokerInfo[] } {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // REGRA SUPREMA: ÚNICO CORRETOR CONFIGURADO - SUPERA TODAS AS OUTRAS REGRAS!
  // ═══════════════════════════════════════════════════════════════════════════
  const locationData = context.externalLocations?.find(l => l.id === demand.locationId);
  const configuredBrokersCount = locationData?.location_brokers?.length || 0;
  
  if (configuredBrokersCount === 1 && demand.eligibleBrokerIds.length === 1) {
    const onlyBrokerId = demand.eligibleBrokerIds[0];
    const onlyBroker = context.brokerQueue.find(b => b.brokerId === onlyBrokerId);
    
    if (onlyBroker) {
      // REGRA ABSOLUTA: Corretor não pode ter dois turnos no mesmo local externo - SEM EXCEÇÕES
      const hasOtherShiftSameLocation = context.assignments.some(a =>
        a.broker_id === onlyBrokerId &&
        a.assignment_date === demand.dateStr &&
        a.location_id === demand.locationId &&
        a.shift_type !== demand.shift
      );
      if (hasOtherShiftSameLocation) {
        console.log(`   ⛔ ÚNICO CONFIGURADO: ${onlyBroker.brokerName} já tem outro turno em ${demand.locationName} - NÃO ALOCADO (regra absoluta)`);
        return { broker: null, reason: "PROIBIDO: Único corretor já tem outro turno no mesmo local" };
      }
      
      // Verificar conflito físico
      const hasPhysicalConflict = context.assignments.some(a =>
        a.broker_id === onlyBrokerId &&
        a.assignment_date === demand.dateStr &&
        a.shift_type === demand.shift &&
        a.location_id !== demand.locationId
      );
      
      // VERIFICAR REGRA 9: Sábado OU Domingo (QUALQUER plantão)
      // SEM bloqueio fantasma — só verifica alocações REAIS
      const weekendCheck = hasWeekendConflict(
        onlyBrokerId,
        demand.date,
        demand.dayOfWeek,
        context.assignments
      );
      
      if (!hasPhysicalConflict && !weekendCheck.hasConflict) {
        console.log(`   🔴 ÚNICO CONFIGURADO (${configuredBrokersCount}): ${onlyBroker.brokerName} é o único para ${demand.locationName} - ALOCADO (ignora outras regras)`);
        return { broker: onlyBroker, reason: "ÚNICO CORRETOR CONFIGURADO - regra suprema" };
      } else if (weekendCheck.hasConflict) {
        console.log(`   ⚠️ ÚNICO CONFIGURADO: ${onlyBroker.brokerName} tem conflito de fim de semana (já tem ${weekendCheck.conflictDay}) para ${demand.locationName}`);
        return { broker: null, reason: `Único corretor tem conflito de fim de semana (${weekendCheck.conflictDay})` };
      } else {
        console.log(`   ⚠️ ÚNICO CONFIGURADO: ${onlyBroker.brokerName} tem conflito físico no mesmo horário para ${demand.locationName}`);
        return { broker: null, reason: "Único corretor tem conflito físico" };
      }
    }
  }
  
  const isSaturday = demand.dayOfWeek === "saturday";
  const isSunday = demand.dayOfWeek === "sunday";
  let sortedQueue = sortBrokerQueueForSaturday([...context.brokerQueue], isSaturday);
  
  // ═══════════════════════════════════════════════════════════
  // LOCAIS CRÍTICOS - FILA DE ROTAÇÃO TEM PRIORIDADE ABSOLUTA
  // ═══════════════════════════════════════════════════════════
  const CRITICAL_LOCATION_PATTERNS = ['artus', 'bessa', 'tambaú', 'tambau'];
  const isCriticalLocation = CRITICAL_LOCATION_PATTERNS.some(pattern => 
    demand.locationName.toLowerCase().includes(pattern)
  );
  
  const locationQueue = context.locationRotationQueues?.get(demand.locationId);
  const hasValidLocationQueue = locationQueue && locationQueue.length > 0;

  // ═══════════════════════════════════════════════════════════
  // CÁLCULO DE TURNOS TOTAIS DA SEMANA PARA ESTE LOCAL
  // ═══════════════════════════════════════════════════════════
  const allocationsThisLocationThisWeek = context.assignments.filter(
    a => a.location_id === demand.locationId
  );
  const brokersAlreadyWorkedThisLocation = new Set(
    allocationsThisLocationThisWeek.map(a => a.broker_id)
  );
  const eligibleBrokersCount = demand.eligibleBrokerIds.length;
  const isLowTurnoverLocation = isCriticalLocation && eligibleBrokersCount >= 3;
  
  if (isCriticalLocation && hasValidLocationQueue) {
    const eligibleForThisLocation = sortedQueue.filter(b => demand.eligibleBrokerIds.includes(b.brokerId));
    const notEligibleForThisLocation = sortedQueue.filter(b => !demand.eligibleBrokerIds.includes(b.brokerId));
    
    // ═══════════════════════════════════════════════════════════
    // MÁXIMA DISTRIBUIÇÃO: Priorizar quem AINDA NÃO trabalhou E tem MENOS externos
    // CORRIGIDO: externalShiftCount é critério principal mesmo para locais críticos
    // ═══════════════════════════════════════════════════════════
    eligibleForThisLocation.sort((a, b) => {
      // PRIORIDADE 1: Quem tem MENOS externos (distribuição global balanceada)
      if (a.externalShiftCount !== b.externalShiftCount) {
        return a.externalShiftCount - b.externalShiftCount;
      }
      
      // PRIORIDADE 2: Quem ainda não trabalhou NESTE local esta semana
      const aWorked = brokersAlreadyWorkedThisLocation.has(a.brokerId) ? 1 : 0;
      const bWorked = brokersAlreadyWorkedThisLocation.has(b.brokerId) ? 1 : 0;
      if (aWorked !== bWorked) {
        return aWorked - bWorked;
      }
      
      // PRIORIDADE 3: Posição na fila do local
      const posA = locationQueue.find(q => q.broker_id === a.brokerId)?.queue_position ?? 999;
      const posB = locationQueue.find(q => q.broker_id === b.brokerId)?.queue_position ?? 999;
      return posA - posB;
    });
    
    sortedQueue = [...eligibleForThisLocation, ...notEligibleForThisLocation];
    
    if (eligibleForThisLocation.length > 0) {
      const topBrokers = eligibleForThisLocation.slice(0, 5);
      const alreadyWorkedCount = eligibleForThisLocation.filter(b => brokersAlreadyWorkedThisLocation.has(b.brokerId)).length;
      console.log(`   🎯 CRÍTICO ${demand.locationName}: ${alreadyWorkedCount}/${eligibleForThisLocation.length} já trabalharam → ${topBrokers.map(b => {
        const pos = locationQueue.find(q => q.broker_id === b.brokerId)?.queue_position ?? '?';
        const worked = brokersAlreadyWorkedThisLocation.has(b.brokerId) ? '✓' : '○';
        return `${b.brokerName}(pos:${pos},${worked})`;
      }).join(', ')}`);
    }
  } else {
    // Para locais NÃO críticos: priorizar por MENOS EXTERNOS (distribuição balanceada)
    // EXCEÇÃO PARA DOMINGOS: FIFO é critério PRINCIPAL para garantir rotação
    const eligibleBrokers = sortedQueue.filter(b => demand.eligibleBrokerIds.includes(b.brokerId));
    const otherBrokers = sortedQueue.filter(b => !demand.eligibleBrokerIds.includes(b.brokerId));
    
    eligibleBrokers.sort((a, b) => {
      // ═══════════════════════════════════════════════════════════
      // PARA DOMINGOS: BALANCEAMENTO MENSAL TEM PRIORIDADE MÁXIMA
      // Isso resolve concentração como Taciana 4x Nammos domingo
      // ═══════════════════════════════════════════════════════════
      if (isSunday) {
        // PRIORIDADE 1: Menos domingos NESTE LOCAL no mês (evitar concentração)
        const sundaysAtLocationA = context.monthSundayAtLocation?.[demand.locationId]?.[a.brokerId] || 0;
        const sundaysAtLocationB = context.monthSundayAtLocation?.[demand.locationId]?.[b.brokerId] || 0;
        if (sundaysAtLocationA !== sundaysAtLocationB) {
          return sundaysAtLocationA - sundaysAtLocationB;
        }
        
        // PRIORIDADE 2: Menos domingos TOTAIS no mês
        const totalSundaysA = context.monthSundayCount?.[a.brokerId] || 0;
        const totalSundaysB = context.monthSundayCount?.[b.brokerId] || 0;
        if (totalSundaysA !== totalSundaysB) {
          return totalSundaysA - totalSundaysB;
        }
        
        // PRIORIDADE 3: FIFO do local para garantir rotação justa
        if (hasValidLocationQueue) {
          const posA = locationQueue!.find(q => q.broker_id === a.brokerId)?.queue_position ?? 999;
          const posB = locationQueue!.find(q => q.broker_id === b.brokerId)?.queue_position ?? 999;
          if (posA !== posB) return posA - posB;
        }
        
        // PRIORIDADE 4: Menos externos (distribuição geral)
        return a.externalShiftCount - b.externalShiftCount;
      }
      
      // Para NÃO-DOMINGOS: boost para quem precisa de compensação
      // PRIORIDADE 0.5: Corretores com workedSaturdayLastWeek OU saturdayInternalWorkers
      // que ainda precisam de mais externos recebem prioridade em dias de semana
      if (!isSaturday && !isSunday) {
        const aNeedsCompensation = (a.workedSaturdayLastWeek || context.saturdayInternalWorkers?.has(a.brokerId)) ? 1 : 0;
        const bNeedsCompensation = (b.workedSaturdayLastWeek || context.saturdayInternalWorkers?.has(b.brokerId)) ? 1 : 0;
        if (aNeedsCompensation !== bNeedsCompensation) {
          const aNeedsMore = a.externalShiftCount < a.targetExternals;
          const bNeedsMore = b.externalShiftCount < b.targetExternals;
          if (aNeedsCompensation && aNeedsMore && !bNeedsCompensation) return -1;
          if (bNeedsCompensation && bNeedsMore && !aNeedsCompensation) return 1;
        }
      }
      
      // PRIORIDADE 1: Quem tem MENOS externos (distribuição balanceada)
      if (a.externalShiftCount !== b.externalShiftCount) {
        return a.externalShiftCount - b.externalShiftCount;
      }
      
      // PRIORIDADE 2: Escassez - quem tem MENOS locais configurados (preservar versáteis)
      if (a.externalLocationCount !== b.externalLocationCount) {
        return a.externalLocationCount - b.externalLocationCount;
      }
      
      // PRIORIDADE 3: Fila FIFO do local
      if (hasValidLocationQueue) {
        const posA = locationQueue!.find(q => q.broker_id === a.brokerId)?.queue_position ?? 999;
        const posB = locationQueue!.find(q => q.broker_id === b.brokerId)?.queue_position ?? 999;
        if (posA !== posB) return posA - posB;
      }
      
      // PRIORIDADE 4: Último externo mais antigo primeiro
      const lastA = a.lastExternalDate?.getTime() || 0;
      const lastB = b.lastExternalDate?.getTime() || 0;
      return lastA - lastB;
    });
    
    if (attemptSeed > 1) {
      // ═══════════════════════════════════════════════════════════
      // PARA DOMINGOS: NÃO APLICAR SHUFFLE - MANTER FIFO INTACTO
      // Isso garante que a rotação seja SEMPRE respeitada, mesmo em retries
      // ═══════════════════════════════════════════════════════════
      if (!isSunday) {
        const groups = new Map<number, BrokerQueueItem[]>();
        for (const broker of eligibleBrokers) {
          const creditPending = broker.externalCredit - broker.externalShiftCount;
          if (!groups.has(creditPending)) groups.set(creditPending, []);
          groups.get(creditPending)!.push(broker);
        }
        
        const shuffledEligible: BrokerQueueItem[] = [];
        const sortedCredits = [...groups.keys()].sort((a, b) => b - a);
        for (const credit of sortedCredits) {
          const group = groups.get(credit)!;
          const demandSeed = attemptSeed * 1000 + credit * 100 + demand.date.getTime() % 1000;
          shuffledEligible.push(...shuffleWithSeed(group, demandSeed));
        }
        
        sortedQueue = [...shuffledEligible, ...otherBrokers];
      } else {
        // Para DOMINGOS, manter a ordenação FIFO já aplicada - sem shuffle
        sortedQueue = [...eligibleBrokers, ...otherBrokers];
        console.log(`   🔒 DOMINGO: Shuffle desabilitado para ${demand.locationName} - FIFO preservado`);
      }
    } else {
      sortedQueue = [...eligibleBrokers, ...otherBrokers];
    }
    
    // Log diagnóstico especial para domingos
    if (isSunday && eligibleBrokers.length > 0) {
      const topBrokers = sortedQueue.filter(b => demand.eligibleBrokerIds.includes(b.brokerId)).slice(0, 4);
      console.log(`   🗓️ DOMINGO ${demand.locationName}: FIFO prioritário → ${topBrokers.map(b => {
        const pos = hasValidLocationQueue ? locationQueue!.find(q => q.broker_id === b.brokerId)?.queue_position ?? '?' : '-';
        return `${b.brokerName}(pos:${pos},ext:${b.externalShiftCount})`;
      }).join(', ')}`);
    } else if (eligibleBrokers.length > 0) {
      const topBrokers = sortedQueue.filter(b => demand.eligibleBrokerIds.includes(b.brokerId)).slice(0, 3);
      console.log(`   📊 ${demand.locationName}: prioridade por EXTERNOS → ${topBrokers.map(b => {
        const pos = hasValidLocationQueue ? locationQueue!.find(q => q.broker_id === b.brokerId)?.queue_position ?? '?' : '-';
        return `${b.brokerName}(ext:${b.externalShiftCount},locs:${b.externalLocationCount},pos:${pos})`;
      }).join(', ')}`);
    }
  }
  
  const blockedBrokers: BlockedBrokerInfo[] = [];
  
  // Verificar se há corretor RESERVADO para esta demanda específica
  const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
  
  // Primeiro, tentar alocar corretor reservado
  for (const broker of sortedQueue) {
    const reservationKey = `${broker.brokerId}-${demand.dateStr}-${demand.shift}`;
    const reservation = context.mandatoryReservations.get(reservationKey);
    
    if (reservation && reservation.demandKey === demandKey) {
      const absoluteCheck = checkAbsoluteRules(broker, demand, context, pass);
      if (absoluteCheck.allowed) {
        console.log(`   🎯 RESERVA USADA: ${broker.brokerName} para ${demand.locationName}`);
        return { broker, reason: `RESERVADO: ${reservation.reason}` };
      } else {
        console.error(`   ⚠️ RESERVA NÃO HONRADA: ${broker.brokerName} - ${absoluteCheck.reason}`);
      }
    }
  }

  // Verificar se demanda está reservada para outro corretor
  let demandIsReservedFor: string | null = null;
  for (const [key, reservation] of context.mandatoryReservations) {
    if (reservation.demandKey === demandKey) {
      demandIsReservedFor = reservation.brokerId;
      break;
    }
  }

  // Fluxo normal de alocação
  for (const broker of sortedQueue) {
    // Proteção de reserva
    if (demandIsReservedFor && demandIsReservedFor !== broker.brokerId && pass < 5) {
      if (collectBlockedBrokers) {
        const reservedBrokerName = context.brokerQueue.find(b => b.brokerId === demandIsReservedFor)?.brokerName || 'outro';
        blockedBrokers.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          rule: "PRÉ-RESERVA",
          reason: `Demanda reservada para ${reservedBrokerName}`
        });
      }
      continue;
    }

    // Proteção de sábado interno (para sábados externos) — APENAS passes 1-3
    // A partir do pass 4, permite sábado externo para garantir cobertura (externos acima de tudo)
    if (isSaturday && context.saturdayInternalWorkers?.has(broker.brokerId) && pass <= 3) {
      if (collectBlockedBrokers) {
        blockedBrokers.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          rule: "REGRA: Reservado Tambaú",
          reason: `Reservado para Tambaú sábado interno (pass ${pass} <= 3)`
        });
      }
      continue;
    }
    
    // REMOVIDO: Bloqueio fantasma de domingo por pré-reserva de sábado interno
    // O bloqueio real ocorre naturalmente via hasWeekendConflict após ETAPA 8.9

    // ═══════════════════════════════════════════════════════════
    // REGRA: CORRETORES COM SÁBADO EXTERNO = MÁXIMO 2 EXTERNOS NA SEMANA
    // Sábado INTERNO não limita — quem pega sábado interno recebe
    // mais externos durante a semana para compensar
    // ═══════════════════════════════════════════════════════════
    const worksSaturdayExternal = context.saturdayExternalWorkers?.has(broker.brokerId);
    
    if (worksSaturdayExternal && broker.externalShiftCount >= 2 && !isSaturday) {
      if (collectBlockedBrokers) {
        blockedBrokers.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          rule: "REGRA: Sábado externo + 2 externos máx",
          reason: `Trabalha sábado externo - limite de 2 externos atingido (tem ${broker.externalShiftCount})`
        });
      }
      continue;
    }
    
    // ═══════════════════════════════════════════════════════════
    // PREFERÊNCIA: EVITAR SEXTA PARA QUEM TRABALHA SÁBADO EXTERNO
    // Sábado INTERNO na sexta é OK — não é consecutivo externo
    // ═══════════════════════════════════════════════════════════
    if (worksSaturdayExternal && demand.dayOfWeek === "friday" && broker.externalShiftCount >= 1) {
      if (collectBlockedBrokers) {
        blockedBrokers.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          rule: "REGRA: Evitar sexta com sábado externo",
          reason: `Trabalha sábado externo e já tem ${broker.externalShiftCount} externo(s) - evitar consecutivo (sexta)`
        });
      }
      continue;
    }

    // Proteção de sábado externo (já tem 1+ externo)
    if (isSaturday && broker.externalShiftCount >= 1) {
      if (collectBlockedBrokers) {
        blockedBrokers.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          rule: "REGRA: Sábado com externos",
          reason: `Já tem ${broker.externalShiftCount} externo(s), não pode ir para sábado`
        });
      }
      continue;
    }

    const absoluteCheck = checkAbsoluteRules(broker, demand, context, pass);
    if (!absoluteCheck.allowed) {
      if (collectBlockedBrokers) {
        blockedBrokers.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          rule: absoluteCheck.rule,
          reason: absoluteCheck.reason
        });
      }
      continue;
    }

    // ═══════════════════════════════════════════════════════════
    // REGRA 8: Dias consecutivos — via helper relaxável
    // Relaxa para corretores com <2 externos (equidade)
    // Mantém bloqueio estrito para quem já tem 2+
    // ═══════════════════════════════════════════════════════════
    const allowRelaxRule8ForThisBroker = broker.externalShiftCount < 2;
    const rule8Check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, allowRelaxRule8ForThisBroker);
    if (!rule8Check.allowed) {
      if (collectBlockedBrokers) {
        blockedBrokers.push({
          brokerId: broker.brokerId,
          brokerName: broker.brokerName,
          rule: rule8Check.rule || "REGRA 8",
          reason: rule8Check.reason
        });
      }
      continue;
    }

    // ═══════════════════════════════════════════════════════════
    // NOVA REGRA: PROTEÇÃO DO BESSA EM DIAS DE SEMANA
    // Com apenas 3 corretores no Bessa, no máximo 2 podem ter externos
    // O terceiro DEVE permanecer no Bessa para garantir cobertura
    // ═══════════════════════════════════════════════════════════
    if (!isSaturday && !isSunday && broker.internalLocation === "bessa") {
      const bessaDailyExternalCount = context.dailyBessaExternalCount.get(demand.dateStr) || 0;
      
      // REGRA: Máximo 2 do Bessa com externos por dia de semana
      // Isso garante que pelo menos 1 corretor do Bessa fique disponível
      if (bessaDailyExternalCount >= 2) {
        if (collectBlockedBrokers) {
          blockedBrokers.push({
            brokerId: broker.brokerId,
            brokerName: broker.brokerName,
            rule: "REGRA BESSA: Cobertura mínima",
            reason: `Já tem ${bessaDailyExternalCount} do Bessa com externos hoje (limite: 2)`
          });
        }
        console.log(`   ⛔ BESSA PROTEÇÃO: ${broker.brokerName} bloqueado - já tem ${bessaDailyExternalCount} do Bessa com externos em ${demand.dateStr}`);
        continue;
      }
    }

    // REGRA DO BESSA PARA SÁBADOS
    if (isSaturday && broker.internalLocation === "bessa") {
      const bessaExternalCount = context.saturdayBessaExternalCount.get(demand.dateStr) || 0;
      
      if (bessaBrokersAvailableSaturday === 2) {
        if (bessaExternalCount >= 1) {
          if (collectBlockedBrokers) {
            blockedBrokers.push({
              brokerId: broker.brokerId,
              brokerName: broker.brokerName,
              rule: "REGRA BESSA: Limite sábado",
              reason: `Já tem ${bessaExternalCount} do Bessa no sábado (limite: 1 de 2)`
            });
          }
          continue;
        }
      } else if (bessaBrokersAvailableSaturday >= 3) {
        if (bessaExternalCount === 0 && pass < 2) {
          if (collectBlockedBrokers) {
            blockedBrokers.push({
              brokerId: broker.brokerId,
              brokerName: broker.brokerName,
              rule: "REGRA BESSA: Gradual",
              reason: `Aguardando pass 2+ para primeiro do Bessa`
            });
          }
          continue;
        }
        if (bessaExternalCount === 1 && pass < 3) {
          if (collectBlockedBrokers) {
            blockedBrokers.push({
              brokerId: broker.brokerId,
              brokerName: broker.brokerName,
              rule: "REGRA BESSA: Gradual",
              reason: `Aguardando pass 3+ para segundo do Bessa`
            });
          }
          continue;
        }
        if (bessaExternalCount >= 2) {
          if (collectBlockedBrokers) {
            blockedBrokers.push({
              brokerId: broker.brokerId,
              brokerName: broker.brokerName,
              rule: "REGRA BESSA: Limite",
              reason: `Limite de ${bessaExternalCount} do Bessa atingido`
            });
          }
          continue;
        }
      }
    }

    // Encontrou corretor válido
    return { broker, reason: `Pass ${pass}`, blockedBrokers: collectBlockedBrokers ? blockedBrokers : undefined };
  }

  return { broker: null, reason: "Nenhum corretor disponível", blockedBrokers: collectBlockedBrokers ? blockedBrokers : undefined };
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO AUXILIAR: VERIFICAR SE CORRETOR TEM CONFLITO DE FIM DE SEMANA
// Para uso na alocação de plantões INTERNOS
// ═══════════════════════════════════════════════════════════
function hasWeekendConflictForInternal(
  brokerId: string,
  dateStr: string,
  dayOfWeek: string,
  assignments: ScheduleAssignment[]
): boolean {
  const date = new Date(dateStr + "T00:00:00");
  
  if (dayOfWeek === "saturday") {
    const sundayStr = format(addDays(date, 1), "yyyy-MM-dd");
    return assignments.some(a => 
      a.broker_id === brokerId && 
      a.assignment_date === sundayStr
    );
  }
  
  if (dayOfWeek === "sunday") {
    const saturdayStr = format(subDays(date, 1), "yyyy-MM-dd");
    return assignments.some(a => 
      a.broker_id === brokerId && 
      a.assignment_date === saturdayStr
    );
  }
  
  return false;
}

// Continuar exportando todas as funções existentes...
// (O resto do código permanece igual, mas com as correções de regra 9 aplicadas em todos os pontos)

export async function generateWeeklyScheduleWithRetry(
  weekStart: Date,
  weekEnd: Date,
  accumulator: WeeklyAccumulator,
  brokers: BrokerInfoForValidation[],
  locations: LocationInfoForValidation[],
  maxAttempts: number = 100,
  onAttempt?: (attempt: number, maxAttempts: number) => void,
  previousWeeksAssignments?: ScheduleAssignment[]
): Promise<RetryResult> {
  const weekLabel = `${format(weekStart, "dd/MM")} a ${format(weekEnd, "dd/MM")}`;
  
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`🔄 INICIANDO GERAÇÃO COM RETRY: ${weekLabel}`);
  console.log(`   Máximo de tentativas: ${maxAttempts}`);
  console.log("═══════════════════════════════════════════════════════════");
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n🔄 TENTATIVA ${attempt}/${maxAttempts}...`);
    onAttempt?.(attempt, maxAttempts);
    
    try {
      const weekSchedule = await generateWeeklyScheduleWithAccumulator(
        weekStart, 
        weekEnd, 
        accumulator,
        attempt
      );
      
      const validation = validateAllRulesCompliance(weekSchedule, brokers, locations, previousWeeksAssignments);
      
      if (validation.valid) {
        console.log(`\n✅ SUCESSO na tentativa ${attempt}!`);
        console.log(`   Escala gerada com ${weekSchedule.length} alocações sem violações`);
        return { 
          assignments: weekSchedule, 
          success: true, 
          attempts: attempt 
        };
      }
      
      const criticalViolations = validation.violations.filter(v => v.severity === 'critical');
      
      // Verificar violações verdadeiramente invioláveis (4, 6, 9)
      const hasInviolableViolations = criticalViolations.some(v => 
        v.rule.includes("REGRA 4") || 
        v.rule.includes("locais externos diferentes") ||
        v.rule.includes("REGRA 6") ||
        v.rule.includes("construtora") ||
        v.rule.includes("REGRA 9") ||
        v.rule.includes("sábado E domingo") ||
        v.rule.includes("sábado e domingo") ||
        v.rule.includes("sábado OU domingo") ||
        v.rule.includes("Sáb ou Dom")
      );
      
      if (hasInviolableViolations) {
        console.log(`❌ Tentativa ${attempt}: violações INVIOLÁVEIS detectadas (Regra 4, 6 ou 9)`);
        for (const v of criticalViolations.filter(v => 
          v.rule.includes("REGRA 4") || v.rule.includes("REGRA 6") || v.rule.includes("REGRA 9") || v.rule.includes("Sáb ou Dom")
        )) {
          console.log(`   ⛔ ${v.rule}: ${v.brokerName} - ${v.details}`);
        }
      } else {
        const allRelaxableViolations = criticalViolations.every(v => 
          v.rule.includes("REGRA 10") || 
          v.rule.includes("Rotação entre semanas") ||
          v.rule.includes("REGRA 8") ||
          v.rule.includes("dias consecutivos") ||
          v.rule.includes("consecutivo") ||
          v.rule.includes("REGRA 1") ||
          v.rule.includes("limite semanal") ||
          v.rule.includes("máximo de externos")
        );
        
        const rotationOnlyViolations = criticalViolations.every(v => 
          v.rule.includes("REGRA 10") || v.rule.includes("Rotação entre semanas")
        );
        
        if (attempt >= 20 && rotationOnlyViolations && criticalViolations.length > 0) {
          console.log(`\n⚠️ ACEITANDO após ${attempt} tentativas com ${criticalViolations.length} violação(ões) de rotação`);
          
          const warningsOnly = validation.violations.map(v => ({
            ...v,
            severity: 'warning' as const,
            details: v.details + ' (aceito: único corretor disponível)'
          }));
          
          return { 
            assignments: weekSchedule, 
            success: true,
            attempts: attempt,
            violations: warningsOnly
          };
        }
        
        if (attempt >= 30 && allRelaxableViolations && criticalViolations.length > 0) {
          console.log(`\n⚠️ ACEITANDO EMERGÊNCIA após ${attempt} tentativas`);
          console.log(`   ${criticalViolations.length} violação(ões) de regras relaxáveis (8, 10, 1)`);
          
          for (const v of criticalViolations) {
            console.log(`   ⚠️ ${v.rule}: ${v.brokerName} - ${v.details}`);
          }
          
          const warningsOnly = validation.violations.map(v => ({
            ...v,
            severity: 'warning' as const,
            details: v.details + ' (emergência: relaxado para evitar violação de Regras 4/6/9)'
          }));
          
          return { 
            assignments: weekSchedule, 
            success: true,
            attempts: attempt,
            violations: warningsOnly
          };
        }
      }
      
      const criticalCount = criticalViolations.length;
      console.log(`❌ Tentativa ${attempt} falhou: ${criticalCount} violação(ões) crítica(s)`);
      
      for (const v of validation.violations.slice(0, 3)) {
        console.log(`   - ${v.rule}: ${v.brokerName} - ${v.details}`);
      }
      if (validation.violations.length > 3) {
        console.log(`   ... e mais ${validation.violations.length - 3} violação(ões)`);
      }
      
      if (attempt === maxAttempts) {
        console.error(`\n❌ FALHA TOTAL após ${maxAttempts} tentativas para ${weekLabel}`);
        logViolations(validation);
        return { 
          assignments: [], 
          success: false, 
          attempts: attempt,
          violations: validation.violations 
        };
      }
      
    } catch (error) {
      console.error(`❌ Erro na tentativa ${attempt}:`, error);
      if (attempt === maxAttempts) {
        return { 
          assignments: [], 
          success: false, 
          attempts: attempt,
          violations: [{
            rule: 'ERRO DE SISTEMA',
            brokerName: 'N/A',
            brokerId: '',
            details: String(error),
            severity: 'critical'
          }]
        };
      }
    }
  }
  
  return { 
    assignments: [], 
    success: false, 
    attempts: maxAttempts,
    violations: [{
      rule: 'ERRO DESCONHECIDO',
      brokerName: 'N/A',
      brokerId: '',
      details: 'Loop de retry terminou inesperadamente',
      severity: 'critical'
    }]
  };
}

export interface MonthlyScheduleResult {
  weekStart: Date;
  weekEnd: Date;
  assignments: ScheduleAssignment[];
  attempts?: number;
}

export interface GenerateMonthlyResult {
  schedules: MonthlyScheduleResult[];
  success: boolean;
  failedWeek?: string;
  violations?: RuleViolation[];
}

export async function generateMonthlySchedule(
  month: number,
  year: number,
  onProgress?: (current: number, total: number, attempt?: number, maxAttempts?: number) => void,
  maxRetries: number = 100
): Promise<GenerateMonthlyResult> {
  const allWeeklySchedules: MonthlyScheduleResult[] = [];

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  console.log(`📅 Gerando escalas para ${format(monthStart, "MMMM/yyyy", { locale: ptBR })}`);
  console.log(`🔄 Sistema de retry ativado: até ${maxRetries} tentativas por semana`);

  const { data: brokersData } = await supabase
    .from("brokers")
    .select("id, name")
    .eq("is_active", true);
  
  const { data: locationsData } = await supabase
    .from("locations")
    .select("id, name, location_type, builder_company")
    .eq("is_active", true);
  
  const brokers: BrokerInfoForValidation[] = (brokersData || []).map(b => ({ id: b.id, name: b.name }));
  const locations: LocationInfoForValidation[] = (locationsData || []).map(l => ({ 
    id: l.id, 
    name: l.name, 
    type: l.location_type || 'external',
    builderCompany: l.builder_company || undefined
  }));

  const { data: internalLocations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("location_type", "internal")
    .eq("is_active", true);

  const tambauLocation = internalLocations?.find(l => 
    l.name.toLowerCase().includes("tambaú") || l.name.toLowerCase().includes("tambau")
  );
  const bessaLocation = internalLocations?.find(l => 
    l.name.toLowerCase().includes("bessa")
  );

  let tambauSaturdayQueue: SaturdayQueueItem[] = [];
  let bessaSaturdayQueue: SaturdayQueueItem[] = [];
  
  if (tambauLocation) {
    console.log(`\n🔄 Sincronizando fila de sábado para ${tambauLocation.name}...`);
    const syncResult = await syncSaturdayQueueForLocation(tambauLocation.id);
    console.log(`📊 Resultado: ${syncResult.added} adicionados, ${syncResult.deactivated} desativados`);
    
    tambauSaturdayQueue = await getSaturdayQueueForLocation(tambauLocation.id);
    console.log(`📋 Fila de sábado Tambaú (${tambauSaturdayQueue.length} corretores):`);
    tambauSaturdayQueue.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.broker_name} (posição: ${item.queue_position}, trabalhados: ${item.times_worked})`);
    });
  }
  
  if (bessaLocation) {
    console.log(`\n🔄 Sincronizando fila de sábado para ${bessaLocation.name}...`);
    const syncResult = await syncSaturdayQueueForLocation(bessaLocation.id);
    console.log(`📊 Resultado: ${syncResult.added} adicionados, ${syncResult.deactivated} desativados`);
    
    bessaSaturdayQueue = await getSaturdayQueueForLocation(bessaLocation.id);
    console.log(`📋 Fila de sábado Bessa (${bessaSaturdayQueue.length} corretores):`);
    bessaSaturdayQueue.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.broker_name} (posição: ${item.queue_position}, trabalhados: ${item.times_worked})`);
    });
  }

  // Semanas do mês
  const firstDayOfWeek = monthStart.getDay();
  const daysToSubtractFirst = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const firstWeekStart = addDays(monthStart, -daysToSubtractFirst);
  
  const lastDayOfWeek = monthEnd.getDay();
  const daysToSubtractLast = lastDayOfWeek === 0 ? 6 : lastDayOfWeek - 1;
  const lastWeekStart = addDays(monthEnd, -daysToSubtractLast);
  
  const mondays: Date[] = [];
  let currentMonday = new Date(firstWeekStart);
  
  while (currentMonday <= lastWeekStart) {
    mondays.push(new Date(currentMonday));
    currentMonday = addDays(currentMonday, 7);
  }

  console.log(`📊 ${mondays.length} semanas a gerar (cobrindo ${format(firstWeekStart, "dd/MM")} a ${format(addDays(lastWeekStart, 6), "dd/MM")})`);

  const firstMonday = mondays[0];
  const weekStartStr = format(firstMonday, "yyyy-MM-dd");
  
  const previousWeekStats = await getPreviousWeekStatsWithFallback(weekStartStr);
  console.log(`📊 Estatísticas da semana anterior:`, previousWeekStats.length > 0 ? previousWeekStats : "Nenhuma");

  // Carregar filas de rotação
  console.log("\n🔄 CARREGANDO FILAS DE ROTAÇÃO POR LOCAL...");
  
  const { data: externalLocationsForQueue } = await supabase
    .from("locations")
    .select("id, name")
    .eq("location_type", "external")
    .eq("is_active", true);
  
  let locationRotationQueues = new Map<string, LocationRotationQueueItem[]>();
  
  try {
    await syncAllLocationRotationQueues();
    const externalLocationIds = (externalLocationsForQueue || []).map(l => l.id);
    if (externalLocationIds.length > 0) {
      locationRotationQueues = await getMultipleLocationRotationQueues(externalLocationIds);
      console.log(`✅ Filas de rotação carregadas para ${locationRotationQueues.size} locais externos`);
    }
  } catch (error) {
    console.error("⚠️ Erro ao carregar filas de rotação:", error);
  }

  const accumulator: WeeklyAccumulator = {
    saturdayCounts: {},
    saturdayQueue: tambauSaturdayQueue,
    bessaSaturdayQueue,
    previousWeekStats,
    lastWeekExternals: [],
    externalCountsThisMonth: {},
    lastWeekTambauSaturdayBrokers: [],
    locationRotationQueues,
    monthSaturdayCount: {},
    monthSundayCount: {},
    monthSundayAtLocation: {}
  };

  const { data: allActiveBrokers } = await supabase
    .from("brokers")
    .select("id, name")
    .eq("is_active", true);

  for (let i = 0; i < mondays.length; i++) {
    const monday = mondays[i];
    const weekStart = monday;
    const weekEnd = addDays(weekStart, 6);
    const weekLabel = `${format(weekStart, "dd/MM")} a ${format(weekEnd, "dd/MM")}`;

    onProgress?.(i + 1, mondays.length);

    let daysInMonth = 0;
    for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
      if (d >= monthStart && d <= monthEnd) daysInMonth++;
    }
    console.log(`📅 Semana ${format(weekStart, "dd/MM")} - ${format(weekEnd, "dd/MM")}: ${daysInMonth} dias dentro do mês selecionado`);

    console.log(`\n🔄 Gerando semana ${format(weekStart, "dd/MM/yyyy")} a ${format(weekEnd, "dd/MM/yyyy")}`);

    const result = await generateWeeklyScheduleWithRetry(
      weekStart,
      weekEnd,
      accumulator,
      brokers,
      locations,
      maxRetries,
      (attempt, max) => onProgress?.(i + 1, mondays.length, attempt, max)
    );

    if (!result.success) {
      console.error(`\n❌ FALHA na geração da semana ${weekLabel}`);
      return {
        schedules: allWeeklySchedules,
        success: false,
        failedWeek: weekLabel,
        violations: result.violations
      };
    }

    const weekSchedule = result.assignments;
    
    allWeeklySchedules.push({
      weekStart,
      weekEnd,
      assignments: weekSchedule,
      attempts: result.attempts
    });

    // Atualizar acumuladores
    const externalLocationIds = new Set(
      (externalLocationsForQueue || []).map(l => l.id)
    );
    
    const brokerExternalDays = new Map<string, Set<string>>();
    const brokerStatsMap = new Map<string, { external: number; internal: number; saturday: number }>();
    const saturdayBrokers: string[] = [];

    for (const assignment of weekSchedule) {
      const isExternal = externalLocationIds.has(assignment.location_id);
      const isSaturday = new Date(assignment.assignment_date + "T00:00:00").getDay() === 6;
      
      if (!brokerStatsMap.has(assignment.broker_id)) {
        brokerStatsMap.set(assignment.broker_id, { external: 0, internal: 0, saturday: 0 });
      }
      const stats = brokerStatsMap.get(assignment.broker_id)!;
      
      if (isExternal) {
        stats.external++;
        if (!brokerExternalDays.has(assignment.broker_id)) {
          brokerExternalDays.set(assignment.broker_id, new Set());
        }
        brokerExternalDays.get(assignment.broker_id)!.add(assignment.assignment_date);
      } else {
        stats.internal++;
      }
      
      if (isSaturday) {
        stats.saturday++;
        if (!saturdayBrokers.includes(assignment.broker_id)) {
          saturdayBrokers.push(assignment.broker_id);
        }
        accumulator.saturdayCounts[assignment.broker_id] = 
          (accumulator.saturdayCounts[assignment.broker_id] || 0) + 1;
      }
    }

    // Salvar estatísticas
    for (const broker of allActiveBrokers || []) {
      const stats = brokerStatsMap.get(broker.id) || { external: 0, internal: 0, saturday: 0 };
      await saveBrokerWeeklyStats(
        broker.id,
        format(weekStart, "yyyy-MM-dd"),
        format(weekEnd, "yyyy-MM-dd"),
        stats.external,
        stats.internal,
        stats.saturday
      );
    }

    // ═══════════════════════════════════════════════════════════
    // CORREÇÃO BUG: Atualizar fila de sábado do Tambaú APENAS com
    // quem realmente trabalhou no TAMBAÚ (não sábado externo genérico)
    // ═══════════════════════════════════════════════════════════
    if (tambauLocation) {
      const saturdayDateStr = format(addDays(weekStart, 5), "yyyy-MM-dd");
      
      // CORREÇÃO: Filtrar APENAS quem trabalhou no Tambaú no sábado
      // (não inclui quem trabalhou sábado externo em outro local)
      const tambauSaturdayBrokers = weekSchedule
        .filter(a => 
          a.location_id === tambauLocation.id && 
          a.assignment_date === saturdayDateStr
        )
        .map(a => a.broker_id)
        .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicar
      
      if (tambauSaturdayBrokers.length > 0) {
        console.log(`   📋 Atualizando fila Tambaú: ${tambauSaturdayBrokers.length} corretores trabalharam no sábado interno`);
        await updateSaturdayQueueAfterAllocation(
          tambauLocation.id,
          tambauSaturdayBrokers,
          saturdayDateStr
        );
        
        accumulator.saturdayQueue = await getSaturdayQueueForLocation(tambauLocation.id);
        accumulator.lastWeekTambauSaturdayBrokers = [...tambauSaturdayBrokers];
      }
    }
    
    // Atualizar fila de sábado do Bessa
    if (bessaLocation) {
      const saturdayDateStr = format(addDays(weekStart, 5), "yyyy-MM-dd");
      
      const bessaSaturdayBrokers = weekSchedule
        .filter(a => 
          a.location_id === bessaLocation.id && 
          a.assignment_date === saturdayDateStr
        )
        .map(a => a.broker_id)
        .filter((v, i, arr) => arr.indexOf(v) === i);
      
      if (bessaSaturdayBrokers.length > 0) {
        await updateSaturdayQueueAfterAllocation(
          bessaLocation.id,
          bessaSaturdayBrokers,
          saturdayDateStr
        );
      }
      
      accumulator.bessaSaturdayQueue = await getSaturdayQueueForLocation(bessaLocation.id);
    }

    // Atualizar contagens mensais de externos
    for (const [brokerId, externalDaysSet] of brokerExternalDays) {
      accumulator.externalCountsThisMonth[brokerId] = 
        (accumulator.externalCountsThisMonth[brokerId] || 0) + externalDaysSet.size;
    }

    // ═══════════════════════════════════════════════════════════
    // NOVO: Atualizar contadores mensais de sábado e domingo
    // ═══════════════════════════════════════════════════════════
    for (const assignment of weekSchedule) {
      const assignmentDate = new Date(assignment.assignment_date + "T00:00:00");
      const dayOfWeek = assignmentDate.getDay();
      
      if (dayOfWeek === 6) {
        // Sábado
        accumulator.monthSaturdayCount[assignment.broker_id] = 
          (accumulator.monthSaturdayCount[assignment.broker_id] || 0) + 1;
      } else if (dayOfWeek === 0) {
        // Domingo
        accumulator.monthSundayCount[assignment.broker_id] = 
          (accumulator.monthSundayCount[assignment.broker_id] || 0) + 1;
        
        // Domingo por local específico (para evitar concentração)
        if (!accumulator.monthSundayAtLocation[assignment.location_id]) {
          accumulator.monthSundayAtLocation[assignment.location_id] = {};
        }
        accumulator.monthSundayAtLocation[assignment.location_id][assignment.broker_id] = 
          (accumulator.monthSundayAtLocation[assignment.location_id][assignment.broker_id] || 0) + 1;
      }
    }

    // Atualizar stats da semana anterior
    const newPreviousStats: BrokerWeeklyStat[] = [];
    for (const broker of allActiveBrokers || []) {
      const stats = brokerStatsMap.get(broker.id) || { external: 0, internal: 0, saturday: 0 };
      newPreviousStats.push({
        broker_id: broker.id,
        broker_name: broker.name,
        external_count: stats.external,
        internal_count: stats.internal,
        saturday_count: stats.saturday,
      });
    }
    accumulator.previousWeekStats = newPreviousStats;

    // Atualizar externos dos últimos 3 dias
    const friday = addDays(weekStart, 4);
    const saturday = addDays(weekStart, 5);
    const sunday = addDays(weekStart, 6);
    const lastThreeDays = [
      format(friday, "yyyy-MM-dd"),
      format(saturday, "yyyy-MM-dd"),
      format(sunday, "yyyy-MM-dd")
    ];

    accumulator.lastWeekExternals = weekSchedule
      .filter(a => {
        if (!externalLocationIds.has(a.location_id)) return false;
        return lastThreeDays.includes(a.assignment_date);
      })
      .map(a => ({ brokerId: a.broker_id, date: a.assignment_date }));
  }

  console.log(`\n🎉 Total: ${allWeeklySchedules.length} semanas geradas para o mês COM SUCESSO!`);

  return {
    schedules: allWeeklySchedules,
    success: true
  };
}

async function generateWeeklyScheduleWithAccumulator(
  weekStart: Date,
  weekEnd: Date,
  accumulator: WeeklyAccumulator,
  attemptSeed: number = 1
): Promise<ScheduleAssignment[]> {
  const assignments: ScheduleAssignment[] = [];
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`🚀 GERAÇÃO COM ANÁLISE DE GARGALOS: ${format(weekStart, "dd/MM/yyyy")} a ${format(weekEnd, "dd/MM/yyyy")}`);
  console.log("═══════════════════════════════════════════════════════════");

  const weekNumber = Math.floor((weekStart.getTime() - new Date(2024, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const isEvenWeek = weekNumber % 2 === 0;
  console.log(`📅 Semana ${isEvenWeek ? "PAR" : "ÍMPAR"} (número ${weekNumber})`);

  const [
    { brokerCounts, brokerLastDates, saturdayTotalCounts: dbSaturdayCounts },
    { data: allBrokers }
  ] = await Promise.all([
    getPreviousSchedules(3),
    supabase.from("brokers").select("*").eq("is_active", true)
  ]);

  const saturdayTotalCounts: { [key: string]: number } = { ...dbSaturdayCounts };
  for (const [brokerId, count] of Object.entries(accumulator.saturdayCounts)) {
    saturdayTotalCounts[brokerId] = (saturdayTotalCounts[brokerId] || 0) + count;
  }

  if (!allBrokers || allBrokers.length === 0) {
    console.error("❌ ERRO: Nenhum corretor ativo encontrado!");
    return [];
  }

  const [
    { data: internalLocations },
    { data: locationBrokersData }
  ] = await Promise.all([
    supabase.from("locations").select(`
      id, name, location_type,
      location_brokers (broker_id, brokers (id, name))
    `).eq("location_type", "internal").eq("is_active", true),
    supabase.from("location_brokers").select(`
      broker_id, location_id,
      locations!inner (name, location_type)
    `).eq("locations.location_type", "internal")
  ]);

  const brokerInternalLocationMap = new Map<string, "bessa" | "tambau">();
  
  for (const lb of locationBrokersData || []) {
    const locationName = (lb as any).locations?.name?.toLowerCase() || "";
    if (locationName.includes("bessa")) {
      brokerInternalLocationMap.set(lb.broker_id, "bessa");
    } else if (locationName.includes("tambaú") || locationName.includes("tambau")) {
      brokerInternalLocationMap.set(lb.broker_id, "tambau");
    }
  }

  // Pré-identificar trabalhadores de sábado interno
  const saturdayInternalWorkers = new Set<string>();
  
  let saturdayDate: Date | null = null;
  for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
    if (d.getDay() === 6) {
      saturdayDate = d;
      break;
    }
  }
  
  if (saturdayDate && accumulator.saturdayQueue.length > 0) {
    const { data: tambauLocationData } = await supabase
      .from("locations")
      .select(`
        id, name,
        location_periods (
          id, start_date, end_date,
          period_day_configs (weekday, max_brokers_count, has_morning, has_afternoon)
        )
      `)
      .ilike("name", "%tambaú%")
      .eq("location_type", "internal")
      .eq("is_active", true)
      .single();
    
    if (tambauLocationData) {
      const saturdayPeriod = tambauLocationData.location_periods?.find(
        (p: any) => new Date(p.start_date + "T00:00:00") <= saturdayDate! && new Date(p.end_date + "T00:00:00") >= saturdayDate!
      );
      const tambauSatConfig = saturdayPeriod?.period_day_configs?.find((dc: any) => dc.weekday === "saturday");
      
      if (tambauSatConfig) {
        const maxBrokers = Math.max(tambauSatConfig.max_brokers_count || 2, 2); // MÍNIMO 2 corretores
        const prevSaturdayStr = format(subDays(saturdayDate, 7), "yyyy-MM-dd");
        
        console.log(`\n📋 PRÉ-IDENTIFICANDO TRABALHADORES DE SÁBADO INTERNO:`);
        console.log(`   Tambaú precisa de ${maxBrokers} corretores no sábado (mínimo 2)`);
        
        // ═══════════════════════════════════════════════════════════
        // CORREÇÃO CRÍTICA: Ordenar candidatos para sábado interno priorizando:
        // 1. MENOS sábados internos no mês (balanceamento mensal)
        // 2. MENOR queue_position (FIFO - quem está esperando há mais tempo)
        // 3. MENOS times_worked (histórico de sábados)
        // 
        // LÓGICA ANTIGA ERRADA: priorizava "mais locais externos" o que
        // concentrava sábados em poucos corretores
        // ═══════════════════════════════════════════════════════════
        
        // Ordenar candidatos pelo critério CORRETO: menos sábados primeiro
        const sortedCandidates = [...accumulator.saturdayQueue]
          .filter(q => !accumulator.lastWeekTambauSaturdayBrokers.includes(q.broker_id))
          .sort((a, b) => {
            // PRIORIDADE 1: Menos sábados (internos) trabalhados no histórico
            const timesA = a.times_worked || 0;
            const timesB = b.times_worked || 0;
            if (timesA !== timesB) return timesA - timesB;
            
            // PRIORIDADE 2: Menor posição na fila = esperando há mais tempo (FIFO)
            const posA = a.queue_position ?? 999;
            const posB = b.queue_position ?? 999;
            return posA - posB;
          });
        
        console.log(`   📊 Candidatos ordenados por MENOS sábados (FIFO):`);
        for (const cand of sortedCandidates.slice(0, 5)) {
          console.log(`      ${cand.broker_name}: ${cand.times_worked || 0} sábados, pos ${cand.queue_position}`);
        }
        
        let countIdentified = 0;
        for (const candidate of sortedCandidates) {
          if (countIdentified >= maxBrokers) break;
          
          saturdayInternalWorkers.add(candidate.broker_id);
          console.log(`   🏢 ${candidate.broker_name}: reservado para Tambaú sábado (${candidate.times_worked || 0} sábados, pos ${candidate.queue_position})`);
          countIdentified++;
        }
        
        // Se não conseguiu identificar o mínimo de 2, buscar mais (incluindo quem trabalhou semana passada)
        if (countIdentified < 2) {
          console.log(`   ⚠️ Apenas ${countIdentified} identificados, buscando mais para atingir mínimo 2...`);
          const remaining = [...accumulator.saturdayQueue]
            .filter(q => !saturdayInternalWorkers.has(q.broker_id))
            .sort((a, b) => {
              // Mesmo critério: menos sábados primeiro
              const timesA = a.times_worked || 0;
              const timesB = b.times_worked || 0;
              if (timesA !== timesB) return timesA - timesB;
              return (a.queue_position ?? 999) - (b.queue_position ?? 999);
            });
          
          for (const candidate of remaining) {
            if (countIdentified >= 2) break;
            
            saturdayInternalWorkers.add(candidate.broker_id);
            console.log(`   🏢 ${candidate.broker_name}: adicionado para atingir mínimo`);
            countIdentified++;
          }
        }
      }
    }
  }

  const externalShiftTargets = new Map<string, number>();
  
  // Detectar quem trabalhou sábado na SEMANA ANTERIOR (via previousWeekStats)
  const workedSaturdayLastWeekSet = new Set<string>();
  for (const broker of allBrokers) {
    const prevWeekStats = accumulator.previousWeekStats.find(s => s.broker_id === broker.id);
    if (prevWeekStats && (prevWeekStats.saturday_count || 0) > 0) {
      workedSaturdayLastWeekSet.add(broker.id);
    }
  }
  
  if (workedSaturdayLastWeekSet.size > 0) {
    console.log(`\n📋 CORRETORES QUE TRABALHARAM SÁBADO NA SEMANA PASSADA:`);
    for (const bId of workedSaturdayLastWeekSet) {
      const bName = allBrokers.find(b => b.id === bId)?.name || bId;
      console.log(`   🗓️ ${bName}`);
    }
  }
  
  for (const broker of allBrokers) {
    const prevWeekStats = accumulator.previousWeekStats.find(s => s.broker_id === broker.id);
    
    let target = 2;
    
    // COMPENSAÇÃO DINÂMICA: Corretores que trabalharam sábado na semana passada
    // Eles não puderam pegar sáb/dom externo → compensar com mais externos seg-sex
    // Target base = 2 (ou o calculado), será elevado a 3 SOMENTE se houver demanda pendente
    // (a elevação dinâmica acontece na Etapa 9 quando há demandas não alocadas)
    if (workedSaturdayLastWeekSet.has(broker.id)) {
      // Garantir mínimo de 2 (não reduz para 1 por alternância)
      target = Math.max(target, 2);
      console.log(`   🎯 TARGET COMPENSATÓRIO: ${broker.name} → target ${target} (trabalhou sábado semana passada)`);
    }
    
    // Corretores de sábado INTERNO desta semana também têm compensação
    if (saturdayInternalWorkers.has(broker.id)) {
      target = Math.max(target, 2);
      console.log(`   🎯 TARGET COMPENSATÓRIO: ${broker.name} → target ${target} (sábado interno esta semana)`);
    }
    
    externalShiftTargets.set(broker.id, target);
  }

  const brokerQueue: BrokerQueueItem[] = allBrokers.map((broker) => {
    const prevWeekStats = accumulator.previousWeekStats.find(s => s.broker_id === broker.id);
    const target = externalShiftTargets.get(broker.id) || 2;
    
    return {
      brokerId: broker.id,
      brokerName: broker.name,
      externalShiftCount: 0,
      lastExternalDate: brokerLastDates[broker.id] || null,
      availableWeekdays: broker.available_weekdays || [],
      internalLocation: brokerInternalLocationMap.get(broker.id) || null,
      recentSaturdayTotalCount: saturdayTotalCounts[broker.id] || 0,
      previousWeekExternals: prevWeekStats?.external_count || 0,
      externalLocationCount: 0,
      externalCredit: target,
      targetExternals: target,
      workedSaturdayLastWeek: workedSaturdayLastWeekSet.has(broker.id),
    };
  });

  const dailyExternalAssignments = new Map<string, Set<string>>();
  const weekendExternalAssignments = new Map<string, string>();

  const [
    { data: externalLocations },
    { data: internalLocationsData },
    { data: excludedDates },
    { data: allSpecificConfigs }
  ] = await Promise.all([
    supabase.from("locations").select(`
      id, name, location_type, builder_company, shift_config_mode,
      location_periods (
        id, period_type, start_date, end_date,
        period_day_configs (weekday, max_brokers_count, has_morning, morning_start, morning_end, has_afternoon, afternoon_start, afternoon_end)
      ),
      location_brokers (
        broker_id, available_morning, available_afternoon, weekday_shift_availability,
        brokers (id, name, available_weekdays, weekday_shift_availability)
      )
    `).eq("location_type", "external").eq("is_active", true),
    supabase.from("locations").select(`
      id, name, location_type, shift_config_mode,
      location_periods (
        id, period_type, start_date, end_date,
        period_day_configs (weekday, max_brokers_count, has_morning, morning_start, morning_end, has_afternoon, afternoon_start, afternoon_end)
      ),
      location_brokers (
        broker_id, available_morning, available_afternoon, weekday_shift_availability,
        brokers (id, name, available_weekdays, weekday_shift_availability)
      )
    `).eq("location_type", "internal").eq("is_active", true),
    supabase.from("period_excluded_dates").select("*"),
    supabase.from("period_specific_day_configs").select("*")
  ]);

  // Calcular locais externos por corretor
  const brokerExternalLocationCounts = new Map<string, number>();
  for (const location of externalLocations || []) {
    for (const lb of location.location_brokers || []) {
      const currentCount = brokerExternalLocationCounts.get(lb.broker_id) || 0;
      brokerExternalLocationCounts.set(lb.broker_id, currentCount + 1);
    }
  }
  
  for (const broker of brokerQueue) {
    broker.externalLocationCount = brokerExternalLocationCounts.get(broker.brokerId) || 0;
  }

  // ═══════════════════════════════════════════════════════════
  // excludedDatesMap: period_id → dateStr → { shifts: null | string[] }
  // shifts === null significa "dia todo excluído"
  // shifts === ['morning'] significa apenas manhã excluída, etc.
  // ═══════════════════════════════════════════════════════════
  interface ExcludedDateEntry { shifts: string[] | null }
  const excludedDatesMap = new Map<string, Map<string, ExcludedDateEntry>>();
  excludedDates?.forEach((ed: any) => {
    if (!excludedDatesMap.has(ed.period_id)) excludedDatesMap.set(ed.period_id, new Map());
    const shifts = (ed.excluded_shifts && ed.excluded_shifts.length > 0) ? ed.excluded_shifts : null;
    excludedDatesMap.get(ed.period_id)!.set(ed.excluded_date, { shifts });
  });

  // ═══════════════════════════════════════════════════════════
  // locationExcludedDatesMap: location_id → dateStr → { shifts: null | string[] }
  // Agrega exclusões de TODOS os períodos de um local, para cobrir cenários
  // onde a exclusão foi salva num período diferente do "activePeriod" encontrado.
  // ═══════════════════════════════════════════════════════════
  const locationExcludedDatesMap = new Map<string, Map<string, ExcludedDateEntry>>();
  
  // Mapear period_id → location_id usando dados já carregados
  const periodToLocationMap = new Map<string, string>();
  for (const loc of (externalLocations || [])) {
    for (const p of (loc.location_periods || [])) {
      periodToLocationMap.set(p.id, loc.id);
    }
  }
  for (const loc of (internalLocationsData || [])) {
    for (const p of (loc.location_periods || [])) {
      periodToLocationMap.set(p.id, loc.id);
    }
  }
  
  excludedDates?.forEach((ed: any) => {
    const locationId = periodToLocationMap.get(ed.period_id);
    if (!locationId) return;
    if (!locationExcludedDatesMap.has(locationId)) locationExcludedDatesMap.set(locationId, new Map());
    const shifts = (ed.excluded_shifts && ed.excluded_shifts.length > 0) ? ed.excluded_shifts : null;
    const existing = locationExcludedDatesMap.get(locationId)!.get(ed.excluded_date);
    if (existing) {
      // Se já existe uma exclusão total, manter
      if (existing.shifts === null) return;
      // Se a nova é total, substituir
      if (shifts === null) {
        locationExcludedDatesMap.get(locationId)!.set(ed.excluded_date, { shifts: null });
        return;
      }
      // Mesclar turnos excluídos
      const merged = new Set([...(existing.shifts || []), ...shifts]);
      locationExcludedDatesMap.get(locationId)!.set(ed.excluded_date, { shifts: Array.from(merged) });
    } else {
      locationExcludedDatesMap.get(locationId)!.set(ed.excluded_date, { shifts });
    }
  });

  // Log de exclusões carregadas para diagnóstico
  console.log(`📋 Exclusões carregadas: ${excludedDates?.length || 0} registros em period_excluded_dates`);
  for (const [locId, dates] of locationExcludedDatesMap.entries()) {
    const locName = [...(externalLocations || []), ...(internalLocationsData || [])].find(l => l.id === locId)?.name || locId;
    for (const [dateStr, entry] of dates.entries()) {
      console.log(`   🚫 ${locName}: ${dateStr} excluído (${entry.shifts === null ? 'dia inteiro' : entry.shifts.join(', ')})`);
    }
  }

  // Função auxiliar: verifica se um turno específico está excluído
  // Verifica tanto pelo period_id direto quanto pelo location_id (fallback)
  const isShiftExcluded = (periodId: string, dateStr: string, shift: "morning" | "afternoon", locationId?: string): boolean => {
    // Verificar pelo period_id direto
    const periodExclusions = excludedDatesMap.get(periodId);
    if (periodExclusions) {
      const entry = periodExclusions.get(dateStr);
      if (entry) {
        if (entry.shifts === null) return true;
        if (entry.shifts.includes(shift)) return true;
      }
    }
    // Fallback: verificar por location_id (cobre caso de period_id diferente)
    if (locationId) {
      const locExclusions = locationExcludedDatesMap.get(locationId);
      if (locExclusions) {
        const entry = locExclusions.get(dateStr);
        if (entry) {
          if (entry.shifts === null) return true;
          if (entry.shifts.includes(shift)) return true;
        }
      }
    }
    return false;
  };

  // Verifica se o dia INTEIRO está excluído (ambos os turnos ou shifts === null)
  // Verifica tanto pelo period_id direto quanto pelo location_id (fallback)
  const isDayFullyExcluded = (periodId: string, dateStr: string, locationId?: string): boolean => {
    // Verificar pelo period_id direto
    const periodExclusions = excludedDatesMap.get(periodId);
    if (periodExclusions) {
      const entry = periodExclusions.get(dateStr);
      if (entry) {
        if (entry.shifts === null) return true;
        if (entry.shifts.includes("morning") && entry.shifts.includes("afternoon")) return true;
      }
    }
    // Fallback: verificar por location_id
    if (locationId) {
      const locExclusions = locationExcludedDatesMap.get(locationId);
      if (locExclusions) {
        const entry = locExclusions.get(dateStr);
        if (entry) {
          if (entry.shifts === null) return true;
          if (entry.shifts.includes("morning") && entry.shifts.includes("afternoon")) return true;
        }
      }
    }
    return false;
  };

  const specificConfigsMap = new Map<string, any>();
  allSpecificConfigs?.forEach((config: any) => {
    specificConfigsMap.set(`${config.period_id}-${config.specific_date}`, config);
  });

  // IDs de locais internos
  const internalLocIds = new Set((internalLocationsData || []).map((l: any) => l.id));

  // Mapear demandas externas
  console.log("\n📍 ETAPA 1: MAPEANDO DEMANDAS EXTERNAS...");

  // Mapa de exclusões de elegibilidade por corretor
  const eligibilityExclusionMap = new Map<string, {
    brokerId: string;
    brokerName: string;
    totalDemands: number;
    eligible: number;
    excluded: number;
    byReason: Record<string, number>;
    details: { locationName: string; dateStr: string; shift: string; reason: string }[];
  }>();

  const allExternalDemands: ExternalDemand[] = [];

  // ═══════════════════════════════════════════════════════════
  // REGRA ABSOLUTA: Verificar disponibilidade de turno
  // A disponibilidade GLOBAL do corretor NUNCA pode ser ultrapassada
  // O vínculo local pode ser mais restritivo, mas NUNCA mais permissivo
  // ═══════════════════════════════════════════════════════════
  const isBrokerAvailableForShift = (lb: any, shift: "morning" | "afternoon", dayOfWeek: string): boolean => {
    return isBrokerAvailableForShiftWithReason(lb, shift, dayOfWeek).available;
  };

  // Versão que retorna o motivo da exclusão para diagnóstico
  const isBrokerAvailableForShiftWithReason = (lb: any, shift: "morning" | "afternoon", dayOfWeek: string): { available: boolean; reason?: string } => {
    const broker = lb.brokers;
    
    // REGRA ABSOLUTA #1: Corretor deve estar disponível para este dia da semana
    if (!broker?.available_weekdays?.includes(dayOfWeek)) {
      return { available: false, reason: `DIA: ${dayOfWeek} não está em available_weekdays` };
    }
    
    // REGRA ABSOLUTA #2: Verificar disponibilidade GLOBAL do corretor para este turno
    const globalAvail = broker.weekday_shift_availability as Record<string, string[]> | null;
    if (globalAvail && globalAvail[dayOfWeek]) {
      if (!globalAvail[dayOfWeek].includes(shift)) {
        return { available: false, reason: `GLOBAL: sem disponibilidade para ${shift} em ${dayOfWeek}` };
      }
    }
    
    // Verificar disponibilidade no vínculo local (pode ser mais restritivo)
    const localAvail = lb.weekday_shift_availability as Record<string, string[]> | null;
    if (localAvail && localAvail[dayOfWeek]) {
      // CORREÇÃO: Se array vazio, tratar como "sem restrição local" e usar fallback legacy
      const localShifts = localAvail[dayOfWeek];
      if (localShifts.length === 0) {
        // Fallback para campos legacy quando array local está vazio
        if (shift === "morning" && lb.available_morning === false) {
          return { available: false, reason: `LEGACY: available_morning = false (local vazio)` };
        }
        if (shift === "afternoon" && lb.available_afternoon === false) {
          return { available: false, reason: `LEGACY: available_afternoon = false (local vazio)` };
        }
        return { available: true };
      }
      if (!localShifts.includes(shift)) {
        return { available: false, reason: `LOCAL: weekday_shift_availability não inclui ${shift} em ${dayOfWeek}` };
      }
      return { available: true };
    }
    
    // Fallback para campos legacy
    if (shift === "morning" && lb.available_morning === false) {
      return { available: false, reason: `LEGACY: available_morning = false` };
    }
    if (shift === "afternoon" && lb.available_afternoon === false) {
      return { available: false, reason: `LEGACY: available_afternoon = false` };
    }
    return { available: true };
  };

  for (const location of externalLocations || []) {
    for (let date = new Date(weekStart); date <= weekEnd; date = addDays(date, 1)) {
      const dayOfWeek = weekdays[date.getDay() === 0 ? 6 : date.getDay() - 1];
      const dateStr = format(date, "yyyy-MM-dd");

      const activePeriod = location.location_periods?.find(
        (p: any) => new Date(p.start_date + "T00:00:00") <= date && new Date(p.end_date + "T00:00:00") >= date
      );
      if (!activePeriod) continue;

      // Verificar exclusões (suporte a turno específico)
      if (isDayFullyExcluded(activePeriod.id, dateStr)) continue;

      // Verificar configuração específica ou padrão
      const specificConfig = specificConfigsMap.get(`${activePeriod.id}-${dateStr}`);
      let hasMorning = false, hasAfternoon = false;
      let morningStart = "08:00", morningEnd = "12:00";
      let afternoonStart = "13:00", afternoonEnd = "18:00";
      let maxBrokersCount = 1;

      if (specificConfig) {
        hasMorning = specificConfig.has_morning;
        hasAfternoon = specificConfig.has_afternoon;
        if (specificConfig.morning_start) morningStart = specificConfig.morning_start;
        if (specificConfig.morning_end) morningEnd = specificConfig.morning_end;
        if (specificConfig.afternoon_start) afternoonStart = specificConfig.afternoon_start;
        if (specificConfig.afternoon_end) afternoonEnd = specificConfig.afternoon_end;
        maxBrokersCount = specificConfig.max_brokers_count || 1;
      } else if (location.shift_config_mode === 'specific_date') {
        continue;
      } else {
        const dayConfig = activePeriod.period_day_configs?.find((dc: any) => dc.weekday === dayOfWeek);
        if (!dayConfig) continue;
        hasMorning = dayConfig.has_morning;
        hasAfternoon = dayConfig.has_afternoon;
        if (dayConfig.morning_start) morningStart = dayConfig.morning_start;
        if (dayConfig.morning_end) morningEnd = dayConfig.morning_end;
        if (dayConfig.afternoon_start) afternoonStart = dayConfig.afternoon_start;
        if (dayConfig.afternoon_end) afternoonEnd = dayConfig.afternoon_end;
        maxBrokersCount = dayConfig.max_brokers_count || 1;
      }

      // Aplicar exclusão por turno (caso não seja dia todo excluído)
      if (isShiftExcluded(activePeriod.id, dateStr, "morning")) hasMorning = false;
      if (isShiftExcluded(activePeriod.id, dateStr, "afternoon")) hasAfternoon = false;

      if (!hasMorning && !hasAfternoon) continue;

      const locationBrokerMap = new Map<string, { available_morning: boolean; available_afternoon: boolean }>();
      for (const lb of location.location_brokers || []) {
        locationBrokerMap.set(lb.broker_id, {
          available_morning: isBrokerAvailableForShift(lb, "morning", dayOfWeek),
          available_afternoon: isBrokerAvailableForShift(lb, "afternoon", dayOfWeek)
        });
      }

      // REMOVIDO: needsSameBroker - agora NUNCA é permitido ter mesmo corretor em manhã e tarde no mesmo local externo

      if (hasMorning) {
        const eligibleIds: string[] = [];
        for (const lb of location.location_brokers || []) {
          const result = isBrokerAvailableForShiftWithReason(lb, "morning", dayOfWeek);
          if (!result.available) {
            // Registrar exclusão de elegibilidade
            const brokerId = lb.broker_id;
            const brokerName = lb.brokers?.name || brokerId;
            if (!eligibilityExclusionMap.has(brokerId)) {
              eligibilityExclusionMap.set(brokerId, { brokerId, brokerName, totalDemands: 0, eligible: 0, excluded: 0, byReason: {}, details: [] });
            }
            const entry = eligibilityExclusionMap.get(brokerId)!;
            entry.totalDemands++;
            entry.excluded++;
            const reason = result.reason || "DESCONHECIDO";
            entry.byReason[reason] = (entry.byReason[reason] || 0) + 1;
            entry.details.push({ locationName: location.name, dateStr, shift: "morning", reason });
            continue;
          }
          eligibleIds.push(lb.broker_id);
          // Contar como demanda elegível
          const brokerId2 = lb.broker_id;
          if (!eligibilityExclusionMap.has(brokerId2)) {
            eligibilityExclusionMap.set(brokerId2, { brokerId: brokerId2, brokerName: lb.brokers?.name || brokerId2, totalDemands: 0, eligible: 0, excluded: 0, byReason: {}, details: [] });
          }
          eligibilityExclusionMap.get(brokerId2)!.totalDemands++;
          eligibilityExclusionMap.get(brokerId2)!.eligible++;
        }
        allExternalDemands.push({
          locationId: location.id, locationName: location.name, date: new Date(date), dateStr, dayOfWeek,
          shift: "morning", startTime: morningStart, endTime: morningEnd, eligibleBrokerIds: eligibleIds,
          builderCompany: location.builder_company, needsSameBroker: false, locationBrokerMap
        });
      }

      if (hasAfternoon) {
        const eligibleIds: string[] = [];
        for (const lb of location.location_brokers || []) {
          const result = isBrokerAvailableForShiftWithReason(lb, "afternoon", dayOfWeek);
          if (!result.available) {
            const brokerId = lb.broker_id;
            const brokerName = lb.brokers?.name || brokerId;
            if (!eligibilityExclusionMap.has(brokerId)) {
              eligibilityExclusionMap.set(brokerId, { brokerId, brokerName, totalDemands: 0, eligible: 0, excluded: 0, byReason: {}, details: [] });
            }
            const entry = eligibilityExclusionMap.get(brokerId)!;
            entry.totalDemands++;
            entry.excluded++;
            const reason = result.reason || "DESCONHECIDO";
            entry.byReason[reason] = (entry.byReason[reason] || 0) + 1;
            entry.details.push({ locationName: location.name, dateStr, shift: "afternoon", reason });
            continue;
          }
          eligibleIds.push(lb.broker_id);
          const brokerId2 = lb.broker_id;
          if (!eligibilityExclusionMap.has(brokerId2)) {
            eligibilityExclusionMap.set(brokerId2, { brokerId: brokerId2, brokerName: lb.brokers?.name || brokerId2, totalDemands: 0, eligible: 0, excluded: 0, byReason: {}, details: [] });
          }
          eligibilityExclusionMap.get(brokerId2)!.totalDemands++;
          eligibilityExclusionMap.get(brokerId2)!.eligible++;
        }
        allExternalDemands.push({
          locationId: location.id, locationName: location.name, date: new Date(date), dateStr, dayOfWeek,
          shift: "afternoon", startTime: afternoonStart, endTime: afternoonEnd, eligibleBrokerIds: eligibleIds,
          builderCompany: location.builder_company, needsSameBroker: false, locationBrokerMap
        });
      }
    }
  }

  console.log(`📋 Total: ${allExternalDemands.length} demandas externas`);

  // ═══════════════════════════════════════════════════════════
  // CONSTRUIR MAPA BROKER-CÊNTRICO DE ELEGIBILIDADE
  // Para cada corretor, quais locais externos ele está vinculado
  // e para quais demandas (dia/turno) ele é elegível ou excluído
  // ═══════════════════════════════════════════════════════════
  const brokerEligibilityBuilder = new Map<string, {
    brokerId: string;
    brokerName: string;
    locations: Map<string, BrokerLocationEligibility>;
  }>();
  
  // Inicializar com todos os corretores ATIVOS que têm vínculos externos
  const activeBrokerIds = new Set(brokerQueue.map(b => b.brokerId));
  for (const location of externalLocations || []) {
    for (const lb of location.location_brokers || []) {
      const brokerId = lb.broker_id;
      if (!activeBrokerIds.has(brokerId)) continue; // Pular corretores inativos
      const brokerName = lb.brokers?.name || brokerId;
      if (!brokerEligibilityBuilder.has(brokerId)) {
        brokerEligibilityBuilder.set(brokerId, {
          brokerId,
          brokerName,
          locations: new Map()
        });
      }
      const builder = brokerEligibilityBuilder.get(brokerId)!;
      if (!builder.locations.has(location.id)) {
        builder.locations.set(location.id, {
          locationId: location.id,
          locationName: location.name,
          eligible: [],
          excluded: []
        });
      }
    }
  }
  
  // Preencher com dados das demandas
  for (const demand of allExternalDemands) {
    for (const [brokerId, builder] of brokerEligibilityBuilder) {
      const locEntry = builder.locations.get(demand.locationId);
      if (!locEntry) continue; // Não vinculado a este local
      
      if (demand.eligibleBrokerIds.includes(brokerId)) {
        locEntry.eligible.push({
          dateStr: demand.dateStr,
          shift: demand.shift,
          dayOfWeek: demand.dayOfWeek
        });
      } else {
        // Buscar motivo da exclusão no mapa de exclusões
        const exclEntry = eligibilityExclusionMap.get(brokerId);
        const detail = exclEntry?.details.find(d => 
          d.locationName === demand.locationName && d.dateStr === demand.dateStr && d.shift === demand.shift
        );
        locEntry.excluded.push({
          dateStr: demand.dateStr,
          shift: demand.shift,
          dayOfWeek: demand.dayOfWeek,
          reason: detail?.reason || "Sem disponibilidade para este dia/turno"
        });
      }
    }
  }

  // Log de exclusões de elegibilidade
  const brokersWithExclusions = Array.from(eligibilityExclusionMap.values()).filter(e => e.excluded > 0);
  if (brokersWithExclusions.length > 0) {
    console.log(`\n🔍 ELEGIBILIDADE: ${brokersWithExclusions.length} corretores com exclusões`);
    for (const entry of brokersWithExclusions.sort((a, b) => b.excluded - a.excluded).slice(0, 10)) {
      console.log(`   ${entry.brokerName}: ${entry.eligible}/${entry.totalDemands} elegível, ${entry.excluded} excluído`);
      for (const [reason, count] of Object.entries(entry.byReason).sort((a, b) => b[1] - a[1])) {
        console.log(`      → ${reason}: ${count}x`);
      }
    }
  }

  // Validação pré-geração
  const impossibleDemands = allExternalDemands.filter(d => d.eligibleBrokerIds.length === 0);
  if (impossibleDemands.length > 0) {
    console.error(`\n🚨 ALERTA: ${impossibleDemands.length} DEMANDAS SEM CORRETORES CONFIGURADOS!`);
  }

  const possibleDemands = allExternalDemands.filter(d => d.eligibleBrokerIds.length > 0);
  console.log(`✅ ${possibleDemands.length} demandas externas possíveis de alocar`);

  // Usar filas de rotação
  const locationRotationQueues = accumulator.locationRotationQueues || new Map<string, LocationRotationQueueItem[]>();

  // Análise de gargalos
  const { analyses: bottleneckAnalyses, reservations: mandatoryReservations } = analyzeBottlenecks(
    possibleDemands,
    brokerQueue,
    accumulator.lastWeekExternals || []
  );

  // ═══════════════════════════════════════════════════════════
  // NOVA ORDENAÇÃO: Sábados/Domingos primeiro, depois por dia sequencial
  // ═══════════════════════════════════════════════════════════
  console.log("\n📊 ETAPA 4: ORDENANDO POR DIA (Sáb/Dom primeiro, depois Seg→Sex)...");

  possibleDemands.sort((a, b) => {
    // ═══════════════════════════════════════════════════════════
    // PRIORIDADE 1: SÁBADO PRIMEIRO (para popular saturdayExternalWorkers antes)
    // Isso permite aplicar a regra de 1 externo máximo para corretores de sábado
    // ═══════════════════════════════════════════════════════════
    const getWeekendPriority = (dayOfWeek: string): number => {
      if (dayOfWeek === "saturday") return 0; // Sábado PRIMEIRO
      if (dayOfWeek === "sunday") return 1;   // Domingo segundo
      return 2;                                // Outros depois
    };
    
    const aWeekendPrio = getWeekendPriority(a.dayOfWeek);
    const bWeekendPrio = getWeekendPriority(b.dayOfWeek);
    if (aWeekendPrio !== bWeekendPrio) return aWeekendPrio - bWeekendPrio;
    
    // PRIORIDADE 2: DEMANDAS COM MENOS CORRETORES ELEGÍVEIS PRIMEIRO (dentro do mesmo grupo de dias)
    const eligibleDiff = a.eligibleBrokerIds.length - b.eligibleBrokerIds.length;
    if (eligibleDiff !== 0) return eligibleDiff;
    
    // PRIORIDADE 3: Data cronológica
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    
    // PRIORIDADE 4: Manhã antes de tarde
    const shiftOrder: Record<string, number> = { morning: 1, afternoon: 2 };
    return (shiftOrder[a.shift] || 0) - (shiftOrder[b.shift] || 0);
  });
  
  // Variação com seed - manter sábado primeiro!
  if (attemptSeed > 1) {
    const saturdayDemands = possibleDemands.filter(d => d.dayOfWeek === "saturday");
    const sundayDemands = possibleDemands.filter(d => d.dayOfWeek === "sunday");
    const otherDemands = possibleDemands.filter(d => d.dayOfWeek !== "saturday" && d.dayOfWeek !== "sunday");
    
    const shuffledSaturday = shuffleWithSeed(saturdayDemands, attemptSeed * 1000);
    const shuffledSunday = shuffleWithSeed(sundayDemands, attemptSeed * 2000);
    const shuffledOther = shuffleWithSeed(otherDemands, attemptSeed * 3000);
    
    possibleDemands.length = 0;
    possibleDemands.push(...shuffledSaturday, ...shuffledSunday, ...shuffledOther);
  }

  // Contexto de alocação
  const saturdayExternalWorkers = new Set<string>();
  const context: AllocationContext = {
    assignments,
    brokerQueue,
    externalShiftTargets,
    dailyExternalAssignments,
    weekendExternalAssignments,
    externalLocations: externalLocations || [],
    saturdayBessaExternalCount: new Map<string, number>(),
    lastWeekExternals: accumulator.lastWeekExternals || [],
    allocatedExternalDays: new Map<string, Set<string>>(),
    mandatoryReservations,
    saturdayInternalWorkers,
    saturdayExternalWorkers,
    locationRotationQueues,
    locationAllocationsForQueueUpdate: [],
    internalLocationIds: internalLocIds,
    dailyBessaExternalCount: new Map<string, number>(),
    // NOVOS: Contadores mensais para balanceamento de domingo
    monthSundayCount: accumulator.monthSundayCount || {},
    monthSundayAtLocation: accumulator.monthSundayAtLocation || {}
  };

  // Passes de alocação
  console.log("\n🎯 ETAPA 5: ALOCAÇÃO COM PASSES PROGRESSIVOS...");

  const bessaBrokersAvailableSaturday = brokerQueue.filter(b => 
    b.internalLocation === "bessa" && b.availableWeekdays.includes("saturday")
  ).length;

  const allocatedDemands = new Set<string>();
  let allocatedPass1 = 0, allocatedPass2 = 0, allocatedPass3 = 0, allocatedPass4 = 0, allocatedPass5 = 0;
  const relaxedAllocations: { demand: string; pass: number; reason: string }[] = [];
  
  // ═══════════════════════════════════════════════════════════
  // DECISION TRACE: Captura em tempo real de cada decisão de alocação
  // ═══════════════════════════════════════════════════════════
  const decisionTrace: DecisionTraceEntry[] = [];
  
  // ═══════════════════════════════════════════════════════════
  // RASTREIO FORENSE: Competição para corretores sub-alocados
  // Para cada demanda, registra o que aconteceu com cada corretor elegível
  // ═══════════════════════════════════════════════════════════
  const competitionLog: Map<string, CompetitionTraceEntry[]> = new Map();

  // Pass 1-5: Alocação normal
  for (let pass = 1; pass <= 5; pass++) {
    for (const demand of possibleDemands) {
      const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
      if (allocatedDemands.has(demandKey)) continue;

      // Coletar blockedBrokers em TODOS os passes para trace real
      const result = findBrokerForDemand(demand, context, pass, bessaBrokersAvailableSaturday, true, attemptSeed);
      
      // Registrar trace da decisão
      const traceEntry: DecisionTraceEntry = {
        demandKey,
        locationName: demand.locationName,
        dateStr: demand.dateStr,
        shift: demand.shift,
        pass,
        eligibleCount: demand.eligibleBrokerIds.length,
        rejections: (result.blockedBrokers || []).map(bb => ({
          brokerId: bb.brokerId,
          brokerName: bb.brokerName,
          rule: bb.rule,
          reason: bb.reason,
          externalShiftCount: context.brokerQueue.find(b => b.brokerId === bb.brokerId)?.externalShiftCount || 0,
          rule8Relaxed: false
        })),
        allocated: !!result.broker,
        allocatedBrokerName: result.broker?.brokerName
      };
      
      // Só guardar trace da última tentativa (pass mais alto sem alocação, ou o pass que alocou)
      if (result.broker || pass === 5) {
        decisionTrace.push(traceEntry);
      }
      
      // ═══════════════════════════════════════════════════════════
      // RASTREIO FORENSE: Para cada corretor elegível nesta demanda,
      // registrar se ganhou, perdeu por competição, ou foi bloqueado
      // ═══════════════════════════════════════════════════════════
      if (result.broker || pass === 5) {
        const blockedBrokerIds = new Set((result.blockedBrokers || []).map(bb => bb.brokerId));
        
        for (const eligibleBrokerId of demand.eligibleBrokerIds) {
          const brokerInQueue = context.brokerQueue.find(b => b.brokerId === eligibleBrokerId);
          if (!brokerInQueue) continue;
          
          // Determinar posição na fila (baseado na ordenação que findBrokerForDemand usaria)
          const eligibleInQueue = context.brokerQueue
            .filter(b => demand.eligibleBrokerIds.includes(b.brokerId))
            .sort((a, b) => a.externalShiftCount - b.externalShiftCount);
          const sortPosition = eligibleInQueue.findIndex(b => b.brokerId === eligibleBrokerId) + 1;
          
          let outcome: CompetitionTraceEntry["outcome"];
          let blockRule: string | undefined;
          let blockReason: string | undefined;
          
          if (result.broker?.brokerId === eligibleBrokerId) {
            outcome = "allocated";
          } else if (blockedBrokerIds.has(eligibleBrokerId)) {
            outcome = "rule_blocked";
            const blockInfo = (result.blockedBrokers || []).find(bb => bb.brokerId === eligibleBrokerId);
            blockRule = blockInfo?.rule;
            blockReason = blockInfo?.reason;
          } else if (!result.broker) {
            outcome = "demand_unallocated";
          } else {
            outcome = "outcompeted";
          }
          
          const entry: CompetitionTraceEntry = {
            demandKey,
            locationName: demand.locationName,
            dateStr: demand.dateStr,
            shift: demand.shift,
            pass,
            outcome,
            sortPosition,
            totalInQueue: eligibleInQueue.length,
            selectedBrokerName: result.broker && result.broker.brokerId !== eligibleBrokerId ? result.broker.brokerName : undefined,
            blockRule,
            blockReason,
            externalCountAtTime: brokerInQueue.externalShiftCount,
            isSaturdayInternalWorker: context.saturdayInternalWorkers?.has(eligibleBrokerId) || false,
          };
          
          if (!competitionLog.has(eligibleBrokerId)) {
            competitionLog.set(eligibleBrokerId, []);
          }
          competitionLog.get(eligibleBrokerId)!.push(entry);
        }
      }
      
      if (result.broker) {
        allocateDemand(demand, result.broker, context);
        allocatedDemands.add(demandKey);
        
        // ═══════════════════════════════════════════════════════════
        // ATUALIZAR saturdayExternalWorkers IMEDIATAMENTE ao alocar sábado
        // Isso permite que a regra de 1 externo seja aplicada corretamente
        // ═══════════════════════════════════════════════════════════
        if (demand.dayOfWeek === "saturday") {
          context.saturdayExternalWorkers.add(result.broker.brokerId);
          console.log(`   📌 ${result.broker.brokerName} marcado para sábado externo → limite 2 externos`);
          
          if (result.broker.internalLocation === "bessa") {
            context.saturdayBessaExternalCount.set(demand.dateStr, 
              (context.saturdayBessaExternalCount.get(demand.dateStr) || 0) + 1
            );
          }
        }
        
        switch (pass) {
          case 1: allocatedPass1++; break;
          case 2: allocatedPass2++; break;
          case 3: allocatedPass3++; break;
          case 4: allocatedPass4++; break;
          case 5: allocatedPass5++; break;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.6: REBALANCEAMENTO "2 ANTES DO 3" - GATE GLOBAL
  // Se alguém está com 0-1 externos e pode receber mais,
  // tentar trocar um 3º externo de quem tem 3 para dar a quem tem 0-1
  // ═══════════════════════════════════════════════════════════
  console.log("\n⚖️ ETAPA 8.6: REBALANCEAMENTO DE DISTRIBUIÇÃO (2 antes do 3)...");
  
  const unallocatedAfterPasses = possibleDemands.filter(d => 
    !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
  );
  
  // Identificar corretores com menos de 2 externos que ainda podem receber
  const brokersUnderTwo = context.brokerQueue.filter(b => b.externalShiftCount < 2);
  const brokersWithThree = context.brokerQueue.filter(b => b.externalShiftCount >= 3);
  
  console.log(`   📊 Corretores com <2 externos: ${brokersUnderTwo.length}`);
  console.log(`   📊 Corretores com 3 externos: ${brokersWithThree.length}`);
  
  if (brokersUnderTwo.length > 0 && (brokersWithThree.length > 0 || unallocatedAfterPasses.length > 0)) {
    console.log(`\n   🔄 Tentando rebalancear...`);
    
    let rebalanceCount = 0;
    
    for (const underBroker of brokersUnderTwo) {
      if (underBroker.externalShiftCount >= 2) continue; // Já chegou a 2
      
      // Encontrar demanda não alocada onde este corretor é elegível
      for (const demand of unallocatedAfterPasses) {
        const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
        if (allocatedDemands.has(demandKey)) continue;
        if (!demand.eligibleBrokerIds.includes(underBroker.brokerId)) continue;
        
        // Verificar se pode receber esta demanda
        const check = checkTrulyInviolableRulesWithRelaxation(underBroker, demand, context, true);
        if (!check.allowed) continue;
        
        // Verificar regras absolutas (Regra 4: conflito local externo, Regra 5: mesmo local, etc.)
        const absCheck = checkAbsoluteRules(underBroker, demand, context, 5);
        if (!absCheck.allowed) {
          console.log(`   ⛔ REBALANCEAMENTO: ${underBroker.brokerName} bloqueado: ${absCheck.reason}`);
          continue;
        }
        
        // ALOCAR!
        allocateDemand(demand, underBroker, context);
        allocatedDemands.add(demandKey);
        rebalanceCount++;
        console.log(`   ✅ REBALANCEADO: ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${underBroker.brokerName} (agora tem ${underBroker.externalShiftCount} externos)`);
        
        if (underBroker.externalShiftCount >= 2) break; // Chegou a 2
      }
    }
    
    console.log(`   📊 Rebalanceamento: ${rebalanceCount} alocações adicionais`);
  }
  
  // Verificar distribuição final após rebalanceamento
  const distributionCheck = {
    with0: context.brokerQueue.filter(b => b.externalShiftCount === 0).length,
    with1: context.brokerQueue.filter(b => b.externalShiftCount === 1).length,
    with2: context.brokerQueue.filter(b => b.externalShiftCount === 2).length,
    with3: context.brokerQueue.filter(b => b.externalShiftCount >= 3).length,
  };
  
  console.log(`\n   📊 DISTRIBUIÇÃO APÓS REBALANCEAMENTO:`);
  console.log(`      0 externos: ${distributionCheck.with0} corretores`);
  console.log(`      1 externo:  ${distributionCheck.with1} corretores`);
  console.log(`      2 externos: ${distributionCheck.with2} corretores`);
  console.log(`      3+ externos: ${distributionCheck.with3} corretores`);
  
  // Listar quem está com <2 para diagnóstico
  if (distributionCheck.with0 + distributionCheck.with1 > 0) {
    console.log(`\n   ⚠️ Corretores com menos de 2 externos:`);
    for (const broker of context.brokerQueue.filter(b => b.externalShiftCount < 2)) {
      console.log(`      - ${broker.brokerName}: ${broker.externalShiftCount} externos (${broker.externalLocationCount} locais configurados)`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.7: RESGATE BROKER-FIRST — PASSADA EXTRA PARA SUB-ALOCADOS
  // Diferente da 8.6: itera CORRETORES primeiro, depois demandas
  // Ordena demandas por ESCASSEZ (menos elegíveis = mais urgente)
  // Aplica regras mínimas para maximizar chance de alocação
  // ═══════════════════════════════════════════════════════════
  const unallocatedAfterRebalance = possibleDemands.filter(d => 
    !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
  );
  
  const brokersStillUnderTarget = context.brokerQueue
    .filter(b => b.externalShiftCount < b.targetExternals && b.externalShiftCount < MAX_EXTERNAL_SHIFTS_PER_WEEK)
    .sort((a, b) => {
      // Priorizar quem tem MENOS externos primeiro
      if (a.externalShiftCount !== b.externalShiftCount) return a.externalShiftCount - b.externalShiftCount;
      // Depois quem tem MENOS locais configurados (menos oportunidades)
      return a.externalLocationCount - b.externalLocationCount;
    });
  
  if (brokersStillUnderTarget.length > 0 && unallocatedAfterRebalance.length > 0) {
    console.log(`\n🚀 ETAPA 8.7: RESGATE BROKER-FIRST — ${brokersStillUnderTarget.length} corretores sub-alocados, ${unallocatedAfterRebalance.length} demandas disponíveis`);
    
    let rescueCount = 0;
    
    for (const underBroker of brokersStillUnderTarget) {
      if (underBroker.externalShiftCount >= underBroker.targetExternals) continue;
      if (underBroker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_PER_WEEK) continue;
      
      // Ordenar demandas não alocadas por ESCASSEZ (menos elegíveis primeiro)
      // Isso garante que as demandas mais difíceis sejam preenchidas antes
      const demandsByScarcity = [...unallocatedAfterRebalance]
        .filter(d => {
          const dk = `${d.locationId}-${d.dateStr}-${d.shift}`;
          return !allocatedDemands.has(dk) && d.eligibleBrokerIds.includes(underBroker.brokerId);
        })
        .sort((a, b) => a.eligibleBrokerIds.length - b.eligibleBrokerIds.length);
      
      for (const demand of demandsByScarcity) {
        const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
        if (allocatedDemands.has(demandKey)) continue;
        if (underBroker.externalShiftCount >= underBroker.targetExternals) break;
        
        // Verificar dia disponível
        if (!underBroker.availableWeekdays.includes(demand.dayOfWeek)) continue;
        
        // Verificar regras invioláveis (com Regra 8 relaxada para <2 externos)
        const check = checkTrulyInviolableRulesWithRelaxation(underBroker, demand, context, underBroker.externalShiftCount < 2);
        if (!check.allowed) {
          console.log(`   ⛔ RESGATE: ${underBroker.brokerName} bloqueado para ${demand.locationName} ${demand.dateStr} ${demand.shift}: ${check.reason}`);
          continue;
        }
        
        // Verificar regras absolutas com pass alto para relaxar o máximo possível
        const absCheck = checkAbsoluteRules(underBroker, demand, context, 5);
        if (!absCheck.allowed) {
          console.log(`   ⛔ RESGATE ABS: ${underBroker.brokerName} bloqueado: ${absCheck.reason}`);
          continue;
        }
        
        // ALOCAR!
        allocateDemand(demand, underBroker, context);
        allocatedDemands.add(demandKey);
        rescueCount++;
        console.log(`   ✅ RESGATE: ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${underBroker.brokerName} (agora tem ${underBroker.externalShiftCount} externos, escassez: ${demand.eligibleBrokerIds.length} elegíveis)`);
      }
    }
    
    if (rescueCount > 0) {
      console.log(`   📊 Resgate broker-first: ${rescueCount} alocações adicionais`);
    } else {
      console.log(`   📊 Resgate broker-first: nenhuma alocação possível`);
      // Log detalhado de por que não foi possível
      for (const underBroker of brokersStillUnderTarget.slice(0, 5)) {
        if (underBroker.externalShiftCount >= underBroker.targetExternals) continue;
        const eligibleDemands = unallocatedAfterRebalance.filter(d => 
          !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`) && 
          d.eligibleBrokerIds.includes(underBroker.brokerId)
        );
        if (eligibleDemands.length === 0) {
          console.log(`   📋 ${underBroker.brokerName}: NENHUMA demanda não-alocada onde é elegível`);
        } else {
          console.log(`   📋 ${underBroker.brokerName}: ${eligibleDemands.length} demandas não-alocadas elegíveis mas bloqueado por regras`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.8: DESCONSECUTIVAR (antes do último recurso)
  // ═══════════════════════════════════════════════════════════
  const deConsecutiveResult = deConsecutivizeExternals(context, possibleDemands, internalLocIds);

  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.8.1: REBALANCEAMENTO ATIVO POR SWAP (Chain Swap)
  // Identifica corretores com 3+ externos e tenta trocar com quem tem <2
  // ═══════════════════════════════════════════════════════════
  console.log("\n🔄 ETAPA 8.8.1: REBALANCEAMENTO ATIVO POR SWAP...");
  
  const overloadedBrokers = context.brokerQueue.filter(b => b.externalShiftCount >= 3);
  const underloadedBrokers = context.brokerQueue.filter(b => b.externalShiftCount < 2);
  
  console.log(`   📊 Corretores sobrecarregados (3+): ${overloadedBrokers.length}`);
  console.log(`   📊 Corretores sub-alocados (<2): ${underloadedBrokers.length}`);
  
  let swapCount = 0;
  
  if (overloadedBrokers.length > 0 && underloadedBrokers.length > 0) {
    for (const overBroker of overloadedBrokers) {
      if (overBroker.externalShiftCount <= 2) continue; // Already balanced
      
      // Find assignments belonging to this overloaded broker
      const overBrokerAssignments = context.assignments.filter(a => 
        a.broker_id === overBroker.brokerId && 
        !context.internalLocationIds.has(a.location_id)
      );
      
      for (const assignment of overBrokerAssignments) {
        if (overBroker.externalShiftCount <= 2) break; // Balanced now
        
        // Find an underloaded broker who can take this assignment
        for (const underBroker of underloadedBrokers) {
          if (underBroker.externalShiftCount >= 2) continue; // Already reached 2
          
          // Build a pseudo-demand to check eligibility
          const demandForCheck = possibleDemands.find(d => 
            d.locationId === assignment.location_id && 
            d.dateStr === assignment.assignment_date && 
            d.shift === assignment.shift_type
          );
          
          if (!demandForCheck) continue;
          if (!demandForCheck.eligibleBrokerIds.includes(underBroker.brokerId)) continue;
          
          // Check inviolable rules for the underloaded broker
          const check = checkTrulyInviolableRulesWithRelaxation(underBroker, demandForCheck, context, true);
          if (!check.allowed) continue;
          
          // Verificar regras absolutas (Regra 4, 5, construtora, etc.)
          const absCheck = checkAbsoluteRules(underBroker, demandForCheck, context, 5);
          if (!absCheck.allowed) {
            console.log(`   ⛔ CHAIN SWAP: ${underBroker.brokerName} bloqueado: ${absCheck.reason}`);
            continue;
          }
          
          // Check the underloaded broker doesn't already have an external on this day
          const underBrokerHasExternalOnDay = context.assignments.some(a => 
            a.broker_id === underBroker.brokerId && 
            a.assignment_date === assignment.assignment_date &&
            !context.internalLocationIds.has(a.location_id)
          );
          if (underBrokerHasExternalOnDay) continue;
          
          // ═══ EXECUTE SWAP ═══
          // Remove assignment from overloaded broker
          const assignmentIdx = context.assignments.indexOf(assignment);
          if (assignmentIdx === -1) continue;
          
          context.assignments.splice(assignmentIdx, 1);
          overBroker.externalShiftCount--;
          overBroker.externalCredit++;
          
          // Remove from dailyExternalAssignments
          const daySet = context.dailyExternalAssignments.get(assignment.assignment_date);
          if (daySet) daySet.delete(overBroker.brokerId);
          
          // Allocate to underloaded broker
          allocateDemand(demandForCheck, underBroker, context);
          
          swapCount++;
          console.log(`   ✅ SWAP: ${demandForCheck.locationName} ${demandForCheck.dateStr} ${demandForCheck.shift}: ${overBroker.brokerName} (${overBroker.externalShiftCount + 1}→${overBroker.externalShiftCount}) → ${underBroker.brokerName} (${underBroker.externalShiftCount - 1}→${underBroker.externalShiftCount})`);
          break; // Move to next assignment of overloaded broker
        }
      }
    }
  }
  
  console.log(`   📊 Chain Swap: ${swapCount} trocas realizadas`);
  
  // Log final distribution after swap
  const postSwapDist = {
    with0: context.brokerQueue.filter(b => b.externalShiftCount === 0).length,
    with1: context.brokerQueue.filter(b => b.externalShiftCount === 1).length,
    with2: context.brokerQueue.filter(b => b.externalShiftCount === 2).length,
    with3: context.brokerQueue.filter(b => b.externalShiftCount >= 3).length,
  };
  console.log(`\n   📊 DISTRIBUIÇÃO APÓS CHAIN SWAP:`);
  console.log(`      0 externos: ${postSwapDist.with0} corretores`);
  console.log(`      1 externo:  ${postSwapDist.with1} corretores`);
  console.log(`      2 externos: ${postSwapDist.with2} corretores`);
  console.log(`      3+ externos: ${postSwapDist.with3} corretores`);
  
  if (postSwapDist.with0 + postSwapDist.with1 > 0 && postSwapDist.with3 > 0) {
    console.log(`\n   ⚠️ ALERTA: Desequilíbrio residual - ${postSwapDist.with3} corretor(es) com 3+ enquanto ${postSwapDist.with0 + postSwapDist.with1} têm <2`);
  }
  
  // WARNING: Listar Saturday internal workers com 3+ externos (compensação ativada)
  for (const broker of context.brokerQueue) {
    if (context.saturdayInternalWorkers?.has(broker.brokerId) && broker.externalShiftCount >= 3) {
      console.log(`   ⚠️ WARNING: ${broker.brokerName} recebeu ${broker.externalShiftCount} externos (compensação por sábado interno)`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.9: ALOCAÇÃO DE PLANTÕES INTERNOS (SÁBADO)
  // Corretores pré-identificados em saturdayInternalWorkers
  // ═══════════════════════════════════════════════════════════
  console.log("\n🏢 ETAPA 8.9: ALOCANDO PLANTÕES INTERNOS DE SÁBADO...");
  
  if (saturdayDate && internalLocationsData && internalLocationsData.length > 0) {
    const saturdayDateStr = format(saturdayDate, "yyyy-MM-dd");
    
    // DEBUG: Mostrar estado atual das filas de sábado
    console.log(`   📋 Fila Tambaú: ${accumulator.saturdayQueue.length} corretores`);
    console.log(`   📋 Fila Bessa: ${accumulator.bessaSaturdayQueue.length} corretores`);
    
    for (const internalLocation of internalLocationsData) {
      const locationName = internalLocation.name?.toLowerCase() || "";
      const isTambau = locationName.includes("tambaú") || locationName.includes("tambau");
      const isBessa = locationName.includes("bessa");
      
      console.log(`\n   🏢 Processando ${internalLocation.name} (isTambau=${isTambau}, isBessa=${isBessa})...`);
      
      // Encontrar período ativo
      const activePeriod = internalLocation.location_periods?.find(
        (p: any) => new Date(p.start_date + "T00:00:00") <= saturdayDate! && 
                    new Date(p.end_date + "T00:00:00") >= saturdayDate!
      );
      
      if (!activePeriod) {
        console.log(`   ❌ Nenhum período ativo para ${saturdayDateStr}`);
        continue;
      }
      
      // ── VERIFICAR DATAS EXCLUÍDAS (internos sábado) ──────────────
      if (isDayFullyExcluded(activePeriod.id, saturdayDateStr)) {
        console.log(`   🚫 ${internalLocation.name}: data ${saturdayDateStr} excluída inteiramente — pulando`);
        continue;
      }

      // Verificar configuração de sábado
      const saturdayConfig = activePeriod.period_day_configs?.find(
        (dc: any) => dc.weekday === "saturday"
      );
      
      if (!saturdayConfig) {
        console.log(`   ❌ Nenhuma configuração de sábado encontrada`);
        continue;
      }
      
      // ═══════════════════════════════════════════════════════════
      // CORREÇÃO: Limites diferenciados por local
      // Tambaú: mín 2 / máx 3 (mais corretores disponíveis)
      // Bessa: mín 1 / máx 2 (poucos corretores disponíveis)
      // ═══════════════════════════════════════════════════════════
      const configuredMax = saturdayConfig.max_brokers_count || 2;
      const minBrokers = isTambau ? 2 : 1;
      const maxBrokers = isTambau ? Math.max(configuredMax, 3) : Math.max(configuredMax, 2);
      
      // Aplicar exclusão de turno parcial no sábado
      let hasMorning = saturdayConfig.has_morning !== false;
      let hasAfternoon = saturdayConfig.has_afternoon !== false;
      if (isShiftExcluded(activePeriod.id, saturdayDateStr, "morning")) {
        hasMorning = false;
        console.log(`   🚫 ${internalLocation.name}: turno manhã excluído em ${saturdayDateStr}`);
      }
      if (isShiftExcluded(activePeriod.id, saturdayDateStr, "afternoon")) {
        hasAfternoon = false;
        console.log(`   🚫 ${internalLocation.name}: turno tarde excluído em ${saturdayDateStr}`);
      }
      if (!hasMorning && !hasAfternoon) {
        console.log(`   🚫 ${internalLocation.name}: ambos os turnos excluídos em ${saturdayDateStr} — pulando`);
        continue;
      }
      
      console.log(`   📊 Config: ${isTambau ? 'TAMBAÚ' : 'BESSA'} min=${minBrokers}, max=${maxBrokers}, hasMorning=${hasMorning}, hasAfternoon=${hasAfternoon}`);
      
      // Corretores já alocados neste local neste dia
      const alreadyAllocated = assignments.filter(
        a => a.location_id === internalLocation.id && a.assignment_date === saturdayDateStr
      );
      const alreadyAllocatedBrokerIds = new Set(alreadyAllocated.map(a => a.broker_id));
      
      // Corretores do local
      const locationBrokers = internalLocation.location_brokers || [];
      const locationBrokerIds = new Set(locationBrokers.map((lb: any) => lb.broker_id));
      
      // ═══════════════════════════════════════════════════════════
      // NOVO: Identificar locais externos para verificar conflito
      // Usamos internalLocIds (já definido) para detectar externos
      // ═══════════════════════════════════════════════════════════
      const isExternalLocation = (locId: string) => !internalLocIds.has(locId);
      
      console.log(`   👥 Corretores já alocados neste local: ${alreadyAllocated.length}`);
      console.log(`   👥 Corretores configurados para este local: ${locationBrokerIds.size}`);
      
      // Selecionar corretores da fila
      const queueToUse = isTambau ? accumulator.saturdayQueue : accumulator.bessaSaturdayQueue;
      console.log(`   📋 Fila selecionada: ${queueToUse.length} corretores`);
      
      // Função para verificar elegibilidade
      const isEligibleForSaturdayInternal = (brokerId: string): { eligible: boolean; reason?: string } => {
        // ═══════════════════════════════════════════════════════════
        // CORREÇÃO: Verificar disponibilidade GLOBAL do corretor
        // A fila de sábado só verifica vínculo local, mas o corretor
        // pode não ter sábado na disponibilidade global
        // ═══════════════════════════════════════════════════════════
        const brokerFromQueue = brokerQueue.find(b => b.brokerId === brokerId);
        if (brokerFromQueue && !brokerFromQueue.availableWeekdays.includes("saturday")) {
          return { eligible: false, reason: 'sem sábado na disponibilidade global' };
        }
        
        // Verificar se já foi alocado no sábado (neste local)
        if (alreadyAllocatedBrokerIds.has(brokerId)) {
          return { eligible: false, reason: 'já alocado neste local' };
        }
        
        // Verificar se já tem algo no domingo (conflito de fim de semana - Regra 9)
        const sundayStr = format(addDays(saturdayDate!, 1), "yyyy-MM-dd");
        const hasSundayAssignment = assignments.some(
          a => a.broker_id === brokerId && a.assignment_date === sundayStr
        );
        if (hasSundayAssignment) {
          return { eligible: false, reason: 'conflito domingo (Regra 9)' };
        }
        
        // ═══════════════════════════════════════════════════════════
        // CORREÇÃO CRÍTICA: Verificar se já tem EXTERNO no mesmo sábado
        // Corretor com externo no sábado NÃO deve ser alocado no interno
        // (pois operacionalmente prioriza o externo e não comparece ao interno)
        // ═══════════════════════════════════════════════════════════
        const hasExternalOnSaturday = assignments.some(
          a => a.broker_id === brokerId && 
               a.assignment_date === saturdayDateStr && 
               isExternalLocation(a.location_id)
        );
        if (hasExternalOnSaturday) {
          return { eligible: false, reason: 'já tem externo no sábado' };
        }
        
        return { eligible: true };
      };
      
      // Filtrar elegíveis que não estão bloqueados por conflito de fim de semana
      const eligibleFromQueue = queueToUse.filter(queueItem => {
        const result = isEligibleForSaturdayInternal(queueItem.broker_id);
        if (!result.eligible) {
          console.log(`   ⚠️ ${queueItem.broker_name}: bloqueado (${result.reason})`);
        }
        return result.eligible;
      });
      
      console.log(`   ✅ Elegíveis da fila: ${eligibleFromQueue.length}/${queueToUse.length}`);
      
      // ═══════════════════════════════════════════════════════════
      // CORREÇÃO BALANCEAMENTO DE SÁBADOS: Ordenar por MENOS sábados trabalhados
      // Isso garante que quem trabalhou menos sábados seja priorizado
      // ═══════════════════════════════════════════════════════════
      const sortedEligible = [...eligibleFromQueue].sort((a, b) => {
        // PRIORIDADE 1: Quem trabalhou MENOS sábados primeiro
        const timesA = a.times_worked || 0;
        const timesB = b.times_worked || 0;
        if (timesA !== timesB) return timesA - timesB;
        
        // PRIORIDADE 2: Posição na fila (menor = há mais tempo sem trabalhar)
        return (a.queue_position || 999) - (b.queue_position || 999);
      });
      
      console.log(`   📋 Ordenação por sábados trabalhados:`);
      for (const item of sortedEligible.slice(0, 5)) {
        console.log(`      ${item.broker_name}: ${item.times_worked || 0} sábados, pos ${item.queue_position}`);
      }
      
      // CORREÇÃO: Se a fila não tem corretores suficientes, buscar do pool geral
      let brokersToAllocate = sortedEligible.slice(0, maxBrokers);
      
      if (brokersToAllocate.length < maxBrokers) {
        console.log(`   ⚠️ Fila tem apenas ${brokersToAllocate.length}/${maxBrokers} - buscando corretores adicionais do pool geral...`);
        
        const alreadySelectedIds = new Set(brokersToAllocate.map(q => q.broker_id));
        
        // Buscar do pool geral de corretores configurados para este local
        const additionalBrokers = brokerQueue
          .filter(broker => {
            // Deve estar configurado para este local interno
            if (!locationBrokerIds.has(broker.brokerId)) return false;
            // Não deve já ter sido selecionado
            if (alreadySelectedIds.has(broker.brokerId)) return false;
            // Deve estar disponível no sábado
            if (!broker.availableWeekdays.includes("saturday")) return false;
            // Deve passar no teste de elegibilidade
            const eligibilityResult = isEligibleForSaturdayInternal(broker.brokerId);
            if (!eligibilityResult.eligible) {
              console.log(`   ⚠️ ${broker.brokerName} (pool): bloqueado (${eligibilityResult.reason})`);
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            // Priorizar por menos externos (não sobrecarregar)
            if (a.externalShiftCount !== b.externalShiftCount) {
              return a.externalShiftCount - b.externalShiftCount;
            }
            // Desempate por menos sábados recentes
            return a.recentSaturdayTotalCount - b.recentSaturdayTotalCount;
          });
        
        console.log(`   🔍 Candidatos do pool geral: ${additionalBrokers.length}`);
        
        // Adicionar corretores adicionais até completar maxBrokers
        for (const broker of additionalBrokers) {
          if (brokersToAllocate.length >= maxBrokers) break;
          brokersToAllocate.push({
            broker_id: broker.brokerId,
            broker_name: broker.brokerName,
            queue_position: 999, // Posição alta pois veio do pool
            times_worked: 0,
            last_saturday_date: null
          } as SaturdayQueueItem);
          console.log(`   ➕ ${broker.brokerName}: adicionado do pool geral`);
        }
      }
      
      console.log(`   📊 Total a alocar: ${brokersToAllocate.length}/${maxBrokers}`);
      
      for (const queueItem of brokersToAllocate) {
        if (hasMorning) {
          const morningAssignment: ScheduleAssignment = {
            broker_id: queueItem.broker_id,
            location_id: internalLocation.id,
            assignment_date: saturdayDateStr,
            shift_type: "morning",
            start_time: saturdayConfig.morning_start || "08:00",
            end_time: saturdayConfig.morning_end || "12:00"
          };
          assignments.push(morningAssignment);
          console.log(`   ✅ ${queueItem.broker_name} → ${internalLocation.name} sábado MANHÃ`);
        }
        
        if (hasAfternoon) {
          const afternoonAssignment: ScheduleAssignment = {
            broker_id: queueItem.broker_id,
            location_id: internalLocation.id,
            assignment_date: saturdayDateStr,
            shift_type: "afternoon",
            start_time: saturdayConfig.afternoon_start || "13:00",
            end_time: saturdayConfig.afternoon_end || "18:00"
          };
          assignments.push(afternoonAssignment);
          console.log(`   ✅ ${queueItem.broker_name} → ${internalLocation.name} sábado TARDE`);
        }
        
        // ═══════════════════════════════════════════════════════════
        // CORREÇÃO FIFO SÁBADO: Atualizar a fila após alocar
        // Mover o corretor para o FINAL da fila e incrementar times_worked
        // Isso garante rotação correta para as próximas semanas
        // ═══════════════════════════════════════════════════════════
        const queueIndex = queueToUse.findIndex(q => q.broker_id === queueItem.broker_id);
        if (queueIndex !== -1) {
          const item = queueToUse[queueIndex];
          item.times_worked = (item.times_worked || 0) + 1;
          item.last_saturday_date = saturdayDateStr;
          
          // Remover da posição atual e mover para o final
          queueToUse.splice(queueIndex, 1);
          queueToUse.push(item);
          
          // Recalcular posições
          queueToUse.forEach((q, idx) => {
            q.queue_position = idx + 1;
          });
          
          console.log(`   🔄 FIFO Sábado: ${queueItem.broker_name} → posição ${queueToUse.length} (${item.times_worked} sábados)`);
        }
      }
      
      // Verificar se atingiu o mínimo necessário
      if (brokersToAllocate.length < minBrokers) {
        console.log(`   🚨 ${internalLocation.name}: CRÍTICO - apenas ${brokersToAllocate.length}/${minBrokers} (MÍNIMO NÃO ATINGIDO!)`);
      } else if (brokersToAllocate.length < maxBrokers) {
        console.log(`   ⚠️ ${internalLocation.name}: ${brokersToAllocate.length}/${maxBrokers} corretores (abaixo do máximo, mas mínimo ${minBrokers} OK)`);
      } else {
        console.log(`   ✅ ${internalLocation.name}: ${brokersToAllocate.length}/${maxBrokers} corretores alocados com sucesso`);
      }
    }
  } else {
    console.log(`   ❌ Sem sábado na semana ou sem locais internos (saturdayDate=${saturdayDate}, internalLocations=${internalLocationsData?.length || 0})`);
  }

  // ETAPA 9: Último recurso
  const preLastResortUnallocated = possibleDemands.filter(d => {
    const demandKey = `${d.locationId}-${d.dateStr}-${d.shift}`;
    return !allocatedDemands.has(demandKey);
  });
  
  if (preLastResortUnallocated.length > 0) {
    console.log(`\n🚨 ETAPA 9: ${preLastResortUnallocated.length} demandas para alocação de emergência`);
    
    // ═══════════════════════════════════════════════════════════
    // GATE GLOBAL: Verificar se ALGUM corretor ainda pode chegar a 2
    // Se sim, NINGUÉM pode receber o 3º externo
    // ═══════════════════════════════════════════════════════════
    const stillPendingDemands = preLastResortUnallocated.filter(d => 
      !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
    );
    
    const globalGateCheck = canAnyoneStillReachTwo(stillPendingDemands, context);
    
    if (globalGateCheck.canReach) {
      console.log(`   🚫 GATE GLOBAL ATIVO: ${globalGateCheck.brokersUnderTwo.length} corretor(es) ainda pode(m) receber para chegar a 2:`);
      console.log(`      ${globalGateCheck.brokersUnderTwo.join(', ')}`);
      console.log(`   → NINGUÉM receberá 3º externo enquanto houver corretor elegível com <2`);
    } else {
      console.log(`   ✅ GATE GLOBAL LIBERADO: todos os corretores elegíveis já têm 2+ ou estão bloqueados`);
    }
    
    // PASSO 1: Primeiro, tentar alocar para quem tem menos de 2 externos
    console.log(`\n   📍 PASSO 1: Alocar para corretores com <2 externos`);
    for (const demand of preLastResortUnallocated) {
      const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
      if (allocatedDemands.has(demandKey)) continue;
      
      // Ordenar elegíveis por: menos externos primeiro
      const eligibleSorted = [...demand.eligibleBrokerIds].sort((a, b) => {
        const brokerA = context.brokerQueue.find(br => br.brokerId === a);
        const brokerB = context.brokerQueue.find(br => br.brokerId === b);
        const extCountA = brokerA?.externalShiftCount || 0;
        const extCountB = brokerB?.externalShiftCount || 0;
        return extCountA - extCountB;
      });
      
      for (const brokerId of eligibleSorted) {
        const broker = context.brokerQueue.find(b => b.brokerId === brokerId);
        if (!broker) continue;
        
        // Só aceitar corretor com menos de 2 neste passo
        if (broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) continue;
        
        // CORRIGIDO: true = relaxar Regra 8 (consecutivos) para corretores com <2 externos na etapa de emergência
        const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
        if (!check.allowed) continue;
        
        // Verificar regras absolutas (Regra 4, 5, etc.)
        const absCheck = checkAbsoluteRules(broker, demand, context, 5);
        if (!absCheck.allowed) {
          console.log(`   ⛔ ETAPA 9 PASSO 1: ${broker.brokerName} bloqueado para ${demand.locationName} ${demand.dateStr} ${demand.shift}: ${absCheck.reason}`);
          continue;
        }
        
        allocateDemand(demand, broker, context);
        allocatedDemands.add(demandKey);
        console.log(`   ✅ ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${broker.brokerName} (agora tem ${broker.externalShiftCount} externos)`);
        break;
      }
    }
    
    // PASSO 2: Se ainda houver demandas pendentes E o gate global liberou, permitir 3º externo
    const stillPendingAfterPass1 = preLastResortUnallocated.filter(d => 
      !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
    );
    
    if (stillPendingAfterPass1.length > 0) {
      // Recalcular gate global
      const gateCheckAfterPass1 = canAnyoneStillReachTwo(stillPendingAfterPass1, context);
      
      if (gateCheckAfterPass1.canReach) {
        console.log(`\n   🚫 GATE GLOBAL AINDA ATIVO: ${gateCheckAfterPass1.brokersUnderTwo.join(', ')} ainda podem receber`);
        console.log(`   → Tentando alocar para eles primeiro antes de permitir 3º externo`);
        
        // Última tentativa de alocar para quem tem <2 (relaxando Regra 8 se necessário)
        for (const demand of stillPendingAfterPass1) {
          const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
          if (allocatedDemands.has(demandKey)) continue;
          
          for (const brokerName of gateCheckAfterPass1.brokersUnderTwo) {
            const broker = context.brokerQueue.find(b => b.brokerName === brokerName);
            if (!broker || broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) continue;
            if (!demand.eligibleBrokerIds.includes(broker.brokerId)) continue;
            
            // Tentar com Regra 8 relaxada
            const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
            if (!check.allowed) continue;
            
            allocateDemand(demand, broker, context);
            allocatedDemands.add(demandKey);
            relaxedAllocations.push({ 
              demand: `${demand.locationName} ${demand.dateStr} ${demand.shift}`, 
              pass: 9, 
              reason: `REGRA 8 RELAXADA para ${broker.brokerName} atingir 2 externos` 
            });
            console.log(`   ⚠️ ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${broker.brokerName} (Regra 8 relaxada, agora tem ${broker.externalShiftCount})`);
            break;
          }
        }
      }
      
      // Recalcular novamente
      const stillPendingFinal = preLastResortUnallocated.filter(d => 
        !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
      );
      
      if (stillPendingFinal.length > 0) {
        const finalGateCheck = canAnyoneStillReachTwo(stillPendingFinal, context);
        
        // ═══════════════════════════════════════════════════════════
        // COMPENSAÇÃO DINÂMICA: Se ainda há demandas pendentes,
        // permitir 3º externo para quem trabalhou sábado (compensação)
        // ANTES de liberar gate geral
        // ═══════════════════════════════════════════════════════════
        if (finalGateCheck.canReach) {
          console.log(`\n   🔄 COMPENSAÇÃO DINÂMICA: Tentando alocar pendentes via corretores com compensação...`);
          for (const demand of stillPendingFinal) {
            const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
            if (allocatedDemands.has(demandKey)) continue;
            
            // Priorizar corretores com workedSaturdayLastWeek que ainda precisam de mais
            const compensationBrokers = context.brokerQueue
              .filter(b => {
                if (!demand.eligibleBrokerIds.includes(b.brokerId)) return false;
                if (b.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) return false;
                if (!b.workedSaturdayLastWeek && !context.saturdayInternalWorkers?.has(b.brokerId)) return false;
                return true;
              })
              .sort((a, b) => a.externalShiftCount - b.externalShiftCount);
            
            for (const broker of compensationBrokers) {
              const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
              if (!check.allowed) continue;
              
              allocateDemand(demand, broker, context);
              allocatedDemands.add(demandKey);
              relaxedAllocations.push({ 
                demand: `${demand.locationName} ${demand.dateStr} ${demand.shift}`, 
                pass: 9, 
                reason: `COMPENSAÇÃO DINÂMICA: ${broker.brokerName} (trabalhou sábado, Regra 8 relaxada)` 
              });
              console.log(`   ⚠️ COMPENSAÇÃO: ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${broker.brokerName} (agora tem ${broker.externalShiftCount})`);
              break;
            }
          }
        }
        
        // Recalcular pendentes após compensação dinâmica
        const stillPendingAfterCompensation = stillPendingFinal.filter(d => 
          !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
        );
        
        if (stillPendingAfterCompensation.length > 0) {
          const gateAfterCompensation = canAnyoneStillReachTwo(stillPendingAfterCompensation, context);
          
          if (!gateAfterCompensation.canReach) {
            console.log(`\n   ✅ GATE GLOBAL LIBERADO: permitindo 3º externo para demandas restantes`);
            
            // PASSO 3: Permitir 3º externo
            for (const demand of stillPendingAfterCompensation) {
              const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
              if (allocatedDemands.has(demandKey)) continue;
              
              const locationQueue = context.locationRotationQueues?.get(demand.locationId);
              
              const eligibleSorted = [...demand.eligibleBrokerIds].sort((a, b) => {
                const brokerA = context.brokerQueue.find(br => br.brokerId === a);
                const brokerB = context.brokerQueue.find(br => br.brokerId === b);
                const extCountA = brokerA?.externalShiftCount || 0;
                const extCountB = brokerB?.externalShiftCount || 0;
                
                if (extCountA !== extCountB) return extCountA - extCountB;
                
                // Priorizar quem tem compensação pendente
                const aHasCompensation = brokerA?.workedSaturdayLastWeek ? 1 : 0;
                const bHasCompensation = brokerB?.workedSaturdayLastWeek ? 1 : 0;
                if (aHasCompensation !== bHasCompensation) return bHasCompensation - aHasCompensation;
                
                if (locationQueue && locationQueue.length > 0) {
                  const posA = locationQueue.find(q => q.broker_id === a)?.queue_position ?? 999;
                  const posB = locationQueue.find(q => q.broker_id === b)?.queue_position ?? 999;
                  if (posA !== posB) return posA - posB;
                }
                
                const pairsA = countConsecutivePairsIfAllocated(a, demand.dateStr, context);
                const pairsB = countConsecutivePairsIfAllocated(b, demand.dateStr, context);
                return pairsA - pairsB;
              });
              
              for (const brokerId of eligibleSorted) {
                const broker = context.brokerQueue.find(b => b.brokerId === brokerId);
                if (!broker) continue;
                
                if (broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) {
                  console.log(`   ⛔ ${broker.brokerName}: HARD CAP (${broker.externalShiftCount} externos) - BLOQUEADO`);
                  continue;
                }
                
                const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
                if (!check.allowed) continue;
                
                const wasOverLimit = broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_PER_WEEK;
                allocateDemand(demand, broker, context);
                allocatedDemands.add(demandKey);
                
                if (wasOverLimit) {
                  relaxedAllocations.push({ 
                    demand: `${demand.locationName} ${demand.dateStr} ${demand.shift}`, 
                    pass: 9, 
                    reason: `3º EXTERNO: ${broker.brokerName} (gate global liberado${broker.workedSaturdayLastWeek ? ', compensação sábado' : ''})` 
                  });
                  console.log(`   🚨 ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${broker.brokerName} (3º externo, gate liberado)`);
                }
                break;
              }
            }
          } else {
            // ═══════════════════════════════════════════════════════════
            // GATE ATIVO MAS NINGUÉM UNDER-TWO CONSEGUE AS DEMANDAS PENDENTES
            // Tentativa real de alocação: se nenhum under-two consegue pegar
            // nenhuma das demandas restantes, forçar liberação do gate
            // ═══════════════════════════════════════════════════════════
            console.log(`\n   ⚠️ GATE ATIVO: ${gateAfterCompensation.brokersUnderTwo.join(', ')} supostamente podem receber`);
            console.log(`      Verificando elegibilidade REAL contra ${stillPendingAfterCompensation.length} demandas pendentes...`);
            
            let anyUnderTwoAllocated = false;
            
            // Tentar REALMENTE alocar under-two brokers para as demandas pendentes
            for (const demand of stillPendingAfterCompensation) {
              const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
              if (allocatedDemands.has(demandKey)) continue;
              
              for (const brokerName of gateAfterCompensation.brokersUnderTwo) {
                const broker = context.brokerQueue.find(b => b.brokerName === brokerName);
                if (!broker || broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_PER_WEEK) continue;
                if (!demand.eligibleBrokerIds.includes(broker.brokerId)) continue;
                
                // Verificar TODAS as regras reais (com relaxamento de Regra 8)
                const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
                if (!check.allowed) continue;
                
                // Este under-two PODE realmente pegar esta demanda
                allocateDemand(demand, broker, context);
                allocatedDemands.add(demandKey);
                anyUnderTwoAllocated = true;
                relaxedAllocations.push({ 
                  demand: `${demand.locationName} ${demand.dateStr} ${demand.shift}`, 
                  pass: 9, 
                  reason: `GATE FORÇADO: ${broker.brokerName} (under-two, Regra 8 relaxada)` 
                });
                console.log(`   ✅ GATE FORÇADO: ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${broker.brokerName}`);
                break;
              }
            }
            
            // Recalcular pendentes após tentativa real
            const stillPendingAfterForce = stillPendingAfterCompensation.filter(d => 
              !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
            );
            
            if (stillPendingAfterForce.length > 0) {
              // FORÇAR LIBERAÇÃO DO GATE — os under-two não conseguem pegar estas demandas
              console.log(`\n   🔓 GATE FORÇADO LIBERADO: ${stillPendingAfterForce.length} demandas restantes — under-two não conseguem pegá-las`);
              console.log(`   → Permitindo 3º externo para corretores com capacidade`);
              
              for (const demand of stillPendingAfterForce) {
                const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
                if (allocatedDemands.has(demandKey)) continue;
                
                const locationQueue = context.locationRotationQueues?.get(demand.locationId);
                
                const eligibleSorted = [...demand.eligibleBrokerIds].sort((a, b) => {
                  const brokerA = context.brokerQueue.find(br => br.brokerId === a);
                  const brokerB = context.brokerQueue.find(br => br.brokerId === b);
                  const extCountA = brokerA?.externalShiftCount || 0;
                  const extCountB = brokerB?.externalShiftCount || 0;
                  
                  if (extCountA !== extCountB) return extCountA - extCountB;
                  
                  const aHasCompensation = brokerA?.workedSaturdayLastWeek ? 1 : 0;
                  const bHasCompensation = brokerB?.workedSaturdayLastWeek ? 1 : 0;
                  if (aHasCompensation !== bHasCompensation) return bHasCompensation - aHasCompensation;
                  
                  if (locationQueue && locationQueue.length > 0) {
                    const posA = locationQueue.find(q => q.broker_id === a)?.queue_position ?? 999;
                    const posB = locationQueue.find(q => q.broker_id === b)?.queue_position ?? 999;
                    if (posA !== posB) return posA - posB;
                  }
                  
                  return 0;
                });
                
                for (const brokerId of eligibleSorted) {
                  const broker = context.brokerQueue.find(b => b.brokerId === brokerId);
                  if (!broker) continue;
                  
                  if (broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) continue;
                  
                  const check = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
                  if (!check.allowed) continue;
                  
                  const wasOverLimit = broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_PER_WEEK;
                  allocateDemand(demand, broker, context);
                  allocatedDemands.add(demandKey);
                  
                  if (wasOverLimit) {
                    relaxedAllocations.push({ 
                      demand: `${demand.locationName} ${demand.dateStr} ${demand.shift}`, 
                      pass: 9, 
                      reason: `3º EXTERNO (GATE FORÇADO): ${broker.brokerName}${broker.workedSaturdayLastWeek ? ' (compensação sábado)' : ''}` 
                    });
                  }
                  console.log(`   🚨 ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${broker.brokerName} (gate forçado, ${broker.externalShiftCount} ext)`);
                  break;
                }
              }
              
              // Diagnóstico final para demandas REALMENTE impossíveis
              const trulyImpossible = stillPendingAfterForce.filter(d => 
                !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
              );
              if (trulyImpossible.length > 0) {
                console.log(`\n   ❌ ${trulyImpossible.length} demandas IMPOSSÍVEIS mesmo após gate forçado:`);
                for (const demand of trulyImpossible) {
                  console.log(`      🔍 ${demand.locationName} ${demand.dateStr} ${demand.shift}`);
                  for (const bId of demand.eligibleBrokerIds) {
                    const broker = context.brokerQueue.find(b => b.brokerId === bId);
                    if (!broker) continue;
                    const reasons: string[] = [];
                    if (broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) reasons.push(`HARD CAP (${broker.externalShiftCount})`);
                    const invCheck = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
                    if (!invCheck.allowed) reasons.push(invCheck.reason);
                    console.log(`         - ${broker.brokerName} (${broker.externalShiftCount} ext): ${reasons.join('; ') || 'desconhecido'}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.11: PASSE FINAL CONSERVADOR - GARANTIR ALOCAÇÃO DE TODOS OS EXTERNOS
  // MOVIDO PARA ANTES DOS INTERNOS — externos SEMPRE têm prioridade
  // Relaxa regras progressivamente para demandas externas não alocadas
  // NUNCA relaxa: disponibilidade dia/turno, vínculo ao local, hard cap
  // ═══════════════════════════════════════════════════════════
  const preEmergencyUnallocated = possibleDemands.filter(d => 
    !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
  );

  if (preEmergencyUnallocated.length > 0) {
    console.log(`\n🚑 ETAPA 8.11: PASSE FINAL CONSERVADOR - ${preEmergencyUnallocated.length} demandas externas ainda pendentes`);
    
    for (const demand of preEmergencyUnallocated) {
      const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
      if (allocatedDemands.has(demandKey)) continue;
      
      // Coletar corretores elegíveis (já configurados no local via eligibleBrokerIds)
      const eligibleBrokers = context.brokerQueue.filter(b => {
        if (!demand.eligibleBrokerIds.includes(b.brokerId)) return false;
        if (!b.availableWeekdays.includes(demand.dayOfWeek)) return false;
        // Hard cap nunca relaxado
        if (b.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) return false;
        return true;
      });
      
      // Ordenar por menos externos (distribuição justa)
      eligibleBrokers.sort((a, b) => a.externalShiftCount - b.externalShiftCount);
      
      let allocated = false;
      for (const broker of eligibleBrokers) {
        // Verificar apenas regras invioláveis (construtora, etc.) mas relaxar consecutivos e gate
        const checkResult = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
        if (checkResult.allowed) {
          allocateDemand(demand, broker, context);
          allocatedDemands.add(demandKey);
          relaxedAllocations.push({
            demand: `${demand.locationName} ${demand.dateStr} ${demand.shift}`,
            pass: 10,
            reason: `PASSE FINAL: ${broker.brokerName} (regras de consecutivos/gate relaxadas)`
          });
          console.log(`   🚑 ${demand.locationName} ${demand.dateStr} ${demand.shift} → ${broker.brokerName} (passe final)`);
          allocated = true;
          break;
        }
      }
      
      if (!allocated) {
        console.log(`   ❌ ${demand.locationName} ${demand.dateStr} ${demand.shift}: IMPOSSÍVEL alocar mesmo com relaxamento`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.11b: SACRIFICAR SÁBADO INTERNO PARA COBRIR EXTERNO
  // "Externos acima de tudo" — remove alocação de sábado interno
  // para liberar corretor para demanda externa pendente
  // Mínimo de 1 corretor por local interno no sábado é preservado
  // ═══════════════════════════════════════════════════════════
  const postFinalUnallocated = possibleDemands.filter(d => 
    !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
  );

  if (postFinalUnallocated.length > 0 && saturdayDate) {
    console.log(`\n🔥 ETAPA 8.11b: SACRIFÍCIO DE SÁBADO INTERNO — ${postFinalUnallocated.length} demandas externas pendentes`);
    const saturdayDateStr = format(saturdayDate, "yyyy-MM-dd");
    
    for (const demand of postFinalUnallocated) {
      const demandKey = `${demand.locationId}-${demand.dateStr}-${demand.shift}`;
      if (allocatedDemands.has(demandKey)) continue;
      
      // Buscar corretores elegíveis que estão alocados no sábado interno
      for (const brokerId of demand.eligibleBrokerIds) {
        const broker = context.brokerQueue.find(b => b.brokerId === brokerId);
        if (!broker) continue;
        if (broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) continue;
        if (!broker.availableWeekdays.includes(demand.dayOfWeek)) continue;
        
        // Encontrar alocação de sábado interno deste corretor
        const saturdayInternalAssignment = context.assignments.find(a =>
          a.broker_id === brokerId &&
          a.assignment_date === saturdayDateStr &&
          context.internalLocationIds.has(a.location_id)
        );
        
        if (!saturdayInternalAssignment) continue;
        
        // Verificar mínimo de 1 no local interno
        const otherBrokersAtSameInternal = context.assignments.filter(a =>
          a.location_id === saturdayInternalAssignment.location_id &&
          a.assignment_date === saturdayDateStr &&
          a.shift_type === saturdayInternalAssignment.shift_type &&
          a.broker_id !== brokerId
        );
        
        if (otherBrokersAtSameInternal.length < 1) {
          console.log(`   ⚠️ ${broker.brokerName}: não pode sacrificar — seria o último no sábado interno`);
          continue;
        }
        
        // Verificar regras invioláveis (exceto weekend que será resolvida pela remoção)
        const checkResult = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
        if (!checkResult.allowed) continue;
        
        // ═══ EXECUTAR SACRIFÍCIO ═══
        const internalIdx = context.assignments.indexOf(saturdayInternalAssignment);
        if (internalIdx === -1) continue;
        
        const sacrificedLocation = saturdayInternalAssignment.location_id;
        context.assignments.splice(internalIdx, 1);
        
        // Remover do saturdayInternalWorkers
        context.saturdayInternalWorkers?.delete(brokerId);
        
        // Alocar na demanda externa
        allocateDemand(demand, broker, context);
        allocatedDemands.add(demandKey);
        
        relaxedAllocations.push({
          demand: `${demand.locationName} ${demand.dateStr} ${demand.shift}`,
          pass: 11,
          reason: `SACRIFÍCIO INTERNO: ${broker.brokerName} removido do sábado interno para cobrir externo`
        });
        
        console.log(`   🔥 SACRIFÍCIO: ${broker.brokerName} removido do sábado interno → ${demand.locationName} ${demand.dateStr} ${demand.shift}`);
        console.log(`   ⚠️ WARNING: INTERNO_COBERTURA_REDUZIDA no sábado para local ${sacrificedLocation}`);
        break;
      }
    }
    
    // Diagnóstico final
    const trulyFinal = postFinalUnallocated.filter(d => 
      !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
    );
    if (trulyFinal.length > 0) {
      console.log(`\n   ❌ DIAGNÓSTICO FINAL: ${trulyFinal.length} demandas IMPOSSÍVEIS após todos os esforços:`);
      for (const demand of trulyFinal) {
        console.log(`      🔍 ${demand.locationName} ${demand.dateStr} ${demand.shift}`);
        const top3 = demand.eligibleBrokerIds.slice(0, 3);
        for (const bId of top3) {
          const broker = context.brokerQueue.find(b => b.brokerId === bId);
          if (!broker) continue;
          const reasons: string[] = [];
          if (broker.externalShiftCount >= MAX_EXTERNAL_SHIFTS_HARD_CAP) reasons.push(`HARD CAP (${broker.externalShiftCount})`);
          if (!broker.availableWeekdays.includes(demand.dayOfWeek)) reasons.push(`Dia indisponível`);
          const invCheck = checkTrulyInviolableRulesWithRelaxation(broker, demand, context, true);
          if (!invCheck.allowed) reasons.push(invCheck.reason);
          console.log(`         - ${broker.brokerName} (${broker.externalShiftCount} ext): ${reasons.join('; ') || 'desconhecido'}`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ETAPA 8.10: ALOCAÇÃO DE PLANTÕES INTERNOS (SEGUNDA A SEXTA)
  // EXECUTADA APÓS finalizar TODOS os externos para não interferir
  // Regra: interno pode coexistir com externo no MESMO dia se em TURNOS diferentes
  // ═══════════════════════════════════════════════════════════
  console.log("\n🏢 ETAPA 8.10: ALOCANDO PLANTÕES INTERNOS DE SEGUNDA A SEXTA...");
  
  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekdaysMonToFri = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  
  // Helper para verificar disponibilidade de turno no vínculo interno
  const isBrokerAvailableForInternalShift = (locBroker: any, shift: "morning" | "afternoon", dayOfWeek: string): boolean => {
    const broker = locBroker.brokers;
    if (!broker?.available_weekdays?.includes(dayOfWeek)) return false;
    
    const wsAvail = locBroker.weekday_shift_availability as Record<string, string[]> | null;
    if (wsAvail && wsAvail[dayOfWeek]) {
      return wsAvail[dayOfWeek].includes(shift);
    }
    
    // Fallback para campos legacy
    if (shift === "morning") return locBroker.available_morning !== false;
    if (shift === "afternoon") return locBroker.available_afternoon !== false;
    return false;
  };
  
  if (internalLocationsData && internalLocationsData.length > 0) {
    for (const internalLocation of internalLocationsData) {
      const locationName = internalLocation.name || "Local Interno";
      console.log(`\n   📍 Processando ${locationName}...`);
      
      // Corretores configurados para este local interno
      const locationBrokers = internalLocation.location_brokers || [];
      if (locationBrokers.length === 0) {
        console.log(`   ⚠️ ${locationName}: sem corretores configurados`);
        continue;
      }
      
      // Para cada dia de segunda a sexta
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = addDays(weekStart, dayOffset);
        const dayOfWeek = getDay(currentDate);
        const weekdayName = weekdayNames[dayOfWeek];
        
        // Pular se não for dia útil (seg-sex)
        if (!weekdaysMonToFri.includes(weekdayName)) continue;
        
        const dateStr = format(currentDate, "yyyy-MM-dd");
        
        // Encontrar período ativo para ESTA data específica
        const activePeriod = internalLocation.location_periods?.find(
          (p: any) => {
            const periodStart = new Date(p.start_date + "T00:00:00");
            const periodEnd = new Date(p.end_date + "T00:00:00");
            return periodStart <= currentDate && periodEnd >= currentDate;
          }
        );
        
        if (!activePeriod) continue;
        
        // ── VERIFICAR DATAS EXCLUÍDAS (internos seg-sex) ─────────────
        if (isDayFullyExcluded(activePeriod.id, dateStr)) {
          console.log(`   🚫 ${locationName}: data ${dateStr} excluída inteiramente — pulando`);
          continue;
        }

        // Buscar configuração do dia
        const dayConfig = activePeriod.period_day_configs?.find(
          (dc: any) => dc.weekday === weekdayName
        );
        
        if (!dayConfig) continue;
        
        // Aplicar exclusão de turno parcial
        let hasMorning = dayConfig.has_morning === true;
        let hasAfternoon = dayConfig.has_afternoon === true;
        if (isShiftExcluded(activePeriod.id, dateStr, "morning")) {
          hasMorning = false;
          console.log(`   🚫 ${locationName}: turno manhã excluído em ${dateStr}`);
        }
        if (isShiftExcluded(activePeriod.id, dateStr, "afternoon")) {
          hasAfternoon = false;
          console.log(`   🚫 ${locationName}: turno tarde excluído em ${dateStr}`);
        }
        
        if (!hasMorning && !hasAfternoon) continue;
        
        // Para cada corretor configurado no local
        for (const locBroker of locationBrokers) {
          const brokerId = locBroker.broker_id;
          const broker = brokerQueue.find(b => b.brokerId === brokerId);
          
          if (!broker) continue;
          
          // TURNO MANHÃ
          if (hasMorning) {
            const availableForMorning = isBrokerAvailableForInternalShift(locBroker, "morning", weekdayName);
            const hasConflictMorning = assignments.some(
              a => a.broker_id === brokerId && 
                   a.assignment_date === dateStr && 
                   a.shift_type === "morning"
            );
            
            if (availableForMorning && !hasConflictMorning) {
              const morningAssignment: ScheduleAssignment = {
                broker_id: brokerId,
                location_id: internalLocation.id,
                assignment_date: dateStr,
                shift_type: "morning",
                start_time: dayConfig.morning_start || "08:00",
                end_time: dayConfig.morning_end || "12:00"
              };
              assignments.push(morningAssignment);
              console.log(`   ✅ ${broker.brokerName} → ${locationName} ${weekdayName} MANHÃ`);
            } else if (hasConflictMorning) {
              console.log(`   ⏭️ ${broker.brokerName} ${weekdayName} manhã: já tem alocação neste turno`);
            }
          }
          
          // TURNO TARDE
          if (hasAfternoon) {
            const availableForAfternoon = isBrokerAvailableForInternalShift(locBroker, "afternoon", weekdayName);
            const hasConflictAfternoon = assignments.some(
              a => a.broker_id === brokerId && 
                   a.assignment_date === dateStr && 
                   a.shift_type === "afternoon"
            );
            
            if (availableForAfternoon && !hasConflictAfternoon) {
              const afternoonAssignment: ScheduleAssignment = {
                broker_id: brokerId,
                location_id: internalLocation.id,
                assignment_date: dateStr,
                shift_type: "afternoon",
                start_time: dayConfig.afternoon_start || "13:00",
                end_time: dayConfig.afternoon_end || "18:00"
              };
              assignments.push(afternoonAssignment);
              console.log(`   ✅ ${broker.brokerName} → ${locationName} ${weekdayName} TARDE`);
            } else if (hasConflictAfternoon) {
              console.log(`   ⏭️ ${broker.brokerName} ${weekdayName} tarde: já tem alocação neste turno`);
            }
          }
        }
      }
    }
  }
  
  console.log(`\n   📊 Total de alocações após internos seg-sex: ${assignments.length}`);

  // Relatório de qualidade
  const finalUnallocated = possibleDemands.filter(d => 
    !allocatedDemands.has(`${d.locationId}-${d.dateStr}-${d.shift}`)
  );

  // Coletar justificativas para demandas não alocadas
  for (const demand of finalUnallocated) {
    const result = findBrokerForDemand(demand, context, 10, 0, true, 1);
    const blockedBrokers = result.blockedBrokers || [];
    
    if (demand.eligibleBrokerIds.length === 0) {
      (demand as any)._unallocatedReason = "Nenhum corretor está configurado para este local neste turno.";
    } else if (blockedBrokers.length > 0) {
      const brokerReasons = blockedBrokers.map(bb => `${bb.brokerName} (${bb.reason})`);
      (demand as any)._unallocatedReason = `Corretores disponíveis: ${brokerReasons.join("; ")}. Nenhum pôde ser alocado.`;
    } else {
      // Check where eligible brokers are allocated
      const brokerReasons: string[] = [];
      for (const bId of demand.eligibleBrokerIds) {
        const broker = context.brokerQueue.find(b => b.brokerId === bId);
        const existingAssignment = context.assignments.find(a => 
          a.broker_id === bId && a.assignment_date === demand.dateStr && a.shift_type === demand.shift
        );
        if (existingAssignment) {
          const locName = context.externalLocations?.find(l => l.id === existingAssignment.location_id)?.name || "outro local";
          brokerReasons.push(`${broker?.brokerName || bId} (já alocado no ${locName})`);
        } else {
          brokerReasons.push(`${broker?.brokerName || bId} (bloqueado por regras)`);
        }
      }
      (demand as any)._unallocatedReason = `Corretores configurados: ${brokerReasons.join("; ")}. Nenhum pôde ser alocado.`;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 RELATÓRIO DE QUALIDADE DA GERAÇÃO");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`📋 Total de demandas externas: ${possibleDemands.length}`);
  console.log(`✅ Pass 1-5: ${allocatedPass1 + allocatedPass2 + allocatedPass3 + allocatedPass4 + allocatedPass5}`);
  console.log(`🔄 De-consecutivização: ${deConsecutiveResult.swapsSuccessful} swaps`);
  console.log(`⚠️ Regras relaxadas: ${relaxedAllocations.length}`);
  console.log(`❌ Não alocadas: ${finalUnallocated.length}`);

  if (relaxedAllocations.length > 0) {
    console.log(`\n📋 Alocações com regras relaxadas:`);
    for (const ra of relaxedAllocations.slice(0, 10)) {
      console.log(`   - ${ra.demand}: ${ra.reason}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GERAR DIAGNÓSTICO POR CORRETOR SUBALOCADO
  // ═══════════════════════════════════════════════════════════
  const brokerDiagnostics: BrokerAllocationDiagnostic[] = [];
  
  for (const broker of context.brokerQueue) {
    if (broker.externalShiftCount >= 2) continue; // Só diagnosticar subalocados
    
    const opportunities: BrokerAllocationDiagnostic["opportunities"] = [];
    const rejectionsByRule: Record<string, number> = {};
    
    // Contar rejeições no trace real
    for (const trace of decisionTrace) {
      for (const rej of trace.rejections) {
        if (rej.brokerId === broker.brokerId) {
          const ruleKey = rej.rule || "DESCONHECIDO";
          rejectionsByRule[ruleKey] = (rejectionsByRule[ruleKey] || 0) + 1;
          opportunities.push({
            locationName: trace.locationName,
            dateStr: trace.dateStr,
            shift: trace.shift,
            rule: rej.rule,
            reason: rej.reason
          });
        }
      }
    }
    
    brokerDiagnostics.push({
      brokerId: broker.brokerId,
      brokerName: broker.brokerName,
      finalExternalCount: broker.externalShiftCount,
      targetExternals: broker.targetExternals,
      totalOpportunities: opportunities.length,
      rejectionsByRule,
      opportunities
    });
  }
  
  // Log diagnóstico para corretores subalocados
  if (brokerDiagnostics.length > 0) {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`🔬 DIAGNÓSTICO FORENSE: ${brokerDiagnostics.length} corretores com <2 externos`);
    console.log(`═══════════════════════════════════════════════════════════`);
    
    for (const diag of brokerDiagnostics) {
      console.log(`\n   📋 ${diag.brokerName}: ${diag.finalExternalCount}/${diag.targetExternals} externos`);
      console.log(`      Oportunidades analisadas: ${diag.totalOpportunities}`);
      if (Object.keys(diag.rejectionsByRule).length > 0) {
        console.log(`      Rejeições por regra:`);
        for (const [rule, count] of Object.entries(diag.rejectionsByRule).sort((a, b) => b[1] - a[1])) {
          console.log(`         ${rule}: ${count}x`);
        }
      }
    }
  }
  
  // Converter mapa de exclusões para array final
  const eligibilityExclusions: EligibilityExclusion[] = Array.from(eligibilityExclusionMap.values())
    .filter(e => e.excluded > 0)
    .map(e => ({
      brokerId: e.brokerId,
      brokerName: e.brokerName,
      totalDemandsInLinkedLocations: e.totalDemands,
      eligibleCount: e.eligible,
      excludedCount: e.excluded,
      exclusionsByReason: e.byReason,
      exclusionDetails: e.details
    }))
    .sort((a, b) => b.excludedCount - a.excludedCount);

  // ═══════════════════════════════════════════════════════════
  // RASTREIO FORENSE: Construir relatório de competição para sub-alocados
  // ═══════════════════════════════════════════════════════════
  const subAllocatedForensics: SubAllocatedForensic[] = [];
  
  for (const broker of context.brokerQueue) {
    if (broker.externalShiftCount >= 2) continue; // Só diagnosticar sub-alocados
    
    const traces = competitionLog.get(broker.brokerId) || [];
    const ruleBlockCounts: Record<string, number> = {};
    let lostByCompetition = 0;
    let lostByRule = 0;
    let demandUnallocated = 0;
    let allocatedCount = 0;
    
    for (const t of traces) {
      switch (t.outcome) {
        case "outcompeted": lostByCompetition++; break;
        case "rule_blocked":
          lostByRule++;
          const rk = t.blockRule || "DESCONHECIDO";
          ruleBlockCounts[rk] = (ruleBlockCounts[rk] || 0) + 1;
          break;
        case "demand_unallocated": demandUnallocated++; break;
        case "allocated": allocatedCount++; break;
      }
    }
    
    const forensic: SubAllocatedForensic = {
      brokerId: broker.brokerId,
      brokerName: broker.brokerName,
      finalExternalCount: broker.externalShiftCount,
      targetExternals: broker.targetExternals,
      totalEligibleDemands: traces.length,
      lostByCompetition,
      lostByRule,
      demandUnallocated,
      allocatedCount,
      isSaturdayInternalWorker: context.saturdayInternalWorkers?.has(broker.brokerId) || false,
      ruleBlockCounts,
      competitionTrace: traces,
    };
    
    subAllocatedForensics.push(forensic);
    
    // Log forense detalhado
    console.log(`\n   🔬 FORENSE ${broker.brokerName}: ${broker.externalShiftCount}/${broker.targetExternals} externos`);
    console.log(`      📊 Demandas elegíveis: ${traces.length}`);
    console.log(`      ✅ Alocado: ${allocatedCount}`);
    console.log(`      ❌ Perdeu por competição (outro na frente): ${lostByCompetition}`);
    console.log(`      🚫 Bloqueado por regra: ${lostByRule}`);
    console.log(`      ⬜ Demanda sem alocação: ${demandUnallocated}`);
    console.log(`      🏢 Saturday internal worker: ${context.saturdayInternalWorkers?.has(broker.brokerId) ? 'SIM' : 'NÃO'}`);
    
    if (Object.keys(ruleBlockCounts).length > 0) {
      console.log(`      📋 Regras que bloquearam:`);
      for (const [rule, count] of Object.entries(ruleBlockCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`         ${rule}: ${count}x`);
      }
    }
    
    // Mostrar as primeiras 10 perdas por competição para entender padrão
    const competitionLosses = traces.filter(t => t.outcome === "outcompeted").slice(0, 10);
    if (competitionLosses.length > 0) {
      console.log(`      🏁 Perdas por competição (top 10):`);
      for (const t of competitionLosses) {
        console.log(`         ${t.locationName} ${t.dateStr} ${t.shift} pass${t.pass} → ganhou: ${t.selectedBrokerName} (pos ${t.sortPosition}/${t.totalInQueue}, ext=${t.externalCountAtTime})`);
      }
    }
    
    // Mostrar bloqueios por regra
    const ruleBlocks = traces.filter(t => t.outcome === "rule_blocked").slice(0, 10);
    if (ruleBlocks.length > 0) {
      console.log(`      🚫 Bloqueios por regra (top 10):`);
      for (const t of ruleBlocks) {
        console.log(`         ${t.locationName} ${t.dateStr} ${t.shift} pass${t.pass} → ${t.blockRule}: ${t.blockReason} (ext=${t.externalCountAtTime})`);
      }
    }
  }

  // Construir mapa broker-cêntrico final com contagens atualizadas
  const brokerEligibilityMap: BrokerExternalEligibility[] = [];
  for (const [, builder] of brokerEligibilityBuilder) {
    const broker = context.brokerQueue.find(b => b.brokerId === builder.brokerId);
    const locations = Array.from(builder.locations.values());
    const totalEligible = locations.reduce((sum, l) => sum + l.eligible.length, 0);
    const totalExcluded = locations.reduce((sum, l) => sum + l.excluded.length, 0);
    brokerEligibilityMap.push({
      brokerId: builder.brokerId,
      brokerName: builder.brokerName,
      linkedLocationCount: locations.length,
      totalEligibleDemands: totalEligible,
      totalExcludedDemands: totalExcluded,
      locations,
      finalExternalCount: broker?.externalShiftCount || 0,
      targetExternals: broker?.targetExternals || 2
    });
  }
  // Ordenar: sub-alocados primeiro
  brokerEligibilityMap.sort((a, b) => {
    const aUnder = a.finalExternalCount < a.targetExternals ? 0 : 1;
    const bUnder = b.finalExternalCount < b.targetExternals ? 0 : 1;
    if (aUnder !== bUnder) return aUnder - bUnder;
    return a.brokerName.localeCompare(b.brokerName);
  });

  // Salvar trace no módulo para acesso externo
  setLastGenerationTrace({
    decisionTrace,
    brokerDiagnostics,
    eligibilityExclusions,
    subAllocatedForensics,
    brokerEligibilityMap
  });

  console.log(`\n🎉 TOTAL DE ALOCAÇÕES: ${assignments.length}`);

  // Atualizar filas de rotação
  if (context.locationAllocationsForQueueUpdate.length > 0) {
    console.log("\n🔄 ETAPA 10: ATUALIZANDO FILAS DE ROTAÇÃO...");
    try {
      const result = await bulkUpdateLocationQueuesAfterAllocation(context.locationAllocationsForQueueUpdate);
      if (result.success) {
        console.log(`   ✅ Filas de rotação atualizadas (${result.updated} registros)`);
      }
    } catch (error) {
      console.error("   ⚠️ Erro ao atualizar filas de rotação:", error);
    }
  }

  return assignments;
}

export interface ValidationResult {
  locationId: string;
  locationName: string;
  date: string;
  shift: "morning" | "afternoon";
  status: "ok" | "missing" | "extra";
  message: string;
}

export async function validateGeneratedSchedule(
  assignments: ScheduleAssignment[],
  weekStart: Date,
  weekEnd: Date
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🔍 VALIDAÇÃO PÓS-GERAÇÃO DA ESCALA");
  console.log("═══════════════════════════════════════════════════════════\n");

  const { data: locations } = await supabase.from("locations").select(`
    id, name, location_type, shift_config_mode,
    location_periods (id, period_type, start_date, end_date, period_day_configs (weekday, has_morning, has_afternoon))
  `).eq("is_active", true);

  const { data: allSpecificConfigs } = await supabase.from("period_specific_day_configs").select("*");

  const specificConfigsMap = new Map<string, any>();
  allSpecificConfigs?.forEach((config: any) => {
    specificConfigsMap.set(`${config.period_id}-${config.specific_date}`, config);
  });

  for (let date = new Date(weekStart); date <= weekEnd; date = addDays(date, 1)) {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = weekdays[date.getDay() === 0 ? 6 : date.getDay() - 1];

    for (const location of locations || []) {
      const period = location.location_periods?.find(
        (p: any) => new Date(p.start_date + "T00:00:00") <= date && new Date(p.end_date + "T00:00:00") >= date
      );
      if (!period) continue;

      let expectedMorning = false, expectedAfternoon = false;
      const specificConfig = specificConfigsMap.get(`${period.id}-${dateStr}`);

      if (specificConfig) {
        expectedMorning = specificConfig.has_morning;
        expectedAfternoon = specificConfig.has_afternoon;
      } else if (location.shift_config_mode === 'specific_date') {
        continue;
      } else {
        const dayConfig = period.period_day_configs?.find((dc: any) => dc.weekday === dayOfWeek);
        if (dayConfig) {
          expectedMorning = dayConfig.has_morning;
          expectedAfternoon = dayConfig.has_afternoon;
        }
      }

      const morningAssignment = assignments.find(a => a.location_id === location.id && a.assignment_date === dateStr && a.shift_type === "morning");
      const afternoonAssignment = assignments.find(a => a.location_id === location.id && a.assignment_date === dateStr && a.shift_type === "afternoon");

      if (expectedMorning && !morningAssignment) {
        const msg = `❌ FALTANDO: ${location.name} - ${dateStr} - Manhã`;
        console.error(msg);
        results.push({ locationId: location.id, locationName: location.name, date: dateStr, shift: "morning", status: "missing", message: msg });
      }

      if (expectedAfternoon && !afternoonAssignment) {
        const msg = `❌ FALTANDO: ${location.name} - ${dateStr} - Tarde`;
        console.error(msg);
        results.push({ locationId: location.id, locationName: location.name, date: dateStr, shift: "afternoon", status: "missing", message: msg });
      }
    }
  }

  const missingCount = results.filter(r => r.status === "missing").length;

  if (results.length === 0) {
    console.log("✅ VALIDAÇÃO CONCLUÍDA: 100% compatível com configurações!");
  } else {
    console.log(`\n⚠️ VALIDAÇÃO CONCLUÍDA: ${missingCount} faltando`);
  }

  console.log("═══════════════════════════════════════════════════════════\n");

  return results;
}

export async function getBrokersFromInternalShift(
  generatedScheduleId: string,
  date: string,
  shiftType: "morning" | "afternoon"
): Promise<any[]> {
  const { data: internalAssignments, error } = await supabase
    .from("schedule_assignments")
    .select(`id, broker_id, location_id, shift_type, start_time, end_time, broker:brokers(id, name, creci), location:locations(id, name, location_type)`)
    .eq("generated_schedule_id", generatedScheduleId)
    .eq("assignment_date", date)
    .eq("shift_type", shiftType);

  if (error) {
    console.error("Erro ao buscar plantões internos:", error);
    return [];
  }

  return internalAssignments?.filter((a: any) => a.location?.location_type === "internal") || [];
}

export async function getAvailableBrokersForShift(
  locationId: string,
  date: string,
  shiftType: "morning" | "afternoon"
): Promise<any[]> {
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = weekdays[dateObj.getDay()];

  const { data: locationBrokers, error: lbError } = await supabase
    .from("location_brokers")
    .select(`
      broker_id, 
      available_morning, 
      available_afternoon,
      weekday_shift_availability,
      brokers (id, name, creci, available_weekdays)
    `)
    .eq("location_id", locationId);

  if (lbError) {
    console.error("Erro ao buscar corretores do local:", lbError);
    return [];
  }

  const { data: existingAssignments, error: eaError } = await supabase
    .from("schedule_assignments")
    .select("broker_id")
    .eq("assignment_date", date)
    .eq("shift_type", shiftType);

  if (eaError) {
    console.error("Erro ao buscar alocações existentes:", eaError);
    return [];
  }

  const assignedBrokerIds = existingAssignments?.map(a => a.broker_id) || [];

  const availableBrokers = locationBrokers?.filter((lb: any) => {
    const broker = lb.brokers;
    if (!broker) return false;
    
    if (!broker.available_weekdays?.includes(dayOfWeek)) return false;
    
    if (lb.weekday_shift_availability) {
      const dayAvailability = lb.weekday_shift_availability[dayOfWeek];
      if (!dayAvailability || !Array.isArray(dayAvailability) || !dayAvailability.includes(shiftType)) {
        return false;
      }
    } else {
      if (shiftType === "morning" && !lb.available_morning) return false;
      if (shiftType === "afternoon" && !lb.available_afternoon) return false;
    }
    
    if (assignedBrokerIds.includes(broker.id)) return false;
    
    return true;
  }).map((lb: any) => ({
    broker: lb.brokers,
    isAvailable: true
  })) || [];

  return availableBrokers;
}

export async function getSuggestedReplacements(
  locationId: string,
  date: string,
  shiftType: "morning" | "afternoon"
): Promise<any[]> {
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = weekdays[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];

  const { data: internalLocationBrokers } = await supabase
    .from("location_brokers")
    .select(`broker_id, available_morning, available_afternoon, locations!inner (location_type), brokers (id, name, creci, available_weekdays)`)
    .eq("locations.location_type", "internal");

  const { data: existingAssignments } = await supabase
    .from("schedule_assignments")
    .select("broker_id, shift_type")
    .eq("assignment_date", date);

  return internalLocationBrokers
    ?.filter((lb: any) => {
      const broker = lb.brokers;
      if (!broker) return false;
      const isAvailableDay = broker.available_weekdays?.includes(dayOfWeek);
      const isAvailableShift = shiftType === "morning" ? lb.available_morning : lb.available_afternoon;
      const alreadyAssigned = existingAssignments?.some((a: any) => a.broker_id === broker.id && a.shift_type === shiftType);
      return isAvailableDay && isAvailableShift && !alreadyAssigned;
    })
    .map((lb: any) => lb.brokers) || [];
}

// Export generateSelectedWeeksSchedule for selective generation
export async function generateSelectedWeeksSchedule(
  selectedWeeks: { weekStartStr: string; scheduleId?: string }[],
  month: number,
  year: number,
  lockedWeekScheduleIds: string[],
  onProgress?: (current: number, total: number, attempt?: number, maxAttempts?: number) => void,
  maxRetries: number = 100
): Promise<GenerateMonthlyResult> {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`🎯 GERAÇÃO SELETIVA: ${selectedWeeks.length} semanas selecionadas`);
  console.log(`🔒 ${lockedWeekScheduleIds.length} semanas travadas (serão preservadas)`);
  console.log("═══════════════════════════════════════════════════════════");

  const allWeeklySchedules: MonthlyScheduleResult[] = [];
  
  // Carregar dados base
  const { data: brokersData } = await supabase
    .from("brokers")
    .select("id, name")
    .eq("is_active", true);
  
  const { data: locationsData } = await supabase
    .from("locations")
    .select("id, name, location_type, builder_company")
    .eq("is_active", true);
  
  const brokers: BrokerInfoForValidation[] = (brokersData || []).map(b => ({ id: b.id, name: b.name }));
  const locations: LocationInfoForValidation[] = (locationsData || []).map(l => ({ 
    id: l.id, 
    name: l.name, 
    type: l.location_type || 'external',
    builderCompany: l.builder_company || undefined
  }));

  // Carregar dados de locais internos
  const { data: internalLocations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("location_type", "internal")
    .eq("is_active", true);

  const tambauLocation = internalLocations?.find(l => 
    l.name.toLowerCase().includes("tambaú") || l.name.toLowerCase().includes("tambau")
  );
  const bessaLocation = internalLocations?.find(l => 
    l.name.toLowerCase().includes("bessa")
  );

  // Sincronizar filas de sábado
  let tambauSaturdayQueue: SaturdayQueueItem[] = [];
  let bessaSaturdayQueue: SaturdayQueueItem[] = [];
  
  if (tambauLocation) {
    await syncSaturdayQueueForLocation(tambauLocation.id);
    tambauSaturdayQueue = await getSaturdayQueueForLocation(tambauLocation.id);
  }
  
  if (bessaLocation) {
    await syncSaturdayQueueForLocation(bessaLocation.id);
    bessaSaturdayQueue = await getSaturdayQueueForLocation(bessaLocation.id);
  }

  // Carregar filas de rotação
  const { data: externalLocationsForQueue } = await supabase
    .from("locations")
    .select("id, name")
    .eq("location_type", "external")
    .eq("is_active", true);
  
  let locationRotationQueues = new Map<string, LocationRotationQueueItem[]>();
  
  try {
    await syncAllLocationRotationQueues();
    const externalLocationIds = (externalLocationsForQueue || []).map(l => l.id);
    if (externalLocationIds.length > 0) {
      locationRotationQueues = await getMultipleLocationRotationQueues(externalLocationIds);
    }
  } catch (error) {
    console.error("⚠️ Erro ao carregar filas de rotação:", error);
  }

  // Carregar histórico de semanas travadas para usar como referência
  let previousWeeksAssignments: ScheduleAssignment[] = [];
  if (lockedWeekScheduleIds.length > 0) {
    const { data: lockedAssignments } = await supabase
      .from("schedule_assignments")
      .select("*")
      .in("generated_schedule_id", lockedWeekScheduleIds);
    
    previousWeeksAssignments = (lockedAssignments || []).map((a: any) => ({
      broker_id: a.broker_id,
      location_id: a.location_id,
      assignment_date: a.assignment_date,
      shift_type: a.shift_type,
      start_time: a.start_time,
      end_time: a.end_time
    }));
    
    console.log(`📋 ${previousWeeksAssignments.length} alocações de semanas travadas carregadas como histórico`);
  }

  // Determinar semana mais antiga para buscar stats anteriores
  const sortedWeeks = [...selectedWeeks].sort((a, b) => 
    new Date(a.weekStartStr).getTime() - new Date(b.weekStartStr).getTime()
  );
  
  const firstWeekStart = sortedWeeks[0]?.weekStartStr || format(new Date(year, month - 1, 1), "yyyy-MM-dd");
  const previousWeekStats = await getPreviousWeekStatsWithFallback(firstWeekStart);

  // Construir acumulador base com dados das semanas travadas
  const lastWeekExternals: { brokerId: string; date: string }[] = [];
  
  // Extrair externos dos últimos 3 dias das semanas travadas (para regra de consecutivos)
  for (const assignment of previousWeeksAssignments) {
    const loc = locationsData?.find(l => l.id === assignment.location_id);
    if (loc?.location_type === "external") {
      lastWeekExternals.push({
        brokerId: assignment.broker_id,
        date: assignment.assignment_date
      });
    }
  }

  const accumulator: WeeklyAccumulator = {
    saturdayCounts: {},
    saturdayQueue: tambauSaturdayQueue,
    bessaSaturdayQueue,
    previousWeekStats,
    lastWeekExternals,
    externalCountsThisMonth: {},
    lastWeekTambauSaturdayBrokers: [],
    locationRotationQueues,
    monthSaturdayCount: {},
    monthSundayCount: {},
    monthSundayAtLocation: {}
  };

  // Processar cada semana selecionada
  for (let i = 0; i < selectedWeeks.length; i++) {
    const weekInfo = selectedWeeks[i];
    const weekStart = new Date(weekInfo.weekStartStr + "T00:00:00");
    const weekEnd = addDays(weekStart, 6);
    const weekLabel = `${format(weekStart, "dd/MM")} a ${format(weekEnd, "dd/MM")}`;

    onProgress?.(i + 1, selectedWeeks.length);

    console.log(`\n🔄 Gerando semana ${i + 1}/${selectedWeeks.length}: ${weekLabel}`);

    // Gerar escala com retry
    const result = await generateWeeklyScheduleWithRetry(
      weekStart,
      weekEnd,
      accumulator,
      brokers,
      locations,
      maxRetries,
      (attempt, max) => onProgress?.(i + 1, selectedWeeks.length, attempt, max)
    );

    if (!result.success) {
      console.error(`\n❌ FALHA na geração da semana ${weekLabel}`);
      return {
        schedules: allWeeklySchedules,
        success: false,
        failedWeek: weekLabel,
        violations: result.violations
      };
    }

    const weekSchedule = result.assignments;
    
    allWeeklySchedules.push({
      weekStart,
      weekEnd,
      assignments: weekSchedule,
      attempts: result.attempts
    });

    // Atualizar acumuladores para próxima semana
    const externalLocationIds = new Set((externalLocationsForQueue || []).map(l => l.id));
    
    const brokerExternalDays = new Map<string, Set<string>>();
    const brokerStatsMap = new Map<string, { external: number; internal: number; saturday: number }>();
    const saturdayBrokers: string[] = [];

    for (const assignment of weekSchedule) {
      const isExternal = externalLocationIds.has(assignment.location_id);
      const isSaturday = new Date(assignment.assignment_date + "T00:00:00").getDay() === 6;
      
      if (!brokerStatsMap.has(assignment.broker_id)) {
        brokerStatsMap.set(assignment.broker_id, { external: 0, internal: 0, saturday: 0 });
      }
      const stats = brokerStatsMap.get(assignment.broker_id)!;
      
      if (isExternal) {
        stats.external++;
        if (!brokerExternalDays.has(assignment.broker_id)) {
          brokerExternalDays.set(assignment.broker_id, new Set());
        }
        brokerExternalDays.get(assignment.broker_id)!.add(assignment.assignment_date);
      } else {
        stats.internal++;
      }
      
      if (isSaturday) {
        stats.saturday++;
        if (!saturdayBrokers.includes(assignment.broker_id)) {
          saturdayBrokers.push(assignment.broker_id);
        }
        accumulator.saturdayCounts[assignment.broker_id] = 
          (accumulator.saturdayCounts[assignment.broker_id] || 0) + 1;
      }
    }

    // Salvar estatísticas
    for (const broker of brokersData || []) {
      const stats = brokerStatsMap.get(broker.id) || { external: 0, internal: 0, saturday: 0 };
      await saveBrokerWeeklyStats(
        broker.id,
        format(weekStart, "yyyy-MM-dd"),
        format(weekEnd, "yyyy-MM-dd"),
        stats.external,
        stats.internal,
        stats.saturday
      );
    }

    // ═══════════════════════════════════════════════════════════
    // CORREÇÃO BUG: Atualizar fila de sábado do Tambaú APENAS com
    // quem realmente trabalhou no TAMBAÚ (não sábado externo genérico)
    // ═══════════════════════════════════════════════════════════
    if (tambauLocation) {
      const saturdayDateStr = format(addDays(weekStart, 5), "yyyy-MM-dd");
      
      // CORREÇÃO: Filtrar APENAS quem trabalhou no Tambaú no sábado
      const tambauSaturdayBrokers = weekSchedule
        .filter(a => 
          a.location_id === tambauLocation.id && 
          a.assignment_date === saturdayDateStr
        )
        .map(a => a.broker_id)
        .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicar
      
      if (tambauSaturdayBrokers.length > 0) {
        console.log(`   📋 Atualizando fila Tambaú: ${tambauSaturdayBrokers.length} corretores trabalharam no sábado interno`);
        await updateSaturdayQueueAfterAllocation(
          tambauLocation.id,
          tambauSaturdayBrokers,
          saturdayDateStr
        );
        
        accumulator.saturdayQueue = await getSaturdayQueueForLocation(tambauLocation.id);
        accumulator.lastWeekTambauSaturdayBrokers = [...tambauSaturdayBrokers];
      }
    }

    // Atualizar contagens mensais de externos
    for (const [brokerId, externalDaysSet] of brokerExternalDays) {
      accumulator.externalCountsThisMonth[brokerId] = 
        (accumulator.externalCountsThisMonth[brokerId] || 0) + externalDaysSet.size;
    }

    // ═══════════════════════════════════════════════════════════
    // NOVO: Atualizar contadores mensais de sábado e domingo
    // ═══════════════════════════════════════════════════════════
    for (const assignment of weekSchedule) {
      const assignmentDate = new Date(assignment.assignment_date + "T00:00:00");
      const dayOfWeek = assignmentDate.getDay();
      
      if (dayOfWeek === 6) {
        accumulator.monthSaturdayCount[assignment.broker_id] = 
          (accumulator.monthSaturdayCount[assignment.broker_id] || 0) + 1;
      } else if (dayOfWeek === 0) {
        accumulator.monthSundayCount[assignment.broker_id] = 
          (accumulator.monthSundayCount[assignment.broker_id] || 0) + 1;
        
        if (!accumulator.monthSundayAtLocation[assignment.location_id]) {
          accumulator.monthSundayAtLocation[assignment.location_id] = {};
        }
        accumulator.monthSundayAtLocation[assignment.location_id][assignment.broker_id] = 
          (accumulator.monthSundayAtLocation[assignment.location_id][assignment.broker_id] || 0) + 1;
      }
    }

    // Atualizar stats da semana anterior para próxima iteração
    const newPreviousStats: BrokerWeeklyStat[] = [];
    for (const broker of brokersData || []) {
      const stats = brokerStatsMap.get(broker.id) || { external: 0, internal: 0, saturday: 0 };
      newPreviousStats.push({
        broker_id: broker.id,
        broker_name: broker.name,
        external_count: stats.external,
        internal_count: stats.internal,
        saturday_count: stats.saturday,
      });
    }
    accumulator.previousWeekStats = newPreviousStats;

    // Atualizar externos dos últimos 3 dias
    const friday = addDays(weekStart, 4);
    const saturday = addDays(weekStart, 5);
    const sunday = addDays(weekStart, 6);
    const lastThreeDays = [
      format(friday, "yyyy-MM-dd"),
      format(saturday, "yyyy-MM-dd"),
      format(sunday, "yyyy-MM-dd")
    ];

    accumulator.lastWeekExternals = weekSchedule
      .filter(a => {
        if (!externalLocationIds.has(a.location_id)) return false;
        return lastThreeDays.includes(a.assignment_date);
      })
      .map(a => ({ brokerId: a.broker_id, date: a.assignment_date }));
  }

  console.log(`\n🎉 GERAÇÃO SELETIVA CONCLUÍDA: ${allWeeklySchedules.length} semanas geradas!`);

  return {
    schedules: allWeeklySchedules,
    success: true
  };
}

// Legacy export for backward compatibility
export async function generateWeeklySchedule(
  weekStart: Date,
  weekEnd: Date
): Promise<ScheduleAssignment[]> {
  const accumulator: WeeklyAccumulator = {
    saturdayCounts: {},
    saturdayQueue: [],
    bessaSaturdayQueue: [],
    previousWeekStats: [],
    lastWeekExternals: [],
    externalCountsThisMonth: {},
    lastWeekTambauSaturdayBrokers: [],
    locationRotationQueues: new Map(),
    monthSaturdayCount: {},
    monthSundayCount: {},
    monthSundayAtLocation: {}
  };
  
  return generateWeeklyScheduleWithAccumulator(weekStart, weekEnd, accumulator, 1);
}
