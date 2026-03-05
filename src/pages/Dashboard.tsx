import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, Calendar, TrendingUp, Clock, BarChart3, Database, Cake } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, subMonths, parse, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// Query configuration for caching
const queryConfig = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
  refetchOnWindowFocus: false,
  refetchOnMount: false,
};

const Dashboard = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    };
  });

  // Get date range for selected month
  const selectedDate = parse(selectedMonth, "yyyy-MM", new Date());
  const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");
  const daysInMonth = differenceInDays(endOfMonth(selectedDate), startOfMonth(selectedDate)) + 1;

  // Dashboard stats using hybrid function (supports historical data)
  const { data: dashboardStats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats-hybrid", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats_hybrid', {
        target_month: selectedMonth
      });
      if (error) throw error;
      return data as { 
        total_assignments: number; 
        morning_count: number; 
        afternoon_count: number;
        source: 'live' | 'history';
      };
    },
    ...queryConfig,
  });

  // Top brokers using hybrid function
  const { data: topBrokers } = useQuery({
    queryKey: ["dashboard-top-brokers-hybrid", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_brokers_hybrid', {
        target_month: selectedMonth,
        limit_count: 5
      });
      if (error) throw error;
      return (data || []).map((b: any) => ({ name: b.name, count: Number(b.count) }));
    },
    ...queryConfig,
  });

  // Top locations using hybrid function
  const { data: topLocations } = useQuery({
    queryKey: ["dashboard-top-locations-hybrid", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_locations_hybrid', {
        target_month: selectedMonth,
        limit_count: 5
      });
      if (error) throw error;
      return (data || []).map((l: any) => ({ name: l.name, count: Number(l.count) }));
    },
    ...queryConfig,
  });

  // Weekly assignments for chart - only from selected month
  const { data: weeklyAssignments } = useQuery({
    queryKey: ["dashboard-weekly", selectedMonth],
    queryFn: async () => {
      const monthStartDate = startOfMonth(selectedDate);
      const monthEndDate = endOfMonth(selectedDate);
      
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select("assignment_date")
        .gte("assignment_date", format(monthStartDate, "yyyy-MM-dd"))
        .lte("assignment_date", format(monthEndDate, "yyyy-MM-dd"));
      
      if (error) throw error;
      
      // Group by week (segunda a domingo), respeitando o mês selecionado
      // IMPORTANTE: fazer parsing em timezone local para evitar "voltar um dia" em alguns fusos.
      const weekCounts: Record<string, number> = {};
      const monthStartTime = monthStartDate.getTime();

      const parseLocalDate = (ymd: string) => {
        const [y, m, d] = ymd.split("-").map(Number);
        return new Date(y, m - 1, d);
      };

      (data || []).forEach((item) => {
        const date = parseLocalDate(item.assignment_date);

        // Calcular início da semana (segunda-feira)
        const dayOfWeek = date.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - daysToSubtract);

        // Se a segunda-feira for antes do mês selecionado, usar o primeiro dia do mês
        const effectiveStart = weekStart.getTime() < monthStartTime ? monthStartDate : weekStart;
        const weekKey = format(effectiveStart, "dd/MM");
        weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
      });
      
      // Ordenar as semanas cronologicamente
      return Object.entries(weekCounts)
        .map(([week, plantoes]) => ({ week, plantoes }))
        .sort((a, b) => {
          const [dayA, monthA] = a.week.split('/').map(Number);
          const [dayB, monthB] = b.week.split('/').map(Number);
          if (monthA !== monthB) return monthA - monthB;
          return dayA - dayB;
        });
    },
    ...queryConfig,
  });

  // Contagens combinadas usando função SQL otimizada
  const { data: counts, isLoading: loadingCounts } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_counts');
      
      if (error) throw error;
      
      return data as { brokers: number; locations: number; schedules: number };
    },
    ...queryConfig,
  });

  // Taxa de participação - usando dados híbridos
  const { data: participationStats } = useQuery({
    queryKey: ["dashboard-participation-hybrid", selectedMonth],
    queryFn: async () => {
      // Primeiro verificar se há dados ao vivo
      const { data: liveCheck, error: liveError } = await supabase
        .from("schedule_assignments")
        .select("id")
        .gte("assignment_date", monthStart)
        .lte("assignment_date", monthEnd)
        .limit(1);
      
      if (liveError) throw liveError;
      
      const hasLiveData = liveCheck && liveCheck.length > 0;
      
      // Buscar total de corretores ativos
      const { count: totalActive, error: countError } = await supabase
        .from("brokers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      
      if (countError) throw countError;
      
      let brokerCounts: Record<string, { name: string; count: number }> = {};
      
      if (hasLiveData) {
        // Usar dados ao vivo
        const { data: assignments, error: assignmentsError } = await supabase
          .from("schedule_assignments")
          .select("broker_id, brokers(name)")
          .gte("assignment_date", monthStart)
          .lte("assignment_date", monthEnd);
        
        if (assignmentsError) throw assignmentsError;
        
        (assignments || []).forEach((a: any) => {
          const id = a.broker_id;
          const name = a.brokers?.name || "Desconhecido";
          if (!brokerCounts[id]) brokerCounts[id] = { name, count: 0 };
          brokerCounts[id].count++;
        });
      } else {
        // Usar dados históricos
        const { data: history, error: historyError } = await supabase
          .from("assignment_history_monthly")
          .select("broker_id, broker_name, total_assignments")
          .eq("year_month", selectedMonth);
        
        if (historyError) throw historyError;
        
        (history || []).forEach((h: any) => {
          const id = h.broker_id;
          if (!brokerCounts[id]) brokerCounts[id] = { name: h.broker_name, count: 0 };
          brokerCounts[id].count += h.total_assignments;
        });
      }
      
      const uniqueBrokers = Object.keys(brokerCounts).length;
      const sortedBrokers = Object.values(brokerCounts).sort((a, b) => a.count - b.count);
      const leastScheduled = sortedBrokers.length > 0 ? sortedBrokers[0] : null;
      
      return {
        uniqueScheduled: uniqueBrokers,
        totalActive: totalActive || 0,
        participationRate: totalActive ? Math.round((uniqueBrokers / totalActive) * 100) : 0,
        leastScheduled,
        isHistorical: !hasLiveData
      };
    },
    ...queryConfig,
  });

  // Birthday brokers - cross-reference brokers with sales_brokers by CRECI
  const { data: birthdayBrokers } = useQuery({
    queryKey: ["dashboard-birthdays", selectedMonth],
    queryFn: async () => {
      const month = selectedMonth.split("-")[1]; // "03" from "2026-03"
      
      // Get active escalas brokers with CRECI
      const { data: escalaBrokers } = await supabase
        .from("brokers")
        .select("name, creci")
        .eq("is_active", true);
      
      if (!escalaBrokers || escalaBrokers.length === 0) return [];
      
      // Get sales_brokers with birth_date in the selected month
      const { data: salesBrokersRaw } = await supabase
        .from("sales_brokers")
        .select("name, birth_date, creci" as any)
        .eq("is_active", true)
        .not("birth_date", "is", null);
      
      const salesBrokers = salesBrokersRaw as any[] | null;
      if (!salesBrokers) return [];
      
      // Build sets for matching
      const brokerCrecis = new Set(escalaBrokers.filter(b => b.creci).map(b => b.creci!.toLowerCase().trim()));
      const brokerNames = new Set(escalaBrokers.map(b => b.name.toLowerCase().trim()));
      
      // Filter by month and cross-reference by CRECI first, then fallback to name
      const today = new Date();
      return salesBrokers
        .filter(sb => {
          if (!sb.birth_date) return false;
          const birthMonth = sb.birth_date.substring(5, 7);
          if (birthMonth !== month) return false;
          // Match by CRECI if available, otherwise by name
          const sbCreci = ((sb as any).creci || "").toLowerCase().trim();
          if (sbCreci && brokerCrecis.has(sbCreci)) return true;
          return brokerNames.has(sb.name.toLowerCase().trim());
        })
        .map(sb => {
          const day = parseInt(sb.birth_date!.substring(8, 10));
          const todayDay = today.getDate();
          const todayMonth = today.getMonth() + 1;
          const isToday = day === todayDay && parseInt(month) === todayMonth;
          return { name: sb.name, day, isToday };
        })
        .sort((a, b) => a.day - b.day);
    },
    staleTime: 1000 * 30, // 30 seconds for faster updates
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  // Show loading state while critical data is loading
  if (loadingStats || loadingCounts) {
    return <DashboardSkeleton />;
  }

  const totalAssignments = dashboardStats?.total_assignments || 0;
  const avgPerDay = totalAssignments ? (totalAssignments / daysInMonth).toFixed(1) : "0";
  const isUsingHistoricalData = dashboardStats?.source === 'history';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral e estatísticas do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          {isUsingHistoricalData && (
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" />
              Dados históricos
            </Badge>
          )}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total do Mês</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalAssignments}</div>
            <p className="text-xs text-muted-foreground mt-1">Plantões em {format(selectedDate, "MMMM", { locale: ptBR })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manhã</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{dashboardStats?.morning_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Plantões matutinos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarde</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dashboardStats?.afternoon_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Plantões vespertinos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Dia</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{avgPerDay}</div>
            <p className="text-xs text-muted-foreground mt-1">Plantões/dia</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards Informativos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corretores Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{counts?.brokers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locais Cadastrados</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{counts?.locations || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participação dos Corretores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{participationStats?.participationRate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {participationStats?.uniqueScheduled || 0} de {participationStats?.totalActive || 0} escalados
            </p>
            {participationStats?.leastScheduled && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ {participationStats.leastScheduled.name}: {participationStats.leastScheduled.count} plantões
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aniversariantes do Mês</CardTitle>
            <Cake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {birthdayBrokers && birthdayBrokers.length > 0 ? (
              <div className="space-y-1">
                {birthdayBrokers.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className={b.isToday ? "font-bold text-primary" : ""}>{b.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {b.isToday ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">🎂 Hoje!</Badge>
                      ) : (
                        `dia ${b.day}`
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aniversariante</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      {weeklyAssignments && weeklyAssignments.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plantões por Semana</CardTitle>
              <p className="text-xs text-muted-foreground">Semanas do mês selecionado</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyAssignments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="plantoes" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {topBrokers && topBrokers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Corretores Mais Alocados</CardTitle>
                <p className="text-xs text-muted-foreground">Top 5 do mês</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topBrokers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px"
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tabelas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Locais Mais Ativos</CardTitle>
            <p className="text-xs text-muted-foreground">No mês selecionado</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topLocations && topLocations.length > 0 ? (
                topLocations.map((location, idx) => (
                  <div key={location.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-sm">{location.name}</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{location.count} plantões</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado para o mês selecionado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shift Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Turnos</CardTitle>
            <p className="text-xs text-muted-foreground">Manhã vs Tarde</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Manhã</span>
                <span className="text-sm font-medium">{dashboardStats?.morning_count || 0}</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ 
                    width: `${totalAssignments > 0 
                      ? ((dashboardStats?.morning_count || 0) / totalAssignments) * 100 
                      : 0}%` 
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tarde</span>
                <span className="text-sm font-medium">{dashboardStats?.afternoon_count || 0}</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{ 
                    width: `${totalAssignments > 0 
                      ? ((dashboardStats?.afternoon_count || 0) / totalAssignments) * 100 
                      : 0}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
