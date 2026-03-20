import { useMemo, useRef, useState } from "react";
import { format, parseISO, eachDayOfInterval, isWithinInterval, isWeekend, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GozoPeriodo {
  id: string;
  ferias_id: string;
  tipo: string;
  referencia_periodo: number | null;
  numero: number;
  dias: number;
  data_inicio: string;
  data_fim: string;
}

interface Ferias {
  id: string;
  colaborador_id: string;
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio: string | null;
  quinzena2_fim: string | null;
  gozo_diferente: boolean;
  gozo_quinzena1_inicio: string | null;
  gozo_quinzena1_fim: string | null;
  gozo_quinzena2_inicio: string | null;
  gozo_quinzena2_fim: string | null;
  gozo_flexivel?: boolean;
  status: string;
  is_excecao: boolean;
  dias_vendidos: number | null;
  vender_dias: boolean;
  origem: string | null;
  colaborador?: {
    nome: string;
    setor?: { id: string; nome: string } | null;
    unidade?: { nome: string } | null;
  } | null;
  _gozoPeriodos?: GozoPeriodo[];
}

interface GanttFeriasViewProps {
  ferias: Ferias[];
  startDate: Date;
  endDate: Date;
  onSelectFerias?: (f: Ferias) => void;
}

// Palette for sectors
const SETOR_COLORS = [
  { bg: "hsl(210 80% 90%)", border: "hsl(210 80% 60%)", text: "hsl(210 80% 30%)" },
  { bg: "hsl(150 60% 88%)", border: "hsl(150 60% 50%)", text: "hsl(150 60% 25%)" },
  { bg: "hsl(30 90% 90%)", border: "hsl(30 90% 55%)", text: "hsl(30 90% 30%)" },
  { bg: "hsl(270 60% 90%)", border: "hsl(270 60% 55%)", text: "hsl(270 60% 30%)" },
  { bg: "hsl(0 70% 92%)", border: "hsl(0 70% 55%)", text: "hsl(0 70% 30%)" },
  { bg: "hsl(180 50% 88%)", border: "hsl(180 50% 45%)", text: "hsl(180 50% 25%)" },
  { bg: "hsl(60 70% 88%)", border: "hsl(60 70% 50%)", text: "hsl(60 70% 25%)" },
  { bg: "hsl(330 60% 90%)", border: "hsl(330 60% 55%)", text: "hsl(330 60% 30%)" },
];

const DAY_WIDTH = 28;
const ROW_HEIGHT = 36;
const NAME_COL_WIDTH = 200;

function getGozoIntervals(f: Ferias): Array<{ start: Date; end: Date }> {
  if (f.gozo_flexivel && f._gozoPeriodos && f._gozoPeriodos.length > 0) {
    return f._gozoPeriodos.map((p) => ({
      start: parseISO(p.data_inicio),
      end: parseISO(p.data_fim),
    }));
  }
  if (f.gozo_diferente) {
    const intervals: Array<{ start: Date; end: Date }> = [];
    if (f.gozo_quinzena1_inicio && f.gozo_quinzena1_fim) {
      intervals.push({ start: parseISO(f.gozo_quinzena1_inicio), end: parseISO(f.gozo_quinzena1_fim) });
    }
    if (f.gozo_quinzena2_inicio && f.gozo_quinzena2_fim) {
      intervals.push({ start: parseISO(f.gozo_quinzena2_inicio), end: parseISO(f.gozo_quinzena2_fim) });
    }
    return intervals;
  }
  const intervals = [{ start: parseISO(f.quinzena1_inicio), end: parseISO(f.quinzena1_fim) }];
  if (f.quinzena2_inicio && f.quinzena2_fim) {
    intervals.push({ start: parseISO(f.quinzena2_inicio), end: parseISO(f.quinzena2_fim) });
  }
  return intervals;
}

export function GanttFeriasView({ ferias, startDate, endDate, onSelectFerias }: GanttFeriasViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  const totalWidth = days.length * DAY_WIDTH;

  // Build sector color map
  const setorColorMap = useMemo(() => {
    const map = new Map<string, typeof SETOR_COLORS[0]>();
    const uniqueSetores = [...new Set(ferias.map(f => f.colaborador?.setor?.id).filter(Boolean))] as string[];
    uniqueSetores.forEach((id, idx) => {
      map.set(id, SETOR_COLORS[idx % SETOR_COLORS.length]);
    });
    return map;
  }, [ferias]);

  // Group by colaborador (merge multiple férias for same person)
  const rows = useMemo(() => {
    const map = new Map<string, { nome: string; setor: string; setorId: string; ferias: Ferias[] }>();
    ferias.forEach(f => {
      const colabId = f.colaborador_id;
      if (!map.has(colabId)) {
        map.set(colabId, {
          nome: f.colaborador?.nome || "Colaborador",
          setor: f.colaborador?.setor?.nome || "",
          setorId: f.colaborador?.setor?.id || "",
          ferias: [],
        });
      }
      map.get(colabId)!.ferias.push(f);
    });
    return Array.from(map.values()).sort((a, b) => a.setor.localeCompare(b.setor) || a.nome.localeCompare(b.nome));
  }, [ferias]);

  // Detect overlaps within same sector
  const overlappingSectors = useMemo(() => {
    const sectorIntervals = new Map<string, Array<{ start: Date; end: Date; colabId: string }>>();
    ferias.forEach(f => {
      const setorId = f.colaborador?.setor?.id || "";
      if (!setorId) return;
      if (!sectorIntervals.has(setorId)) sectorIntervals.set(setorId, []);
      getGozoIntervals(f).forEach(interval => {
        sectorIntervals.get(setorId)!.push({ ...interval, colabId: f.colaborador_id });
      });
    });

    const overlaps = new Set<string>();
    sectorIntervals.forEach((intervals) => {
      for (let i = 0; i < intervals.length; i++) {
        for (let j = i + 1; j < intervals.length; j++) {
          if (intervals[i].colabId !== intervals[j].colabId) {
            if (intervals[i].start <= intervals[j].end && intervals[j].start <= intervals[i].end) {
              overlaps.add(`${intervals[i].colabId}`);
              overlaps.add(`${intervals[j].colabId}`);
            }
          }
        }
      }
    });
    return overlaps;
  }, [ferias]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <p>Nenhuma férias para o período selecionado</p>
      </div>
    );
  }

  // Month headers
  const monthHeaders = useMemo(() => {
    const headers: Array<{ label: string; startIdx: number; span: number }> = [];
    let currentMonth = "";
    let currentStart = 0;
    let currentSpan = 0;
    days.forEach((day, idx) => {
      const monthKey = format(day, "yyyy-MM");
      if (monthKey !== currentMonth) {
        if (currentSpan > 0) {
          headers.push({ label: format(days[currentStart], "MMM yyyy", { locale: ptBR }), startIdx: currentStart, span: currentSpan });
        }
        currentMonth = monthKey;
        currentStart = idx;
        currentSpan = 1;
      } else {
        currentSpan++;
      }
    });
    if (currentSpan > 0) {
      headers.push({ label: format(days[currentStart], "MMM yyyy", { locale: ptBR }), startIdx: currentStart, span: currentSpan });
    }
    return headers;
  }, [days]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="flex">
          {/* Fixed name column */}
          <div className="shrink-0 border-r bg-muted/30" style={{ width: NAME_COL_WIDTH }}>
            {/* Header spacer */}
            <div className="h-[52px] border-b flex items-end px-2 pb-1">
              <span className="text-xs font-medium text-muted-foreground">Colaborador</span>
            </div>
            {/* Names */}
            {rows.map((row, idx) => {
              const colors = setorColorMap.get(row.setorId);
              const hasOverlap = overlappingSectors.has(row.ferias[0]?.colaborador_id);
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 px-2 border-b ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium truncate flex items-center gap-1">
                      {row.nome}
                      {hasOverlap && (
                        <span className="inline-block w-2 h-2 rounded-full bg-destructive shrink-0" title="Sobreposição com outro colaborador do mesmo setor" />
                      )}
                    </span>
                    {row.setor && (
                      <span
                        className="text-[10px] truncate"
                        style={{ color: colors?.text || "hsl(var(--muted-foreground))" }}
                      >
                        {row.setor}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline */}
          <div className="overflow-x-auto flex-1" ref={scrollRef}>
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              {/* Month + Day headers */}
              <div className="border-b">
                {/* Month row */}
                <div className="flex" style={{ height: 24 }}>
                  {monthHeaders.map((mh, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] font-semibold text-center border-r text-muted-foreground capitalize flex items-center justify-center"
                      style={{ width: mh.span * DAY_WIDTH }}
                    >
                      {mh.label}
                    </div>
                  ))}
                </div>
                {/* Day numbers */}
                <div className="flex" style={{ height: 28 }}>
                  {days.map((day, idx) => {
                    const weekend = isWeekend(day);
                    return (
                      <div
                        key={idx}
                        className={`text-[10px] text-center flex items-center justify-center border-r ${
                          weekend ? "bg-muted/50 text-muted-foreground font-bold" : "text-muted-foreground"
                        }`}
                        style={{ width: DAY_WIDTH }}
                      >
                        {format(day, "d")}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows with bars */}
              {rows.map((row, rowIdx) => {
                const colors = setorColorMap.get(row.setorId) || SETOR_COLORS[0];
                const hasOverlap = overlappingSectors.has(row.ferias[0]?.colaborador_id);

                return (
                  <div
                    key={rowIdx}
                    className={`relative border-b ${rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Weekend columns */}
                    {days.map((day, dayIdx) => (
                      isWeekend(day) && (
                        <div
                          key={dayIdx}
                          className="absolute top-0 bottom-0 bg-muted/30"
                          style={{ left: dayIdx * DAY_WIDTH, width: DAY_WIDTH }}
                        />
                      )
                    ))}

                    {/* Bars */}
                    {row.ferias.map(f => {
                      const intervals = getGozoIntervals(f);
                      return intervals.map((interval, intIdx) => {
                        const barStartDays = differenceInDays(interval.start, startDate);
                        const barEndDays = differenceInDays(interval.end, startDate);

                        // Clamp to visible range
                        const clampedStart = Math.max(0, barStartDays);
                        const clampedEnd = Math.min(days.length - 1, barEndDays);

                        if (clampedStart > days.length - 1 || clampedEnd < 0) return null;

                        const left = clampedStart * DAY_WIDTH;
                        const width = (clampedEnd - clampedStart + 1) * DAY_WIDTH;
                        const totalDias = differenceInDays(interval.end, interval.start) + 1;

                        return (
                          <Tooltip key={`${f.id}-${intIdx}`}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute top-1 cursor-pointer rounded-sm transition-opacity hover:opacity-80"
                                style={{
                                  left,
                                  width,
                                  height: ROW_HEIGHT - 8,
                                  backgroundColor: colors.bg,
                                  borderLeft: `3px solid ${colors.border}`,
                                  borderRight: hasOverlap ? "3px solid hsl(0 70% 55%)" : undefined,
                                  boxShadow: hasOverlap ? "0 0 0 1px hsl(0 70% 55% / 0.3)" : undefined,
                                }}
                                onClick={() => onSelectFerias?.(f)}
                              >
                                <span
                                  className="text-[10px] font-medium px-1 truncate block leading-[28px]"
                                  style={{ color: colors.text }}
                                >
                                  {totalDias}d
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-semibold">{row.nome}</div>
                                <div className="text-xs">
                                  {row.setor && <span className="text-muted-foreground">{row.setor} • </span>}
                                  {format(interval.start, "dd/MM/yyyy")} a {format(interval.end, "dd/MM/yyyy")} ({totalDias} dias)
                                </div>
                                {f.vender_dias && f.dias_vendidos ? (
                                  <div className="text-xs text-primary">{f.dias_vendidos} dias vendidos</div>
                                ) : null}
                                {f.is_excecao && <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">Exceção</Badge>}
                                {hasOverlap && (
                                  <div className="text-xs text-destructive font-medium">⚠ Sobreposição com colega do mesmo setor</div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      });
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="p-2 border-t bg-muted/20 flex flex-wrap gap-3 items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted/50 border" />
            <span>Fim de semana</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(210 80% 90%)", borderLeft: "3px solid hsl(210 80% 60%)" }} />
            <span>Período de gozo</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
            <span>Sobreposição no setor</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
