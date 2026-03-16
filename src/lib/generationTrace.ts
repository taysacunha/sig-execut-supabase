// ═══════════════════════════════════════════════════════════
// MÓDULO: Trace de diagnóstico de geração de escalas
// Separado do scheduleGenerator para evitar problemas de transformação
// ═══════════════════════════════════════════════════════════

export interface DecisionTraceEntry {
  demandKey: string;
  locationName: string;
  dateStr: string;
  shift: "morning" | "afternoon";
  pass: number;
  eligibleCount: number;
  rejections: {
    brokerId: string;
    brokerName: string;
    rule: string;
    reason: string;
    externalShiftCount: number;
    rule8Relaxed: boolean;
  }[];
  allocated: boolean;
  allocatedBrokerName?: string;
}

export interface BrokerAllocationDiagnostic {
  brokerId: string;
  brokerName: string;
  finalExternalCount: number;
  targetExternals: number;
  totalOpportunities: number;
  rejectionsByRule: Record<string, number>;
  opportunities: {
    locationName: string;
    dateStr: string;
    shift: string;
    rule: string;
    reason: string;
  }[];
}

export interface EligibilityExclusion {
  brokerId: string;
  brokerName: string;
  totalDemandsInLinkedLocations: number;
  eligibleCount: number;
  excludedCount: number;
  exclusionsByReason: Record<string, number>;
  exclusionDetails: {
    locationName: string;
    dateStr: string;
    shift: string;
    reason: string;
  }[];
}

// ═══════════════════════════════════════════════════════════
// RASTREIO FORENSE DE COMPETIÇÃO
// Para cada demanda onde um corretor sub-alocado era elegível,
// registra exatamente o que aconteceu: quem ganhou, posição na fila,
// ou qual regra bloqueou.
// ═══════════════════════════════════════════════════════════
export interface CompetitionTraceEntry {
  demandKey: string;
  locationName: string;
  dateStr: string;
  shift: string;
  pass: number;
  /** O que aconteceu com este corretor nesta demanda */
  outcome: "outcompeted" | "rule_blocked" | "allocated" | "demand_unallocated";
  /** Posição do corretor na fila ordenada (1 = primeiro) */
  sortPosition: number;
  /** Total de corretores na fila para esta demanda */
  totalInQueue: number;
  /** Quem foi alocado (se não foi este corretor) */
  selectedBrokerName?: string;
  /** Se bloqueado por regra, qual */
  blockRule?: string;
  blockReason?: string;
  /** Quantos externos o corretor tinha NAQUELE momento */
  externalCountAtTime: number;
  /** Se estava em saturdayInternalWorkers */
  isSaturdayInternalWorker: boolean;
}

export interface SubAllocatedForensic {
  brokerId: string;
  brokerName: string;
  finalExternalCount: number;
  targetExternals: number;
  /** Total de demandas onde este corretor era elegível */
  totalEligibleDemands: number;
  /** Quantas vezes perdeu por ordenação (outro broker escolhido antes) */
  lostByCompetition: number;
  /** Quantas vezes bloqueado por regra */
  lostByRule: number;
  /** Quantas vezes a demanda ficou sem alocação (ninguém pegou) */
  demandUnallocated: number;
  /** Quantas vezes foi alocado com sucesso */
  allocatedCount: number;
  /** Se estava em saturdayInternalWorkers */
  isSaturdayInternalWorker: boolean;
  /** Detalhes por regra que bloqueou */
  ruleBlockCounts: Record<string, number>;
  /** Trace completo de cada demanda elegível */
  competitionTrace: CompetitionTraceEntry[];
}

let lastGenerationTrace: {
  decisionTrace: DecisionTraceEntry[];
  brokerDiagnostics: BrokerAllocationDiagnostic[];
  eligibilityExclusions: EligibilityExclusion[];
  subAllocatedForensics?: SubAllocatedForensic[];
} | null = null;

export function getLastGenerationTrace() {
  return lastGenerationTrace;
}

export function setLastGenerationTrace(trace: {
  decisionTrace: DecisionTraceEntry[];
  brokerDiagnostics: BrokerAllocationDiagnostic[];
  eligibilityExclusions: EligibilityExclusion[];
  subAllocatedForensics?: SubAllocatedForensic[];
}) {
  lastGenerationTrace = trace;
}
