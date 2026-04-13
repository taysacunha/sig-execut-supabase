import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, CalendarDays, Cake, AlertTriangle, Clock, User, AlertCircle, Bell } from "lucide-react";
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, addYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function FeriasDashboard() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const in30Days = addDays(today, 30);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const feriasDashboardStatuses = ["pendente", "ativa", "aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_gozo", "concluida"];

  const buildGozoPeriodosMap = (periodos: Array<{ ferias_id: string; data_inicio: string; data_fim: string }>) => {
    const periodosMap: Record<string, Array<{ data_inicio: string; data_fim: string }>> = {};

    for (const periodo of periodos) {
      if (!periodosMap[periodo.ferias_id]) {
        periodosMap[periodo.ferias_id] = [];
      }

      periodosMap[periodo.ferias_id].push({
        data_inicio: periodo.data_inicio,
        data_fim: periodo.data_fim,
      });
    }

    return periodosMap;
  };

  const getResolvedVacationPeriods = (
    ferias: any,
    gozoPeriodosMap: Record<string, Array<{ data_inicio: string; data_fim: string }>>,
  ) => {
    const periodosFlexiveis = gozoPeriodosMap[ferias.id];

    if (periodosFlexiveis?.length) {
      return periodosFlexiveis;
    }

    if (ferias.gozo_diferente) {
      return [
        ferias.gozo_quinzena1_inicio && ferias.gozo_quinzena1_fim
          ? { data_inicio: ferias.gozo_quinzena1_inicio, data_fim: ferias.gozo_quinzena1_fim }
          : null,
        ferias.gozo_quinzena2_inicio && ferias.gozo_quinzena2_fim
          ? { data_inicio: ferias.gozo_quinzena2_inicio, data_fim: ferias.gozo_quinzena2_fim }
          : null,
      ].filter(Boolean) as Array<{ data_inicio: string; data_fim: string }>;
    }

    return [
      ferias.quinzena1_inicio && ferias.quinzena1_fim
        ? { data_inicio: ferias.quinzena1_inicio, data_fim: ferias.quinzena1_fim }
        : null,
      ferias.quinzena2_inicio && ferias.quinzena2_fim
        ? { data_inicio: ferias.quinzena2_inicio, data_fim: ferias.quinzena2_fim }
        : null,
    ].filter(Boolean) as Array<{ data_inicio: string; data_fim: string }>;
  };

  const getResolvedVacationStarts = (
    ferias: any,
    gozoPeriodosMap: Record<string, Array<{ data_inicio: string; data_fim: string }>>,
  ) => getResolvedVacationPeriods(ferias, gozoPeriodosMap).map((periodo) => periodo.data_inicio);

  // Colaboradores ativos
  const { data: colaboradoresAtivos = 0, isLoading: loadingColaboradores } = useQuery({
    queryKey: ["ferias-dashboard-colaboradores"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ferias_colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativo");
      if (error) throw error;
      return count || 0;
    },
  });

  // Férias este mês (colaboradores com quinzena de gozo no mês atual)
  const { data: feriasEsteMes = [], isLoading: loadingFerias } = useQuery({
    queryKey: ["ferias-dashboard-ferias-mes"],
    queryFn: async () => {
      // Atualizar status antes de buscar
      await supabase.rpc("atualizar_status_ferias");
      
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select(`
          id,
          gozo_flexivel,
          quinzena1_inicio,
          quinzena1_fim,
          quinzena2_inicio,
          quinzena2_fim,
          gozo_diferente,
          gozo_quinzena1_inicio,
          gozo_quinzena1_fim,
          gozo_quinzena2_inicio,
          gozo_quinzena2_fim,
          ferias_colaboradores(nome)
        `)
        .in("status", feriasDashboardStatuses)
        .range(0, 5000);
      if (error) throw error;
      
       const feriasIds = (data || []).map((f: any) => f.id);
       let gozoPeriodosMap: Record<string, Array<{ data_inicio: string; data_fim: string }>> = {};
       if (feriasIds.length > 0) {
        const { data: periodos } = await supabase
          .from("ferias_gozo_periodos")
          .select("ferias_id, data_inicio, data_fim")
           .in("ferias_id", feriasIds)
           .range(0, 5000);
         gozoPeriodosMap = buildGozoPeriodosMap(periodos || []);
      }
      
      // Filter vacations that overlap with current month
      const monthStartStr = format(monthStart, "yyyy-MM-dd");
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");
      
      return (data || []).filter((f: any) => {
         return getResolvedVacationPeriods(f, gozoPeriodosMap).some(
           (periodo) => periodo.data_inicio <= monthEndStr && periodo.data_fim >= monthStartStr,
         );
      });
    },
  });

  // Folgas de sábado este mês
  const { data: folgasEsteMes = 0, isLoading: loadingFolgas } = useQuery({
    queryKey: ["ferias-dashboard-folgas-mes"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ferias_folgas")
        .select("*", { count: "exact", head: true })
        .gte("data_sabado", format(monthStart, "yyyy-MM-dd"))
        .lte("data_sabado", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return count || 0;
    },
  });

  // Aniversariantes do mês (merge ferias_colaboradores + sales_brokers)
  const { data: aniversariantes = [], isLoading: loadingAniversariantes } = useQuery({
    queryKey: ["ferias-dashboard-aniversariantes", currentMonth],
    queryFn: async () => {
      // Source 1: ferias_colaboradores
      const { data: colabs, error: e1 } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, data_nascimento")
        .eq("status", "ativo");
      if (e1) throw e1;

      // Source 2: sales_brokers
      const { data: brokers, error: e2 } = await supabase
        .from("sales_brokers")
        .select("id, name, birth_date")
        .eq("is_active", true)
        .not("birth_date", "is", null);
      if (e2) throw e2;

      const colabIds = new Set((colabs || []).map(c => c.id));

      const fromColabs = (colabs || [])
        .filter((c: any) => new Date(c.data_nascimento + "T00:00:00").getMonth() + 1 === currentMonth)
        .map((c: any) => ({ id: c.id, nome: c.nome, data_nascimento: c.data_nascimento }));

      const fromBrokers = (brokers || [])
        .filter((b: any) => !colabIds.has(b.id) && new Date(b.birth_date + "T00:00:00").getMonth() + 1 === currentMonth)
        .map((b: any) => ({ id: b.id, nome: b.name, data_nascimento: b.birth_date }));

      return [...fromColabs, ...fromBrokers].sort((a, b) => {
        const dayA = new Date(a.data_nascimento + "T00:00:00").getDate();
        const dayB = new Date(b.data_nascimento + "T00:00:00").getDate();
        return dayA - dayB;
      });
    },
  });

  // Alertas de período aquisitivo (colaboradores com mais de 11 meses de admissão sem férias agendadas)
  const { data: alertasPeriodo = [], isLoading: loadingAlertas } = useQuery({
    queryKey: ["ferias-dashboard-alertas"],
    queryFn: async () => {
      // Get collaborators and their vacations
      const { data: colaboradores, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, data_admissao")
        .eq("status", "ativo");
      if (error) throw error;

      // Get all active vacations
      const { data: feriasAtivas } = await supabase
        .from("ferias_ferias")
        .select("colaborador_id, quinzena1_inicio")
        .in("status", feriasDashboardStatuses.filter((status) => status !== "concluida"))
        .range(0, 5000);

      const colaboradoresComFerias = new Set((feriasAtivas || []).map((f) => f.colaborador_id));

      const alertas: { id: string; nome: string; diasRestantes: number; dataLimite: string; tipo: "vencendo" | "vencido" }[] = [];

      for (const colab of colaboradores || []) {
        // Skip if already has scheduled vacations
        if (colaboradoresComFerias.has(colab.id)) continue;

        const admissao = parseISO(colab.data_admissao);
        const anosDesdeAdmissao = Math.floor(differenceInDays(today, admissao) / 365);

        if (anosDesdeAdmissao >= 1) {
          // Calculate next acquisition period limit (12 months after last anniversary)
          const ultimoAniversario = addYears(admissao, anosDesdeAdmissao);
          const proximoVencimento = addYears(ultimoAniversario, 1);

          const diasRestantes = differenceInDays(proximoVencimento, today);

          // Alert if less than 90 days to expire or already expired
          if (diasRestantes <= 90) {
            alertas.push({
              id: colab.id,
              nome: colab.nome,
              diasRestantes: Math.max(0, diasRestantes),
              dataLimite: format(proximoVencimento, "dd/MM/yyyy"),
              tipo: diasRestantes <= 0 ? "vencido" : "vencendo",
            });
          }
        }
      }

      return alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);
    },
  });

  // Colaboradores em aviso prévio
  const { data: avisoPrevio = [], isLoading: loadingAvisoPrevio } = useQuery({
    queryKey: ["ferias-dashboard-aviso-previo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, aviso_previo_inicio, aviso_previo_fim")
        .eq("status", "ativo")
        .not("aviso_previo_fim", "is", null);
      if (error) throw error;

      return (data || []).map((c) => ({
        ...c,
        diasRestantes: differenceInDays(parseISO(c.aviso_previo_fim!), today),
      })).filter((c) => c.diasRestantes >= 0)
        .sort((a, b) => a.diasRestantes - b.diasRestantes);
    },
  });

  // Próximas férias (próximos 30 dias)
  const { data: proximasFerias = [], isLoading: loadingProximas } = useQuery({
    queryKey: ["ferias-dashboard-proximas"],
    queryFn: async () => {
      const todayStr = format(today, "yyyy-MM-dd");
      const in30DaysStr = format(in30Days, "yyyy-MM-dd");
      const upcomingStartsFilter = [
        `and(quinzena1_inicio.gte.${todayStr},quinzena1_inicio.lte.${in30DaysStr})`,
        `and(quinzena2_inicio.gte.${todayStr},quinzena2_inicio.lte.${in30DaysStr})`,
        `and(gozo_quinzena1_inicio.gte.${todayStr},gozo_quinzena1_inicio.lte.${in30DaysStr})`,
        `and(gozo_quinzena2_inicio.gte.${todayStr},gozo_quinzena2_inicio.lte.${in30DaysStr})`,
      ].join(",");
      
      const [
        { data: feriasNaJanela, error: feriasNaJanelaError },
        { data: periodosNaJanela, error: periodosNaJanelaError },
      ] = await Promise.all([
        supabase
          .from("ferias_ferias")
          .select(`
            id,
            gozo_flexivel,
            quinzena1_inicio,
            quinzena1_fim,
            quinzena2_inicio,
            quinzena2_fim,
            gozo_diferente,
            gozo_quinzena1_inicio,
            gozo_quinzena1_fim,
            gozo_quinzena2_inicio,
            gozo_quinzena2_fim,
            ferias_colaboradores(nome)
          `)
          .in("status", feriasDashboardStatuses)
          .or(upcomingStartsFilter)
          .range(0, 5000),
        supabase
          .from("ferias_gozo_periodos")
          .select("ferias_id, data_inicio, data_fim")
          .gte("data_inicio", todayStr)
          .lte("data_inicio", in30DaysStr)
          .range(0, 5000),
      ]);

      if (feriasNaJanelaError) throw feriasNaJanelaError;
      if (periodosNaJanelaError) throw periodosNaJanelaError;

      const feriasMap = new Map<string, any>((feriasNaJanela || []).map((ferias: any) => [ferias.id, ferias]));
      const feriasIdsComPeriodos = Array.from(new Set((periodosNaJanela || []).map((periodo: any) => periodo.ferias_id)));
      const feriasIdsFaltantes = feriasIdsComPeriodos.filter((id) => !feriasMap.has(id));

      if (feriasIdsFaltantes.length > 0) {
        const { data: feriasComPeriodos, error: feriasComPeriodosError } = await supabase
          .from("ferias_ferias")
          .select(`
            id,
            gozo_flexivel,
            quinzena1_inicio,
            quinzena1_fim,
            quinzena2_inicio,
            quinzena2_fim,
            gozo_diferente,
            gozo_quinzena1_inicio,
            gozo_quinzena1_fim,
            gozo_quinzena2_inicio,
            gozo_quinzena2_fim,
            ferias_colaboradores(nome)
          `)
          .in("id", feriasIdsFaltantes)
          .in("status", feriasDashboardStatuses)
          .range(0, 5000);

        if (feriasComPeriodosError) throw feriasComPeriodosError;

        for (const ferias of feriasComPeriodos || []) {
          feriasMap.set(ferias.id, ferias);
        }
      }

      // Build gozo periodos map from periodos found in the window
      const gozoPeriodosMap = buildGozoPeriodosMap(periodosNaJanela || []);

      // Also fetch ALL gozo_periodos for ferias that were found (to fully resolve their periods)
      const allFeriasIds = Array.from(feriasMap.keys());
      if (allFeriasIds.length > 0) {
        const { data: allPeriodos } = await supabase
          .from("ferias_gozo_periodos")
          .select("ferias_id, data_inicio, data_fim")
          .in("ferias_id", allFeriasIds)
          .range(0, 5000);
        // Merge into map (only add periods not already present)
        if (allPeriodos) {
          for (const p of allPeriodos) {
            if (!gozoPeriodosMap[p.ferias_id]) {
              gozoPeriodosMap[p.ferias_id] = [];
            }
            const exists = gozoPeriodosMap[p.ferias_id].some(
              (existing) => existing.data_inicio === p.data_inicio && existing.data_fim === p.data_fim
            );
            if (!exists) {
              gozoPeriodosMap[p.ferias_id].push({ data_inicio: p.data_inicio, data_fim: p.data_fim });
            }
          }
        }
      }

      const results: any[] = [];
      
      for (const f of feriasMap.values()) {
        const upcoming = getResolvedVacationStarts(f, gozoPeriodosMap)
          .filter((d) => d >= todayStr && d <= in30DaysStr)
          .sort();
        if (upcoming.length > 0) {
          results.push({
            id: f.id,
            nome: (f as any).ferias_colaboradores?.nome || "N/A",
            inicio: upcoming[0],
          });
        }
      }
      
      return results.sort((a, b) => a.inicio.localeCompare(b.inicio));
    },
  });

  const formatDateBR = (dateStr: string) => {
    return format(new Date(dateStr + "T00:00:00"), "dd/MM", { locale: ptBR });
  };

  const getBirthdayDay = (dateStr: string) => {
    return format(new Date(dateStr + "T00:00:00"), "dd", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard de Férias</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral de férias, folgas e aniversariantes - {format(today, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingColaboradores ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{colaboradoresAtivos}</div>
                <p className="text-xs text-muted-foreground">
                  Total cadastrado
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Férias este Mês</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingFerias ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{feriasEsteMes.length}</div>
                <p className="text-xs text-muted-foreground">
                  Colaboradores de férias
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Folgas de Sábado</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingFolgas ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{folgasEsteMes}</div>
                <p className="text-xs text-muted-foreground">
                  Este mês
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aniversariantes</CardTitle>
            <Cake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingAniversariantes ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{aniversariantes.length}</div>
                <p className="text-xs text-muted-foreground">
                  Este mês
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Período Aquisitivo */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Período Aquisitivo
              {alertasPeriodo.length > 0 && (
                <Badge variant="destructive" className="ml-auto">{alertasPeriodo.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Colaboradores com período próximo de vencer (sem férias agendadas)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAlertas ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : alertasPeriodo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum alerta no momento
              </p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {alertasPeriodo.map((alerta) => (
                    <div
                      key={alerta.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        alerta.tipo === "vencido" 
                          ? "bg-destructive/10 border-destructive/20" 
                          : "bg-warning/10 border-warning/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className={`h-4 w-4 ${alerta.tipo === "vencido" ? "text-destructive" : "text-warning"}`} />
                        <span className="font-medium text-sm">{alerta.nome}</span>
                      </div>
                      <div className="text-right">
                        <Badge variant={alerta.tipo === "vencido" ? "destructive" : "outline"} className={alerta.tipo !== "vencido" ? "text-warning border-warning" : ""}>
                          {alerta.tipo === "vencido" ? "VENCIDO" : `${alerta.diasRestantes} dias`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Limite: {alerta.dataLimite}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Aviso Prévio */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-destructive" />
              Aviso Prévio
              {avisoPrevio.length > 0 && (
                <Badge variant="destructive" className="ml-auto">{avisoPrevio.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Colaboradores em período de aviso prévio
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAvisoPrevio ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : avisoPrevio.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum colaborador em aviso prévio
              </p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {avisoPrevio.map((colab: any) => (
                    <div
                      key={colab.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-sm">{colab.nome}</span>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">
                          {colab.diasRestantes} dias
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Término: {format(parseISO(colab.aviso_previo_fim), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Próximas Férias */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Próximas Férias
            </CardTitle>
            <CardDescription>
              Férias agendadas para os próximos 30 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProximas ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : proximasFerias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma férias agendada
              </p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {proximasFerias.map((ferias: any) => (
                    <div
                      key={ferias.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">{ferias.nome}</span>
                      </div>
                      <Badge variant="outline" className="text-blue-600 border-blue-500">
                        {formatDateBR(ferias.inicio)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aniversariantes do Mês */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-pink-500" />
            Aniversariantes de {format(today, "MMMM", { locale: ptBR })}
          </CardTitle>
          <CardDescription>
            Colaboradores que fazem aniversário este mês
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAniversariantes ? (
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : aniversariantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum aniversariante este mês
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {aniversariantes.map((colab: any) => (
                <Badge
                  key={colab.id}
                  variant="secondary"
                  className="px-3 py-2 text-sm bg-pink-500/10 text-pink-700 border border-pink-500/20"
                >
                  <span className="font-bold mr-1">{getBirthdayDay(colab.data_nascimento)}</span>
                  {colab.nome}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
