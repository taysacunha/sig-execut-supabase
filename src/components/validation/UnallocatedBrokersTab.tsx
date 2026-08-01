import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CalendarOff, ChevronDown, ChevronRight, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { BrokerAllocationDiagnostic, EligibilityExclusion } from "@/lib/generationTrace";
import { useUnallocatedBrokersData } from "@/hooks/useUnallocatedBrokersData";
import {
  buildUnallocatedBrokerReport,
  formatDateBR,
  REASON_LABELS,
  UnallocatedReason,
} from "@/lib/unallocatedBrokersReport";

interface UnallocatedBrokersTabProps {
  scheduleId?: string;
  startDate?: string;
  endDate?: string;
  diagnostics?: BrokerAllocationDiagnostic[];
  eligibilityExclusions?: EligibilityExclusion[];
}

const reasonVariant: Record<UnallocatedReason, "default" | "secondary" | "destructive" | "outline"> = {
  excluded_date: "secondary",
  no_shift_configured: "secondary",
  outside_availability: "outline",
  no_linked_location: "outline",
  blocked_by_rule: "default",
  unknown: "destructive",
};

export function UnallocatedBrokersTab({
  scheduleId,
  startDate,
  endDate,
  diagnostics,
  eligibilityExclusions,
}: UnallocatedBrokersTabProps) {
  const [search, setSearch] = useState("");
  const [hideExcludedDays, setHideExcludedDays] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useUnallocatedBrokersData(scheduleId, startDate, endDate);

  const report = useMemo(() => {
    if (!data || !startDate || !endDate) return null;
    return buildUnallocatedBrokerReport({
      startDate,
      endDate,
      assignments: data.assignments as any,
      brokers: data.brokers as any,
      locationBrokers: data.locationBrokers as any,
      locations: data.locations as any,
      periods: data.periods as any,
      dayConfigs: data.dayConfigs as any,
      specificDayConfigs: data.specificDayConfigs as any,
      excludedDates: data.excludedDates as any,
      diagnostics,
      eligibilityExclusions,
    });
  }, [data, startDate, endDate, diagnostics, eligibilityExclusions]);

  if (!scheduleId || !startDate || !endDate) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Selecione uma escala salva para ver os corretores sem alocação por dia.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados da escala...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="text-center py-8 text-sm text-destructive">
        Não foi possível carregar os dados para este relatório.
      </div>
    );
  }

  const term = search.trim().toLowerCase();
  const days = report.days
    .map((day) => ({
      ...day,
      brokers: term ? day.brokers.filter((b) => b.brokerName.toLowerCase().includes(term)) : day.brokers,
    }))
    .filter((day) => {
      if (hideExcludedDays && day.fullyExcluded) return false;
      if (term) return day.brokers.length > 0;
      return true;
    });

  const toggle = (date: string) => {
    const next = new Set(expanded);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setExpanded(next);
  };

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard label="Dias analisados" value={report.summary.totalDays} />
        <SummaryCard label="Dias com exclusão" value={report.summary.excludedDays} />
        <SummaryCard label="Corretores com lacuna" value={report.summary.brokersWithGaps} />
        <SummaryCard
          label="Sem motivo identificado"
          value={report.summary.unknownCount}
          highlight={report.summary.unknownCount > 0}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por corretor..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button
          variant={hideExcludedDays ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setHideExcludedDays((v) => !v)}
        >
          <CalendarOff className="h-3 w-3 mr-1" />
          Ocultar dias excluídos
        </Button>
      </div>

      {days.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhum resultado para os filtros aplicados.
        </div>
      )}

      {days.map((day) => {
        const isOpen = expanded.has(day.date);
        const gapCount = day.brokers.length;
        return (
          <Collapsible key={day.date} open={isOpen} onOpenChange={() => toggle(day.date)}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 hover:bg-accent/50 transition-colors text-left">
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {day.weekdayLabel}, {formatDateBR(day.date)}
                  </span>
                  {day.fullyExcluded && day.dayReason && (
                    <Badge variant="secondary" className="text-[10px]">
                      {REASON_LABELS[day.dayReason]}
                      {day.dayReasonDetail ? ` — ${day.dayReasonDetail}` : ""}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!day.fullyExcluded && gapCount === 0 && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> Todos alocados
                    </span>
                  )}
                  {gapCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {gapCount} sem alocação
                    </Badge>
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 py-2 space-y-1.5">
                {day.fullyExcluded ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum local tinha turno aberto nesta data
                    {day.dayReason === "excluded_date"
                      ? " (data excluída/feriado nos períodos vigentes)."
                      : " (nenhum turno configurado)."}
                  </p>
                ) : (
                  <>
                    {day.openLocations.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Locais abertos: {day.openLocations.join(", ")}
                      </p>
                    )}
                    {day.dayReasonDetail && (
                      <p className="text-[11px] text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Exclusão parcial: {day.dayReasonDetail}
                      </p>
                    )}
                    {gapCount === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Todos os corretores ativos receberam plantão neste dia.
                      </p>
                    ) : (
                      day.brokers.map((b) => (
                        <div
                          key={b.brokerId}
                          className="rounded border bg-muted/30 px-2 py-1.5 flex flex-col gap-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{b.brokerName}</span>
                            <Badge variant={reasonVariant[b.reason]} className="text-[10px]">
                              {REASON_LABELS[b.reason]}
                            </Badge>
                          </div>
                          {b.details.length > 0 && (
                            <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                              {b.details.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-md border px-3 py-2 ${highlight ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
