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
import { CalendarDays, Users, CheckCircle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO, startOfMonth, endOfMonth, isSaturday, eachDayOfInterval, isSameDay, getMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Folga {
  id: string;
  data_sabado: string;
  colaborador_id: string;
  is_excecao: boolean;
  excecao_motivo: string | null;
  excecao_justificativa: string | null;
  colaborador?: {
    nome: string;
    setor?: { id: string; nome: string } | null;
  } | null;
}

interface Setor {
  id: string;
  nome: string;
}

export function CalendarioFolgasTab() {
  const currentDate = new Date();
  const [calendarMonth, setCalendarMonth] = useState<Date>(currentDate);
  const [selectedSetor, setSelectedSetor] = useState<string>("all");
  const [selectedFolga, setSelectedFolga] = useState<Folga | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Buscar folgas
  const { data: folgas = [], isLoading: loadingFolgas } = useQuery({
    queryKey: ["folgas-calendario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_folgas")
        .select(`
          id,
          data_sabado,
          colaborador_id,
          is_excecao,
          excecao_motivo,
          excecao_justificativa,
          colaborador:ferias_colaboradores!ferias_folgas_colaborador_id_fkey(
            nome,
            setor:ferias_setores!ferias_colaboradores_setor_titular_id_fkey(id, nome)
          )
        `)
        .order("data_sabado");

      if (error) throw error;
      return data as Folga[];
    },
  });

  // Buscar setores
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-calendario-folgas"],
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

  // Filtrar folgas
  const folgasFiltradas = useMemo(() => {
    return folgas.filter((f) => {
      if (selectedSetor !== "all" && f.colaborador?.setor?.id !== selectedSetor) {
        return false;
      }
      return true;
    });
  }, [folgas, selectedSetor]);

  // Sábados com folga no mês
  const sabadosComFolga = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const allDays = eachDayOfInterval({ start, end });
    const saturdays = allDays.filter(isSaturday);

    return saturdays.filter((sat) => {
      const satStr = format(sat, "yyyy-MM-dd");
      return folgasFiltradas.some((f) => f.data_sabado === satStr);
    });
  }, [folgasFiltradas, calendarMonth]);

  // Folgas do mês
  const folgasDoMes = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);

    return folgasFiltradas.filter((f) => {
      const folgaDate = parseISO(f.data_sabado);
      return folgaDate >= monthStart && folgaDate <= monthEnd;
    });
  }, [folgasFiltradas, calendarMonth]);

  // Agrupar folgas por data
  const folgasAgrupadas = useMemo(() => {
    const grouped = new Map<string, Folga[]>();
    folgasDoMes.forEach((f) => {
      const existing = grouped.get(f.data_sabado) || [];
      grouped.set(f.data_sabado, [...existing, f]);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [folgasDoMes]);

  const handleDayClick = (day: Date) => {
    if (!isSaturday(day)) return;

    const dayStr = format(day, "yyyy-MM-dd");
    const folgasNoDia = folgasFiltradas.filter((f) => f.data_sabado === dayStr);

    if (folgasNoDia.length === 1) {
      setSelectedFolga(folgasNoDia[0]);
      setDetailsOpen(true);
    }
  };

  // Stats
  const totalFolgasMes = folgasDoMes.length;
  const folgasExcecaoMes = folgasDoMes.filter((f) => f.is_excecao).length;
  const sabadosNoMes = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    return eachDayOfInterval({ start, end }).filter(isSaturday).length;
  }, [calendarMonth]);

  const loading = loadingFolgas;

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sábados no Mês</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sabadosNoMes}</div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Folgas Agendadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-primary">{totalFolgasMes}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {new Set(folgasDoMes.map((f) => f.colaborador_id)).size}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceções</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-orange-500">{folgasExcecaoMes}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendário */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Calendário de Folgas</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={ptBR}
              className="rounded-md border pointer-events-auto"
              modifiers={{
                saturday: sabadosComFolga,
              }}
              modifiersStyles={{
                saturday: {
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
              <span>Sábados com folga</span>
            </div>
          </CardContent>
        </Card>

        {/* Lista de folgas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">
                Folgas em {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : folgasAgrupadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma folga neste mês</p>
                <p className="text-sm text-muted-foreground/70">
                  Navegue pelo calendário para ver outros meses
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {folgasAgrupadas.map(([data, folgasDoDia]) => (
                  <div key={data} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {format(parseISO(data), "EEEE, dd/MM", { locale: ptBR })}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {folgasDoDia.length} colaborador{folgasDoDia.length > 1 ? "es" : ""}
                      </span>
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <div className="flex flex-wrap gap-2">
                        {folgasDoDia.map((f) => {
                          const motivo = f.excecao_motivo || "";
                          const isConflito = /conflito|falha/i.test(motivo);
                          const badge = (
                            <Badge
                              variant={f.is_excecao ? "outline" : "secondary"}
                              className={`cursor-pointer hover:bg-primary/10 inline-flex items-center gap-1 ${
                                f.is_excecao
                                  ? isConflito
                                    ? "border-orange-400 text-orange-700"
                                    : "border-muted-foreground/30 text-foreground"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedFolga(f);
                                setDetailsOpen(true);
                              }}
                            >
                              <span>{f.colaborador?.nome || "Colaborador"}</span>
                              {f.is_excecao && (
                                <AlertCircle
                                  className={`h-3 w-3 ${isConflito ? "text-orange-500" : "text-muted-foreground"}`}
                                />
                              )}
                            </Badge>
                          );
                          if (!f.is_excecao) return <div key={f.id}>{badge}</div>;
                          return (
                            <Tooltip key={f.id}>
                              <TooltipTrigger asChild>{badge}</TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
                                {f.excecao_motivo && (
                                  <div><strong>Motivo:</strong> {f.excecao_motivo}</div>
                                )}
                                {f.excecao_justificativa && (
                                  <div><strong>Justificativa:</strong> {f.excecao_justificativa}</div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Folga</DialogTitle>
          </DialogHeader>
          {selectedFolga && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Colaborador</Label>
                <p className="font-medium">{selectedFolga.colaborador?.nome}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Data</Label>
                  <p className="font-medium">
                    {format(parseISO(selectedFolga.data_sabado), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Setor</Label>
                  <p className="font-medium">
                    {selectedFolga.colaborador?.setor?.nome || "-"}
                  </p>
                </div>
              </div>

              {selectedFolga.is_excecao && (
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <Label className="text-orange-600">⚠️ Exceção</Label>
                  {selectedFolga.excecao_motivo && (
                    <p className="text-sm text-orange-700 mt-1">
                      <strong>Motivo:</strong> {selectedFolga.excecao_motivo}
                    </p>
                  )}
                  {selectedFolga.excecao_justificativa && (
                    <p className="text-sm text-orange-700 mt-1">
                      <strong>Justificativa:</strong> {selectedFolga.excecao_justificativa}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
