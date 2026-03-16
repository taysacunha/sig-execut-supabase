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

let lastGenerationTrace: {
  decisionTrace: DecisionTraceEntry[];
  brokerDiagnostics: BrokerAllocationDiagnostic[];
} | null = null;

export function getLastGenerationTrace() {
  return lastGenerationTrace;
}

export function setLastGenerationTrace(trace: {
  decisionTrace: DecisionTraceEntry[];
  brokerDiagnostics: BrokerAllocationDiagnostic[];
}) {
  lastGenerationTrace = trace;
}
