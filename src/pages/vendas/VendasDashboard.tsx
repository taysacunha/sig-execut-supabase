import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, FileText, DollarSign, Trophy, Target, Calendar, ArrowUpRight, ArrowDownRight, Minus, Eye, EyeOff, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from "recharts";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { format, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const queryConfig = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
};

const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(280 65% 60%)", "hsl(200 70% 50%)"];

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const VendasDashboard = () => {
  const [showVgv, setShowVgv] = useState(false);
  const currentYear = format(new Date(), "yyyy");
  const currentMonth = format(new Date(), "MM");
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentMonth);

  // Generate year options (last 3 years)
  const yearOptions = useMemo(() => {
    const years = [];
    const thisYear = parseInt(currentYear);
    for (let i = 0; i < 3; i++) {
      years.push(String(thisYear - i));
    }
    return years;
  }, [currentYear]);

  // Calculate previous period for comparison
  const previousPeriod = useMemo(() => {
    if (selectedMonth === null) {
      // Year view: compare with previous year
      return { year: String(parseInt(selectedYear) - 1), month: null };
    } else {
      // Month view: compare with previous month
      const date = parse(`${selectedYear}-${selectedMonth}`, "yyyy-MM", new Date());
      const prevDate = subMonths(date, 1);
      return { year: format(prevDate, "yyyy"), month: format(prevDate, "MM") };
    }
  }, [selectedYear, selectedMonth]);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["vendas-dashboard-summary-flex", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_dashboard_summary_flexible", {
        p_year: selectedYear,
        p_month: selectedMonth,
      });
      if (error) throw error;
      return data as {
        total_vgv: number;
        total_sales: number;
        total_proposals: number;
        pending_proposals: number;
        converted_proposals: number;
        active_brokers: number;
        active_teams: number;
      };
    },
    ...queryConfig,
  });

  // Previous period summary for comparison
  const { data: previousSummary } = useQuery({
    queryKey: ["vendas-dashboard-summary-flex", previousPeriod.year, previousPeriod.month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_dashboard_summary_flexible", {
        p_year: previousPeriod.year,
        p_month: previousPeriod.month,
      });
      if (error) throw error;
      return data as {
        total_vgv: number;
        total_sales: number;
        total_proposals: number;
        pending_proposals: number;
        converted_proposals: number;
        active_brokers: number;
        active_teams: number;
      };
    },
    ...queryConfig,
  });

  const { data: teamRanking } = useQuery({
    queryKey: ["vendas-team-ranking-flex", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_team_vgv_ranking_flexible", {
        p_year: selectedYear,
        p_month: selectedMonth,
      });
      if (error) throw error;
      return data || [];
    },
    ...queryConfig,
  });

  const { data: brokerRanking } = useQuery({
    queryKey: ["vendas-broker-ranking-flex", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_broker_vgv_ranking_flexible", {
        p_year: selectedYear,
        p_month: selectedMonth,
      });
      if (error) throw error;
      return (data || []).slice(0, 5);
    },
    ...queryConfig,
  });

  // Generate months array for evolution queries
  const evolutionMonths = useMemo(() => {
    if (selectedMonth === null) {
      return Array.from({ length: 12 }, (_, i) => 
        `${selectedYear}-${String(i + 1).padStart(2, '0')}`
      );
    } else {
      const date = parse(`${selectedYear}-${selectedMonth}`, "yyyy-MM", new Date());
      return Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(date, 5 - i);
        return format(d, "yyyy-MM");
      });
    }
  }, [selectedYear, selectedMonth]);

  // Get evolution data based on selection
  const { data: monthlyEvolution } = useQuery({
    queryKey: ["vendas-monthly-evolution", selectedYear, selectedMonth],
    queryFn: async () => {
      const results = await Promise.all(
        evolutionMonths.map(async (month) => {
          const { data } = await supabase
            .from("sales")
            .select("sale_value")
            .eq("year_month", month);
          
          const totalVgv = (data || []).reduce((acc, sale) => acc + (sale.sale_value || 0), 0);
          const totalSales = (data || []).length;
          
          return {
            month: format(new Date(month + "-01"), selectedMonth === null ? "MMM" : "MMM/yy", { locale: ptBR }),
            vgv: totalVgv,
            vendas: totalSales,
          };
        })
      );
      
      return results;
    },
    ...queryConfig,
  });

  // Get proposals evolution data
  const { data: proposalsEvolution } = useQuery({
    queryKey: ["vendas-proposals-evolution", selectedYear, selectedMonth],
    queryFn: async () => {
      const results = await Promise.all(
        evolutionMonths.map(async (month) => {
          const { data } = await supabase
            .from("broker_monthly_proposals")
            .select("proposals_count, proposals_converted")
            .eq("year_month", month);
          
          const total = (data || []).reduce((acc, p) => acc + (p.proposals_count || 0), 0);
          const converted = (data || []).reduce((acc, p) => acc + (p.proposals_converted || 0), 0);
          
          return {
            month: format(new Date(month + "-01"), selectedMonth === null ? "MMM" : "MMM/yy", { locale: ptBR }),
            total,
            convertidas: converted,
            pendentes: total - converted,
          };
        })
      );
      
      return results;
    },
    ...queryConfig,
  });

  // Get proposals by broker for the list card
  const { data: proposalsByBroker } = useQuery({
    queryKey: ["vendas-proposals-by-broker", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("broker_monthly_proposals")
        .select("broker_id, proposals_count, proposals_converted, sales_brokers(name)");
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data } = await query;
      
      // Agrupar por corretor
      const grouped: Record<string, { name: string; count: number; converted: number }> = {};
      (data || []).forEach((p: any) => {
        const id = p.broker_id;
        if (!grouped[id]) {
          grouped[id] = { name: p.sales_brokers?.name || "-", count: 0, converted: 0 };
        }
        grouped[id].count += p.proposals_count || 0;
        grouped[id].converted += p.proposals_converted || 0;
      });
      
      return Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 10);
    },
    ...queryConfig,
  });

  // Get visits by broker
  const { data: visitsByBroker } = useQuery({
    queryKey: ["vendas-visits-by-broker", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("monthly_leads")
        .select("broker_id, gimob_key_visits, scheduled_visits, builder_visits, sales_brokers(name)");
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data } = await query;
      
      // Agrupar por corretor e somar visitas
      const grouped: Record<string, { name: string; visits: number }> = {};
      (data || []).forEach((lead: any) => {
        const id = lead.broker_id;
        const totalVisits = (lead.gimob_key_visits || 0) + 
                            (lead.scheduled_visits || 0) + 
                            (lead.builder_visits || 0);
        if (!grouped[id]) {
          grouped[id] = { name: lead.sales_brokers?.name || "-", visits: 0 };
        }
        grouped[id].visits += totalVisits;
      });
      
      return Object.values(grouped).sort((a, b) => b.visits - a.visits).slice(0, 10);
    },
    ...queryConfig,
  });

  // Birthday brokers
  const { data: birthdayBrokers } = useQuery({
    queryKey: ["vendas-birthdays", selectedMonth],
    queryFn: async () => {
      const month = selectedMonth || format(new Date(), "MM");
      
      const { data: salesBrokers } = await supabase
        .from("sales_brokers")
        .select("name, birth_date")
        .eq("is_active", true)
        .not("birth_date", "is", null);
      
      if (!salesBrokers) return [];
      
      const today = new Date();
      return salesBrokers
        .filter(sb => {
          if (!sb.birth_date) return false;
          return sb.birth_date.substring(5, 7) === month;
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
    ...queryConfig,
  });

  if (loadingSummary) {
    return <DashboardSkeleton />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      compactDisplay: "short",
    }).format(value);
  };

  // Calculate percentage variation
  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const vgvVariation = calculateVariation(summary?.total_vgv || 0, previousSummary?.total_vgv || 0);
  const salesVariation = calculateVariation(summary?.total_sales || 0, previousSummary?.total_sales || 0);
  const proposalsVariation = calculateVariation(summary?.total_proposals || 0, previousSummary?.total_proposals || 0);

  const VariationBadge = ({ value }: { value: number }) => {
    if (value === 0) {
      return (
        <span className="flex items-center text-xs text-muted-foreground">
          <Minus className="h-3 w-3 mr-1" />
          0%
        </span>
      );
    }
    if (value > 0) {
      return (
        <span className="flex items-center text-xs text-green-600">
          <ArrowUpRight className="h-3 w-3 mr-1" />
          +{value.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="flex items-center text-xs text-red-600">
        <ArrowDownRight className="h-3 w-3 mr-1" />
        {value.toFixed(1)}%
      </span>
    );
  };

  // Get display label for the period
  const periodLabel = selectedMonth 
    ? `${MONTHS.find(m => m.value === selectedMonth)?.label} de ${selectedYear}`
    : `Ano de ${selectedYear}`;
    
  const previousPeriodLabel = selectedMonth 
    ? MONTHS.find(m => m.value === previousPeriod.month)?.label || ""
    : String(parseInt(selectedYear) - 1);

  const evolutionLabel = selectedMonth === null 
    ? `Meses de ${selectedYear}` 
    : "Últimos 6 meses";

  const rankingLabel = selectedMonth === null 
    ? `VGV de ${selectedYear}` 
    : `VGV do período`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard de Vendas</h1>
          <p className="text-muted-foreground capitalize">{periodLabel}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={selectedMonth ?? "all"} 
            onValueChange={(v) => setSelectedMonth(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano inteiro</SelectItem>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
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
            <CardTitle className="text-sm font-medium">VGV Total</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowVgv(!showVgv)}
            >
              {showVgv ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {showVgv ? formatCurrency(summary?.total_vgv || 0) : "R$ ******"}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">vs {previousPeriodLabel}</p>
              <VariationBadge value={vgvVariation} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.total_sales || 0}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">vs {previousPeriodLabel}</p>
              <VariationBadge value={salesVariation} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propostas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.total_proposals || 0}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">{summary?.pending_proposals || 0} pendentes</p>
              <VariationBadge value={proposalsVariation} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corretores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary?.active_brokers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Em {summary?.active_teams || 0} equipes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* VGV Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Evolução do VGV
            </CardTitle>
            <p className="text-xs text-muted-foreground">{evolutionLabel}</p>
          </CardHeader>
          <CardContent>
            {monthlyEvolution && monthlyEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyEvolution}>
                  <defs>
                    <linearGradient id="vgvGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                   <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    tickFormatter={formatCompact}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "VGV"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="vgv"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#vgvGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Sales Count Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Quantidade de Vendas
            </CardTitle>
            <p className="text-xs text-muted-foreground">{evolutionLabel}</p>
          </CardHeader>
          <CardContent>
            {monthlyEvolution && monthlyEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [value, "Vendas"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="vendas"
                    stroke="hsl(142 76% 36%)"
                    strokeWidth={3}
                    dot={{ fill: "hsl(142 76% 36%)", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proposals Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-blue-600" />
            Evolução de Propostas
          </CardTitle>
          <p className="text-xs text-muted-foreground">{evolutionLabel}</p>
        </CardHeader>
        <CardContent>
          {proposalsEvolution && proposalsEvolution.some(p => p.total > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={proposalsEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="convertidas" name="Convertidas" stackId="a" fill="hsl(142 76% 36%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pendentes" name="Pendentes" stackId="a" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">Sem dados de propostas</p>
          )}
        </CardContent>
      </Card>

      {/* Rankings and Stats */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Ranking de Equipes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Ranking de Equipes
            </CardTitle>
            <p className="text-xs text-muted-foreground">{rankingLabel}</p>
          </CardHeader>
          <CardContent>
            {teamRanking && teamRanking.length > 0 ? (
              <div className="space-y-3">
                {teamRanking.map((team: any, idx: number) => {
                  const maxVgv = Math.max(...teamRanking.map((t: any) => t.total_vgv || 1));
                  const percentage = ((team.total_vgv || 0) / maxVgv) * 100;
                  
                  return (
                    <div key={team.team_id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              idx === 0
                                ? "bg-yellow-500 text-white"
                                : idx === 1
                                ? "bg-gray-400 text-white"
                                : idx === 2
                                ? "bg-amber-700 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <span className="font-medium text-sm">{team.team_name}</span>
                        </div>
                        <span className="text-xs font-bold text-primary">
                          {formatCurrency(team.total_vgv)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[idx % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma equipe cadastrada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Corretores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              Top 5 Corretores
            </CardTitle>
            <p className="text-xs text-muted-foreground">Maiores VGV do período</p>
          </CardHeader>
          <CardContent>
            {brokerRanking && brokerRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={brokerRanking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    tickFormatter={formatCompact}
                  />
                  <YAxis
                    type="category"
                    dataKey="broker_name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "VGV"]}
                  />
                  <Bar dataKey="total_vgv" radius={[0, 8, 8, 0]}>
                    {brokerRanking.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma venda registrada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Propostas por Corretor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-blue-600" />
              Propostas por Corretor
            </CardTitle>
            <p className="text-xs text-muted-foreground">Total e convertidas</p>
          </CardHeader>
          <CardContent>
            {proposalsByBroker && proposalsByBroker.length > 0 ? (
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {proposalsByBroker.map((broker: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-sm font-medium truncate max-w-[120px]">{broker.name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium">{broker.count}</span> prop.
                      </span>
                      <span className="text-green-600">
                        <span className="font-medium">{broker.converted}</span> conv.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma proposta registrada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Visitas por Corretor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-green-600" />
              Visitas por Corretor
            </CardTitle>
            <p className="text-xs text-muted-foreground">Total do período</p>
          </CardHeader>
          <CardContent>
            {visitsByBroker && visitsByBroker.length > 0 ? (
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {visitsByBroker.map((broker: any, idx: number) => {
                  const maxVisits = Math.max(...(visitsByBroker as any[]).map((b: any) => b.visits || 1));
                  const percentage = ((broker.visits || 0) / maxVisits) * 100;
                  
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[120px]">{broker.name}</span>
                        <span className="text-sm font-bold text-green-600">{broker.visits}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma visita registrada
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aniversariantes */}
      {birthdayBrokers && birthdayBrokers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="h-5 w-5 text-pink-500" />
              Aniversariantes do Mês
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {selectedMonth ? MONTHS.find(m => m.value === selectedMonth)?.label : "Mês atual"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {birthdayBrokers.map((b, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className={`text-sm ${b.isToday ? "font-bold text-primary" : ""}`}>{b.name}</span>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VendasDashboard;
