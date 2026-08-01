// ═══════════════════════════════════════════════════════════
// RELATÓRIO: CORRETORES SEM ALOCAÇÃO POR DIA
// Explica, para cada dia da escala, por que um corretor ficou
// sem nenhum plantão (feriado/exclusão, turno não configurado,
// fora da disponibilidade, sem vínculo, bloqueio por regra).
// Função pura — não acessa o banco.
// ═══════════════════════════════════════════════════════════

import { BrokerAllocationDiagnostic, EligibilityExclusion } from "@/lib/generationTrace";

export type UnallocatedReason =
  | "excluded_date"
  | "no_shift_configured"
  | "outside_availability"
  | "no_linked_location"
  | "blocked_by_rule"
  | "unknown";

export interface UnallocatedBrokerEntry {
  brokerId: string;
  brokerName: string;
  reason: UnallocatedReason;
  details: string[];
}

export interface UnallocatedDay {
  date: string;
  weekday: string;
  weekdayLabel: string;
  fullyExcluded: boolean;
  dayReason: UnallocatedReason | null;
  dayReasonDetail: string | null;
  openLocations: string[];
  brokers: UnallocatedBrokerEntry[];
}

export interface UnallocatedReportSummary {
  totalDays: number;
  excludedDays: number;
  brokersWithGaps: number;
  unknownCount: number;
}

export interface UnallocatedReport {
  days: UnallocatedDay[];
  summary: UnallocatedReportSummary;
}

export interface UnallocatedReportInput {
  startDate: string;
  endDate: string;
  assignments: { broker_id: string; assignment_date: string }[];
  brokers: {
    id: string;
    name: string;
    is_active?: boolean | null;
    available_weekdays?: string[] | null;
    weekday_shift_availability?: any;
  }[];
  locationBrokers: {
    broker_id: string;
    location_id: string;
    available_morning?: boolean | null;
    available_afternoon?: boolean | null;
    weekday_shift_availability?: any;
  }[];
  locations: { id: string; name: string; is_active?: boolean | null }[];
  periods: { id: string; location_id: string; start_date: string; end_date: string }[];
  dayConfigs: {
    period_id: string;
    weekday: string;
    has_morning?: boolean | null;
    has_afternoon?: boolean | null;
  }[];
  specificDayConfigs: {
    period_id: string;
    specific_date: string;
    has_morning?: boolean | null;
    has_afternoon?: boolean | null;
  }[];
  excludedDates: {
    period_id: string;
    excluded_date: string;
    excluded_shifts?: string[] | null;
    reason?: string | null;
  }[];
  diagnostics?: BrokerAllocationDiagnostic[];
  eligibilityExclusions?: EligibilityExclusion[];
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const WEEKDAY_LABELS: Record<string, string> = {
  sunday: "Domingo",
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
};

export const REASON_LABELS: Record<UnallocatedReason, string> = {
  excluded_date: "Feriado / data excluída",
  no_shift_configured: "Sem turno configurado",
  outside_availability: "Fora da disponibilidade",
  no_linked_location: "Sem vínculo com local aberto",
  blocked_by_rule: "Bloqueado por regra",
  unknown: "Sem motivo identificado",
};

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cursor = parseDate(startDate);
  const end = parseDate(endDate);
  let guard = 0;
  while (cursor <= end && guard < 400) {
    out.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return out;
}

function getWeekday(dateStr: string): string {
  return WEEKDAYS[parseDate(dateStr).getDay()];
}

/** Turnos disponíveis do corretor para o dia da semana, considerando o mapa global/local. */
function shiftsFromAvailabilityMap(map: any, weekday: string): string[] | null {
  if (!map || typeof map !== "object") return null;
  const raw = map[weekday];
  if (!Array.isArray(raw)) return null;
  return raw.filter((s: any) => typeof s === "string");
}

export function buildUnallocatedBrokerReport(input: UnallocatedReportInput): UnallocatedReport {
  const dates = enumerateDates(input.startDate, input.endDate);

  const locationById = new Map(input.locations.map((l) => [l.id, l]));

  // period_id → configs
  const dayConfigByPeriod = new Map<string, Map<string, { morning: boolean; afternoon: boolean }>>();
  input.dayConfigs.forEach((c) => {
    if (!dayConfigByPeriod.has(c.period_id)) dayConfigByPeriod.set(c.period_id, new Map());
    dayConfigByPeriod.get(c.period_id)!.set(c.weekday, {
      morning: !!c.has_morning,
      afternoon: !!c.has_afternoon,
    });
  });

  const specificByPeriod = new Map<string, Map<string, { morning: boolean; afternoon: boolean }>>();
  input.specificDayConfigs.forEach((c) => {
    if (!specificByPeriod.has(c.period_id)) specificByPeriod.set(c.period_id, new Map());
    specificByPeriod.get(c.period_id)!.set(c.specific_date, {
      morning: !!c.has_morning,
      afternoon: !!c.has_afternoon,
    });
  });

  const excludedByPeriod = new Map<
    string,
    Map<string, { shifts: string[] | null; reason: string | null }>
  >();
  input.excludedDates.forEach((e) => {
    if (!excludedByPeriod.has(e.period_id)) excludedByPeriod.set(e.period_id, new Map());
    const shifts = e.excluded_shifts && e.excluded_shifts.length > 0 ? e.excluded_shifts : null;
    excludedByPeriod.get(e.period_id)!.set(e.excluded_date, { shifts, reason: e.reason ?? null });
  });

  // broker_id → locations vinculados
  const linksByBroker = new Map<string, UnallocatedReportInput["locationBrokers"]>();
  input.locationBrokers.forEach((lb) => {
    if (!linksByBroker.has(lb.broker_id)) linksByBroker.set(lb.broker_id, []);
    linksByBroker.get(lb.broker_id)!.push(lb);
  });

  // dia → set de brokers alocados
  const allocatedByDate = new Map<string, Set<string>>();
  input.assignments.forEach((a) => {
    if (!allocatedByDate.has(a.assignment_date)) allocatedByDate.set(a.assignment_date, new Set());
    allocatedByDate.get(a.assignment_date)!.add(a.broker_id);
  });

  // diagnostics: brokerId → dateStr → motivos
  const rejectionsByBrokerDate = new Map<string, Map<string, Set<string>>>();
  const pushRejection = (brokerId: string, dateStr: string, text: string) => {
    if (!rejectionsByBrokerDate.has(brokerId)) rejectionsByBrokerDate.set(brokerId, new Map());
    const byDate = rejectionsByBrokerDate.get(brokerId)!;
    if (!byDate.has(dateStr)) byDate.set(dateStr, new Set());
    byDate.get(dateStr)!.add(text);
  };
  (input.diagnostics || []).forEach((d) => {
    d.opportunities?.forEach((o) => {
      pushRejection(d.brokerId, o.dateStr, `${o.locationName}: ${o.reason || o.rule}`);
    });
  });
  (input.eligibilityExclusions || []).forEach((e) => {
    e.exclusionDetails?.forEach((o) => {
      pushRejection(e.brokerId, o.dateStr, `${o.locationName}: ${o.reason}`);
    });
  });

  const activeBrokers = input.brokers.filter((b) => b.is_active !== false);
  const brokersWithGaps = new Set<string>();
  let unknownCount = 0;
  let excludedDays = 0;

  const days: UnallocatedDay[] = dates.map((date) => {
    const weekday = getWeekday(date);

    // Turnos abertos por local nesta data
    const openShiftsByLocation = new Map<string, Set<string>>();
    let anyExclusionToday = false;
    let exclusionReason: string | null = null;

    input.periods.forEach((p) => {
      if (date < p.start_date || date > p.end_date) return;
      const location = locationById.get(p.location_id);
      if (!location || location.is_active === false) return;

      const specific = specificByPeriod.get(p.id)?.get(date);
      const generic = dayConfigByPeriod.get(p.id)?.get(weekday);
      const config = specific || generic;
      if (!config) return;

      const shifts = new Set<string>();
      if (config.morning) shifts.add("morning");
      if (config.afternoon) shifts.add("afternoon");
      if (shifts.size === 0) return;

      const excluded = excludedByPeriod.get(p.id)?.get(date);
      if (excluded) {
        anyExclusionToday = true;
        if (!exclusionReason && excluded.reason) exclusionReason = excluded.reason;
        if (excluded.shifts === null) {
          return; // dia inteiro excluído neste período
        }
        excluded.shifts.forEach((s) => shifts.delete(s));
        if (shifts.size === 0) return;
      }

      if (!openShiftsByLocation.has(p.location_id)) openShiftsByLocation.set(p.location_id, new Set());
      const target = openShiftsByLocation.get(p.location_id)!;
      shifts.forEach((s) => target.add(s));
    });

    const openLocations = Array.from(openShiftsByLocation.keys()).map(
      (id) => locationById.get(id)?.name || id
    );

    const allocated = allocatedByDate.get(date) || new Set<string>();

    // Dia sem nenhum turno aberto → motivo único do dia
    if (openShiftsByLocation.size === 0) {
      const dayReason: UnallocatedReason = anyExclusionToday ? "excluded_date" : "no_shift_configured";
      if (dayReason === "excluded_date") excludedDays++;
      return {
        date,
        weekday,
        weekdayLabel: WEEKDAY_LABELS[weekday],
        fullyExcluded: true,
        dayReason,
        dayReasonDetail: exclusionReason,
        openLocations: [],
        brokers: [],
      };
    }

    if (anyExclusionToday) excludedDays++;

    const brokers: UnallocatedBrokerEntry[] = [];

    activeBrokers.forEach((broker) => {
      if (allocated.has(broker.id)) return;

      // Disponibilidade global
      const globalWeekdays = broker.available_weekdays || [];
      const globalShiftMap = shiftsFromAvailabilityMap(broker.weekday_shift_availability, weekday);
      const globalOk =
        globalShiftMap !== null
          ? globalShiftMap.length > 0
          : globalWeekdays.length === 0 || globalWeekdays.includes(weekday);

      if (!globalOk) {
        brokers.push({
          brokerId: broker.id,
          brokerName: broker.name,
          reason: "outside_availability",
          details: [`Sem disponibilidade global em ${WEEKDAY_LABELS[weekday].toLowerCase()}`],
        });
        brokersWithGaps.add(broker.id);
        return;
      }

      // Vínculos com locais que têm turno aberto hoje
      const links = linksByBroker.get(broker.id) || [];
      const usableLinks = links.filter((lb) => openShiftsByLocation.has(lb.location_id));

      if (usableLinks.length === 0) {
        brokers.push({
          brokerId: broker.id,
          brokerName: broker.name,
          reason: "no_linked_location",
          details:
            links.length === 0
              ? ["Corretor não está vinculado a nenhum local"]
              : ["Nenhum local vinculado tem turno aberto nesta data"],
        });
        brokersWithGaps.add(broker.id);
        return;
      }

      // Combinação turno aberto × disponibilidade local
      const matches: string[] = [];
      usableLinks.forEach((lb) => {
        const openShifts = openShiftsByLocation.get(lb.location_id)!;
        const localShiftMap = shiftsFromAvailabilityMap(lb.weekday_shift_availability, weekday);
        const localShifts =
          localShiftMap !== null
            ? new Set(localShiftMap)
            : new Set(
                [
                  lb.available_morning !== false ? "morning" : null,
                  lb.available_afternoon !== false ? "afternoon" : null,
                ].filter(Boolean) as string[]
              );
        const globalShifts = globalShiftMap !== null ? new Set(globalShiftMap) : null;

        openShifts.forEach((shift) => {
          if (!localShifts.has(shift)) return;
          if (globalShifts && !globalShifts.has(shift)) return;
          matches.push(`${locationById.get(lb.location_id)?.name || lb.location_id} (${shift === "morning" ? "manhã" : "tarde"})`);
        });
      });

      if (matches.length === 0) {
        brokers.push({
          brokerId: broker.id,
          brokerName: broker.name,
          reason: "outside_availability",
          details: ["Turnos abertos não coincidem com a disponibilidade do corretor neste dia"],
        });
        brokersWithGaps.add(broker.id);
        return;
      }

      const rejections = rejectionsByBrokerDate.get(broker.id)?.get(date);
      if (rejections && rejections.size > 0) {
        brokers.push({
          brokerId: broker.id,
          brokerName: broker.name,
          reason: "blocked_by_rule",
          details: Array.from(rejections).slice(0, 12),
        });
        brokersWithGaps.add(broker.id);
        return;
      }

      unknownCount++;
      brokersWithGaps.add(broker.id);
      brokers.push({
        brokerId: broker.id,
        brokerName: broker.name,
        reason: "unknown",
        details: [`Disponível para: ${matches.slice(0, 6).join(", ")}`],
      });
    });

    brokers.sort((a, b) => a.brokerName.localeCompare(b.brokerName));

    return {
      date,
      weekday,
      weekdayLabel: WEEKDAY_LABELS[weekday],
      fullyExcluded: false,
      dayReason: null,
      dayReasonDetail: anyExclusionToday ? exclusionReason : null,
      openLocations,
      brokers,
    };
  });

  return {
    days,
    summary: {
      totalDays: days.length,
      excludedDays,
      brokersWithGaps: brokersWithGaps.size,
      unknownCount,
    },
  };
}

export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
