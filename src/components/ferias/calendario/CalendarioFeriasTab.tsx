import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, AlertCircle, Users, Palmtree, BarChart3, List, Search } from "lucide-react";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GanttFeriasView } from "./GanttFeriasView";
import { getYearOptions } from "@/lib/dateUtils";
import { MultiSelect } from "@/components/ui/multi-select";

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
  // Attached flexible periods
  _gozoPeriodos?: GozoPeriodo[];
}

interface Setor {
  id: string;
  nome: string;
}

interface Unidade {
  id: string;
  nome: string;
}

export function CalendarioFeriasTab() {
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedUnidade, setSelectedUnidade] = useState<string>("all");
  const [selectedSetores, setSelectedSetores] = useState<string[]>([]);
  const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
  const [selectedFerias, setSelectedFerias] = useState<Ferias | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"lista" | "gantt">("lista");
  const [searchNome, setSearchNome] = useState("");
  const [ganttMonths, setGanttMonths] = useState<string[]>([]); // empty = current month only
  const [ganttYear, setGanttYear] = useState(new Date().getFullYear());

  // Buscar férias
  const { data: ferias = [], isLoading: loadingFerias } = useQuery({
    queryKey: ["ferias-calendario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select(`
          id,
          colaborador_id,
          quinzena1_inicio,
          quinzena1_fim,
          quinzena2_inicio,
          quinzena2_fim,
          gozo_diferente,
          gozo_quinzena1_inicio,
          gozo_quinzena1_fim,
          gozo_quinzena2_inicio,
          gozo_quinzena2_fim,
          status,
          is_excecao,
          dias_vendidos,
          vender_dias,
          origem,
          colaborador:ferias_colaboradores!ferias_ferias_colaborador_id_fkey(
            nome,
            setor:ferias_setores!ferias_colaboradores_setor_titular_id_fkey(id, nome),
            unidade:ferias_unidades(nome)
          )
        `)
        .in("status", ["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "concluida", "em_gozo"])
        .order("quinzena1_inicio");

      if (error) throw error;

      // Try to fetch gozo_flexivel column - may not exist yet
      let feriasWithFlexivel = (data || []) as any[];
      try {
        const ids = feriasWithFlexivel.map((f: any) => f.id);
        if (ids.length > 0) {
          const { data: gozoPeriodos } = await supabase
            .from("ferias_gozo_periodos" as any)
            .select("*")
            .in("ferias_id", ids)
            .order("numero");

          if (gozoPeriodos && gozoPeriodos.length > 0) {
            const periodosByFerias: Record<string, GozoPeriodo[]> = {};
            for (const p of gozoPeriodos as any[]) {
              if (!periodosByFerias[p.ferias_id]) periodosByFerias[p.ferias_id] = [];
              periodosByFerias[p.ferias_id].push(p);
            }
            feriasWithFlexivel = feriasWithFlexivel.map((f: any) => ({
              ...f,
              gozo_flexivel: !!periodosByFerias[f.id],
              _gozoPeriodos: periodosByFerias[f.id] || [],
            }));
          }
        }
      } catch {
        // Table doesn't exist yet, ignore
      }

      return feriasWithFlexivel as Ferias[];
    },
  });

  // Buscar setores
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-calendario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as Setor[];
    },
  });

  // Buscar unidades
  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-calendario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_unidades")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  // Build colaborador options for multi-select
  const colaboradorOptions = useMemo(() => {
    const map = new Map<string, string>();
    ferias.forEach((f) => {
      if (f.colaborador_id && f.colaborador?.nome) {
        map.set(f.colaborador_id, f.colaborador.nome);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ferias]);

  // Filtrar férias
  const feriasFiltradas = useMemo(() => {
    return ferias.filter((f) => {
      if (selectedSetores.length > 0 && !selectedSetores.includes(f.colaborador?.setor?.id || "")) {
        return false;
      }
      if (selectedUnidade !== "all" && f.colaborador?.unidade?.nome !== unidades.find(u => u.id === selectedUnidade)?.nome) {
        return false;
      }
      if (selectedColaboradores.length > 0 && !selectedColaboradores.includes(f.colaborador_id)) {
        return false;
      }
      if (searchNome) {
        const nome = f.colaborador?.nome?.toLowerCase() || "";
        if (!nome.includes(searchNome.toLowerCase())) return false;
      }
      return true;
    });
  }, [ferias, selectedSetores, selectedUnidade, selectedColaboradores, searchNome, unidades]);

  // Gantt date range — based on selected months or full year
  const ganttRange = useMemo(() => {
    if (ganttMonths.includes("year")) {
      return { start: new Date(ganttYear, 0, 1), end: new Date(ganttYear, 11, 31) };
    }
    if (ganttMonths.length === 0) {
      // Default: current calendar month
      return { start: startOfMonth(calendarMonth), end: endOfMonth(calendarMonth) };
    }
    // Parse selected months (format: "0" to "11") and build range
    const monthNums = ganttMonths.map(Number).sort((a, b) => a - b);
    const minMonth = monthNums[0];
    const maxMonth = monthNums[monthNums.length - 1];
    return {
      start: new Date(ganttYear, minMonth, 1),
      end: endOfMonth(new Date(ganttYear, maxMonth, 1)),
    };
  }, [calendarMonth, ganttMonths, ganttYear]);

  // Get all gozo intervals for a given ferias
  const getGozoIntervals = (f: Ferias): Array<{ start: Date; end: Date }> => {
    // Flexible periods take priority
    if (f.gozo_flexivel && f._gozoPeriodos && f._gozoPeriodos.length > 0) {
      return f._gozoPeriodos.map((p) => ({
        start: parseISO(p.data_inicio),
        end: parseISO(p.data_fim),
      }));
    }

    // Legacy: gozo_diferente
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

    // Default: official periods
    const intervals = [
      { start: parseISO(f.quinzena1_inicio), end: parseISO(f.quinzena1_fim) },
    ];
    if (f.quinzena2_inicio && f.quinzena2_fim) {
      intervals.push({ start: parseISO(f.quinzena2_inicio), end: parseISO(f.quinzena2_fim) });
    }
    return intervals;
  };

  // Férias that overlap the gantt range
  const feriasGantt = useMemo(() => {
    return feriasFiltradas.filter((f) => {
      const intervals = getGozoIntervals(f);
      return intervals.some((interval) =>
        interval.start <= ganttRange.end && interval.end >= ganttRange.start
      );
    });
  }, [feriasFiltradas, ganttRange]);

  // Legacy helper for dialog display
  const getGozoDates = (f: Ferias) => {
    if (f.gozo_diferente) {
      return {
        q1Start: f.gozo_quinzena1_inicio ? parseISO(f.gozo_quinzena1_inicio) : null,
        q1End: f.gozo_quinzena1_fim ? parseISO(f.gozo_quinzena1_fim) : null,
        q2Start: f.gozo_quinzena2_inicio ? parseISO(f.gozo_quinzena2_inicio) : null,
        q2End: f.gozo_quinzena2_fim ? parseISO(f.gozo_quinzena2_fim) : null,
      };
    }
    return {
      q1Start: parseISO(f.quinzena1_inicio),
      q1End: parseISO(f.quinzena1_fim),
      q2Start: parseISO(f.quinzena2_inicio),
      q2End: parseISO(f.quinzena2_fim),
    };
  };

  // Dias com férias no mês do calendário
  const diasComFerias = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const allDays = eachDayOfInterval({ start, end });

    return allDays.filter((day) => {
      return feriasFiltradas.some((f) => {
        const intervals = getGozoIntervals(f);
        return intervals.some((interval) =>
          isWithinInterval(day, { start: interval.start, end: interval.end })
        );
      });
    });
  }, [feriasFiltradas, calendarMonth]);

  // Férias no mês selecionado
  const feriasDoMes = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);

    return feriasFiltradas.filter((f) => {
      const intervals = getGozoIntervals(f);
      return intervals.some((interval) =>
        isWithinInterval(monthStart, { start: interval.start, end: interval.end }) ||
        isWithinInterval(monthEnd, { start: interval.start, end: interval.end }) ||
        isWithinInterval(interval.start, { start: monthStart, end: monthEnd })
      );
    });
  }, [feriasFiltradas, calendarMonth]);

  const handleDayClick = (day: Date) => {
    const feriasNoDia = feriasFiltradas.filter((f) => {
      const intervals = getGozoIntervals(f);
      return intervals.some((interval) =>
        isWithinInterval(day, { start: interval.start, end: interval.end })
      );
    });

    if (feriasNoDia.length > 0) {
      setSelectedFerias(feriasNoDia[0]);
      setDetailsOpen(true);
    }
  };

  // Stats
  const totalFeriasAno = ferias.filter((f) => {
    const intervals = getGozoIntervals(f);
    const currentYear = new Date().getFullYear();
    return intervals.some((i) => i.start.getFullYear() === currentYear);
  }).length;

  const feriasEmGozo = ferias.filter((f) => ["em_gozo_q1", "em_gozo_q2", "em_gozo"].includes(f.status)).length;
  const feriasComExcecao = ferias.filter((f) => f.is_excecao).length;

  const loading = loadingFerias;

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total no Ano</CardTitle>
            <Palmtree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{totalFeriasAno}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Gozo</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-primary">{feriasEmGozo}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{feriasDoMes.length}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Exceção</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-orange-500">{feriasComExcecao}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View toggle + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          <Button
            variant={viewMode === "lista" ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setViewMode("lista")}
          >
            <List className="h-4 w-4" />
            Lista
          </Button>
          <Button
            variant={viewMode === "gantt" ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setViewMode("gantt")}
          >
            <BarChart3 className="h-4 w-4" />
            Gantt
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchNome}
              onChange={e => setSearchNome(e.target.value)}
              className="pl-8 h-9 w-full sm:w-[200px]"
            />
          </div>
          <Select value={selectedSetor} onValueChange={setSelectedSetor}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {viewMode === "gantt" && (
            <Select value={ganttMonths} onValueChange={setGanttMonths}>
              <SelectTrigger className="w-full sm:w-[120px] h-9">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mês</SelectItem>
                <SelectItem value="2">2 meses</SelectItem>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">Ano inteiro</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {viewMode === "lista" ? (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendário */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Calendário de Férias</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={ptBR}
              className="rounded-md border pointer-events-auto"
              modifiers={{
                vacation: diasComFerias,
              }}
              modifiersStyles={{
                vacation: {
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  fontWeight: "bold",
                  borderRadius: "50%",
                },
              }}
              onDayClick={handleDayClick}
            />
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full bg-primary" />
              <span>Dias com férias</span>
            </div>
          </CardContent>
        </Card>

        {/* Lista filtrada */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              Férias em {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : feriasDoMes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Palmtree className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma férias neste mês</p>
                <p className="text-sm text-muted-foreground/70">
                  Navegue pelo calendário para ver outros meses
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {feriasDoMes.map((f) => {
                  const intervals = getGozoIntervals(f);
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                        f.is_excecao ? "border-orange-300 bg-orange-50/50" : ""
                      }`}
                      onClick={() => {
                        setSelectedFerias(f);
                        setDetailsOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <p className="font-medium flex items-center gap-2">
                            {f.colaborador?.nome || "Colaborador"}
                            {f.is_excecao && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                Exceção
                              </Badge>
                            )}
                            {f.origem === "gerada" && (
                              <Badge variant="secondary" className="text-xs">
                                Gerada
                              </Badge>
                            )}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            {intervals.map((interval, idx) => (
                              <span key={idx}>
                                {idx > 0 && "• "}
                                {idx + 1}ª: {format(interval.start, "dd/MM")} - {format(interval.end, "dd/MM")}
                              </span>
                            ))}
                            {f.vender_dias && f.dias_vendidos && (
                              <>
                                <span>•</span>
                                <span className="text-primary">{f.dias_vendidos} dias vendidos</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          ["em_gozo_q1", "em_gozo_q2", "em_gozo"].includes(f.status)
                            ? "default"
                            : f.status === "aprovada"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {f.status === "em_gozo_q1"
                          ? "Em Gozo - 1º"
                          : f.status === "em_gozo_q2"
                          ? "Em Gozo - 2º"
                          : f.status === "q1_concluida"
                          ? "1º Concluído"
                          : f.status === "em_gozo"
                          ? "Em Gozo"
                          : f.status === "aprovada"
                          ? "Aprovada"
                          : f.status === "concluida"
                          ? "Concluída"
                          : f.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      ) : (
        <GanttFeriasView
          ferias={feriasGantt}
          startDate={ganttRange.start}
          endDate={ganttRange.end}
          onSelectFerias={(f) => {
            setSelectedFerias(f);
            setDetailsOpen(true);
          }}
        />
      )}

      {/* Dialog de detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Férias</DialogTitle>
          </DialogHeader>
          {selectedFerias && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Colaborador</Label>
                <p className="font-medium">{selectedFerias.colaborador?.nome}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Setor</Label>
                  <p className="font-medium">
                    {selectedFerias.colaborador?.setor?.nome || "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className="mt-1">
                    {selectedFerias.status === "em_gozo_q1"
                      ? "Em Gozo - 1º Período"
                      : selectedFerias.status === "em_gozo_q2"
                      ? "Em Gozo - 2º Período"
                      : selectedFerias.status === "q1_concluida"
                      ? "1º Período Concluído"
                      : selectedFerias.status === "em_gozo"
                      ? "Em Gozo"
                      : selectedFerias.status === "aprovada"
                      ? "Aprovada"
                      : selectedFerias.status}
                  </Badge>
                </div>
              </div>

              {/* Flexible periods */}
              {selectedFerias.gozo_flexivel && selectedFerias._gozoPeriodos && selectedFerias._gozoPeriodos.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Períodos de Gozo</Label>
                  {selectedFerias._gozoPeriodos.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-center justify-between text-sm p-2 rounded bg-primary/5 border border-primary/10">
                      <span>{p.dias} dias</span>
                      <span>{format(parseISO(p.data_inicio), "dd/MM/yyyy")} a {format(parseISO(p.data_fim), "dd/MM/yyyy")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-muted-foreground">1ª Quinzena (Gozo)</Label>
                    <p className="font-medium">
                      {(() => {
                        const dates = getGozoDates(selectedFerias);
                        if (dates.q1Start && dates.q1End) {
                          return `${format(dates.q1Start, "dd/MM/yyyy")} a ${format(dates.q1End, "dd/MM/yyyy")}`;
                        }
                        return "-";
                      })()}
                    </p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">2ª Quinzena (Gozo)</Label>
                    <p className="font-medium">
                      {(() => {
                        const dates = getGozoDates(selectedFerias);
                        if (dates.q2Start && dates.q2End) {
                          return `${format(dates.q2Start, "dd/MM/yyyy")} a ${format(dates.q2End, "dd/MM/yyyy")}`;
                        }
                        return "-";
                      })()}
                    </p>
                  </div>
                </>
              )}

              {selectedFerias.gozo_diferente && !selectedFerias.gozo_flexivel && (
                <div>
                  <Label className="text-muted-foreground">Período Contador</Label>
                  <p className="text-sm text-muted-foreground">
                    1ª: {format(parseISO(selectedFerias.quinzena1_inicio), "dd/MM")} -{" "}
                    {format(parseISO(selectedFerias.quinzena1_fim), "dd/MM")} | 2ª:{" "}
                    {format(parseISO(selectedFerias.quinzena2_inicio), "dd/MM")} -{" "}
                    {format(parseISO(selectedFerias.quinzena2_fim), "dd/MM")}
                  </p>
                </div>
              )}

              {selectedFerias.vender_dias && selectedFerias.dias_vendidos && (
                <div>
                  <Label className="text-muted-foreground">Dias Vendidos</Label>
                  <p className="font-medium text-primary">
                    {selectedFerias.dias_vendidos} dias
                  </p>
                </div>
              )}

              {selectedFerias.is_excecao && (
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <Label className="text-orange-600">⚠️ Exceção</Label>
                  <p className="text-sm text-orange-700">
                    Esta férias foi cadastrada como exceção às regras.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Origem</Label>
                <Badge variant="outline">
                  {selectedFerias.origem === "gerada" ? "Geração Automática" : "Cadastro Manual"}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
