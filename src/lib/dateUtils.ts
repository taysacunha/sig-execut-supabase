/**
 * Returns an array of year numbers from (currentYear - past) to (currentYear + future).
 */
export function getYearOptions(past = 3, future = 3): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - past; y <= currentYear + future; y++) {
    years.push(y);
  }
  return years;
}

// ========== Shared Férias Status Constants ==========

export const FERIAS_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  em_gozo_q1: "Em Gozo - 1º Período",
  q1_concluida: "1º Período Concluído",
  em_gozo_q2: "Em Gozo - 2º Período",
  concluida: "Concluída",
  cancelada: "Cancelada",
  // Legacy fallback
  em_gozo: "Em Gozo",
};

export const FERIAS_STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  aprovada: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  em_gozo_q1: "bg-green-500/10 text-green-600 border-green-500/20",
  q1_concluida: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  em_gozo_q2: "bg-green-500/10 text-green-600 border-green-500/20",
  concluida: "bg-muted text-muted-foreground border-muted",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
  // Legacy fallback
  em_gozo: "bg-green-500/10 text-green-600 border-green-500/20",
};

/** All status values that mean the vacation is "active" (not done/cancelled) */
export const FERIAS_ACTIVE_STATUSES = [
  "pendente", "aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2",
  // Legacy
  "em_gozo",
];

/** Status values meaning the vacation is currently being enjoyed */
export const FERIAS_EM_GOZO_STATUSES = ["em_gozo_q1", "em_gozo_q2", "em_gozo"];

/** Check if a status represents "em gozo" */
export function isFeriasEmGozo(status: string): boolean {
  return FERIAS_EM_GOZO_STATUSES.includes(status);
}
