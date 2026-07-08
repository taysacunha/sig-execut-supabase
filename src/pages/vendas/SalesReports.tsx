import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TeamFilter } from "@/components/vendas/TeamFilter";
import { YearMonthSelector } from "@/components/vendas/YearMonthSelector";
import { BrokerIndividualReport } from "@/components/vendas/BrokerIndividualReport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Users, TrendingUp, FileText, Star, Eye, EyeOff, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const queryConfig = {
  staleTime: 0, // Sempre buscar dados frescos para garantir consistência
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
};

export default function SalesReports() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [showValues, setShowValues] = useState(false);

  // Sales data
  const { data: salesDataRaw = [], isLoading: loadingSales } = useQuery({
    queryKey: ["sales-report", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          *,
          sales_brokers(name, team_id, sales_teams(name)),
          sales_teams(name)
        `)
        .order("sale_date", { ascending: false });
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...queryConfig,
  });

  // Proposals data (using broker_monthly_proposals table which has actual data)
  const { data: proposalsDataRaw = [], isLoading: loadingProposals } = useQuery({
    queryKey: ["proposals-report", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("broker_monthly_proposals")
        .select(`
          *,
          sales_brokers(name, team_id, sales_teams(name))
        `)
        .order("proposals_count", { ascending: false });
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...queryConfig,
  });

  // Leads data
  const { data: leadsDataRaw = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["leads-report", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("monthly_leads")
        .select(`
          *,
          sales_brokers(name, team_id, sales_teams(name))
        `)
        .order("created_at", { ascending: false });
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...queryConfig,
  });

  // Evaluations data
  const { data: evaluationsDataRaw = [], isLoading: loadingEvaluations } = useQuery({
    queryKey: ["evaluations-report", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("broker_evaluations")
        .select(`
          *,
          sales_brokers(name, team_id, sales_teams(name))
        `)
        .order("average_score", { ascending: false });
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...queryConfig,
  });

  // Broker ranking
  const { data: brokerRankingRaw = [] } = useQuery({
    queryKey: ["broker-ranking-report", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_broker_vgv_ranking_flexible", {
        p_year: selectedYear,
        p_month: selectedMonth,
      });
      if (error) throw error;
      return data || [];
    },
    ...queryConfig,
  });

  // Team ranking
  const { data: teamRanking = [] } = useQuery({
    queryKey: ["team-ranking-report", selectedYear, selectedMonth],
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

  // Filter data by team
  const salesData = selectedTeamId === "all"
    ? salesDataRaw
    : salesDataRaw.filter((s: any) => s.sales_brokers?.team_id === selectedTeamId);

  // Agregar propostas por corretor quando ano inteiro
  const proposalsData = useMemo(() => {
    const filtered = selectedTeamId === "all"
      ? proposalsDataRaw
      : proposalsDataRaw.filter((p: any) => p.sales_brokers?.team_id === selectedTeamId);
    
    if (selectedMonth !== null) return filtered;
    
    // Agregar por corretor quando ano inteiro
    const grouped = new Map<string, any>();
    filtered.forEach((p: any) => {
      const key = p.broker_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          ...p,
          proposals_count: 0,
          proposals_converted: 0,
        });
      }
      const existing = grouped.get(key);
      existing.proposals_count += (p.proposals_count || 0);
      existing.proposals_converted += (p.proposals_converted || 0);
    });
    return Array.from(grouped.values());
  }, [proposalsDataRaw, selectedTeamId, selectedMonth]);

  // Agregar leads por corretor quando ano inteiro
  const leadsData = useMemo(() => {
    const filtered = selectedTeamId === "all"
      ? leadsDataRaw
      : leadsDataRaw.filter((l: any) => l.sales_brokers?.team_id === selectedTeamId);
    
    if (selectedMonth !== null) return filtered;
    
    // Agregar por corretor quando ano inteiro
    const grouped = new Map<string, any>();
    filtered.forEach((l: any) => {
      const key = l.broker_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          ...l,
          leads_received: 0,
          leads_active: 0,
          leads_archived: 0,
          gimob_key_visits: 0,
          scheduled_visits: 0,
          builder_visits: 0,
        });
      }
      const existing = grouped.get(key);
      existing.leads_received += (l.leads_received || 0);
      existing.leads_active = Math.max(existing.leads_active, l.leads_active || 0); // Último valor ativo
      existing.leads_archived += (l.leads_archived || 0);
      existing.gimob_key_visits += (l.gimob_key_visits || 0);
      existing.scheduled_visits += (l.scheduled_visits || 0);
      existing.builder_visits += (l.builder_visits || 0);
    });
    return Array.from(grouped.values());
  }, [leadsDataRaw, selectedTeamId, selectedMonth]);

  const evaluationsDataFiltered = selectedTeamId === "all"
    ? evaluationsDataRaw
    : evaluationsDataRaw.filter((e: any) => e.sales_brokers?.team_id === selectedTeamId);

  const [evalSortField, setEvalSortField] = useState<"name" | "team" | "average_score" | "classification">("average_score");
  const [evalSortDirection, setEvalSortDirection] = useState<"asc" | "desc">("desc");

  const classificationPriority: Record<string, number> = {
    "Excelente": 4,
    "Bom": 3,
    "Precisa Melhorar": 2,
    "Não atualiza": 1,
  };

  const handleEvalSort = useCallback((field: typeof evalSortField) => {
    if (evalSortField === field) {
      setEvalSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setEvalSortField(field);
      setEvalSortDirection(field === "average_score" ? "desc" : "asc");
    }
  }, [evalSortField]);

  const evaluationsData = useMemo(() => {
    const sorted = [...evaluationsDataFiltered].sort((a: any, b: any) => {
      let comparison = 0;
      switch (evalSortField) {
        case "name":
          comparison = (a.sales_brokers?.name || "").localeCompare(b.sales_brokers?.name || "");
          break;
        case "team":
          comparison = (a.sales_brokers?.sales_teams?.name || "").localeCompare(b.sales_brokers?.sales_teams?.name || "");
          break;
        case "average_score":
          comparison = (a.average_score || 0) - (b.average_score || 0);
          break;
        case "classification":
          comparison = (classificationPriority[a.classification] || 0) - (classificationPriority[b.classification] || 0);
          break;
      }
      return evalSortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [evaluationsDataFiltered, evalSortField, evalSortDirection]);

  const brokerRanking = selectedTeamId === "all"
    ? brokerRankingRaw
    : brokerRankingRaw.filter((b: any) => {
        const broker = salesDataRaw.find((s: any) => s.sales_brokers?.name === b.broker_name);
        return broker?.sales_brokers?.team_id === selectedTeamId;
      });

  // Generate file name label
  const fileLabel = selectedMonth ? `${selectedYear}-${selectedMonth}` : selectedYear;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(new Date(date + "T12:00:00"), "dd/MM/yyyy");
  };

  const exportToExcel = (data: any[], filename: string, sheetName: string) => {
    if (data.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${fileLabel}.xlsx`);
    toast.success("Relatório exportado com sucesso!");
  };

  const exportSales = () => {
    const data = salesData.map((sale: any) => ({
      "Data": formatDate(sale.sale_date),
      "Corretor": sale.sales_brokers?.name || "-",
      "Equipe": sale.sales_brokers?.sales_teams?.name || "-",
      "Imóvel": sale.property_name || "-",
      "Valor": sale.sale_value,
    }));
    exportToExcel(data, "vendas", "Vendas");
  };

  const exportProposals = () => {
    const data = proposalsData.map((proposal: any) => ({
      "Corretor": proposal.sales_brokers?.name || "-",
      "Equipe": proposal.sales_brokers?.sales_teams?.name || "-",
      "Total Propostas": proposal.proposals_count || 0,
      "Convertidas": proposal.proposals_converted || 0,
      "Pendentes": (proposal.proposals_count || 0) - (proposal.proposals_converted || 0),
    }));
    exportToExcel(data, "propostas", "Propostas");
  };

  const exportLeads = () => {
    const data = leadsData.map((lead: any) => ({
      "Corretor": lead.sales_brokers?.name || "-",
      "Equipe": lead.sales_brokers?.sales_teams?.name || "-",
      "Leads Recebidos": lead.leads_received || 0,
      "Leads Arquivados": lead.leads_archived || 0,
      "Leads Ativos": lead.leads_active || 0,
      "Visitas Gimob": lead.gimob_key_visits || 0,
      "Visitas Agendadas": lead.scheduled_visits || 0,
      "Visitas Construtora": lead.builder_visits || 0,
      "Observações": lead.observations || "-",
    }));
    exportToExcel(data, "leads", "Leads");
  };

  const exportEvaluations = () => {
    const data = evaluationsData.map((evaluation: any) => ({
      "Corretor": evaluation.sales_brokers?.name || "-",
      "Equipe": evaluation.sales_brokers?.sales_teams?.name || "-",
      "Média": evaluation.average_score?.toFixed(2) || "-",
      "Classificação": evaluation.classification || "-",
      "Feedback": evaluation.feedback || "-",
    }));
    exportToExcel(data, "avaliacoes", "Avaliações");
  };

  const exportRanking = () => {
    const brokersData = brokerRanking.map((broker: any) => ({
      "Posição": broker.rank,
      "Corretor": broker.broker_name,
      "Equipe": broker.team_name || "-",
      "VGV Total": broker.total_vgv,
      "Vendas": broker.total_sales,
    }));

    const teamsData = teamRanking.map((team: any) => ({
      "Posição": team.rank,
      "Equipe": team.team_name,
      "VGV Total": team.total_vgv,
      "Vendas": team.total_sales,
      "Corretores": team.broker_count,
    }));

    const wb = XLSX.utils.book_new();
    const wsBrokers = XLSX.utils.json_to_sheet(brokersData);
    const wsTeams = XLSX.utils.json_to_sheet(teamsData);
    XLSX.utils.book_append_sheet(wb, wsBrokers, "Ranking Corretores");
    XLSX.utils.book_append_sheet(wb, wsTeams, "Ranking Equipes");
    XLSX.writeFile(wb, `ranking_${fileLabel}.xlsx`);
    toast.success("Ranking exportado com sucesso!");
  };

  const exportAll = () => {
    const wb = XLSX.utils.book_new();

    // Sales sheet
    const salesSheet = salesData.map((sale: any) => ({
      "Data": formatDate(sale.sale_date),
      "Corretor": sale.sales_brokers?.name || "-",
      "Equipe": sale.sales_brokers?.sales_teams?.name || "-",
      "Imóvel": sale.property_name || "-",
      "Valor": sale.sale_value,
    }));
    if (salesSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesSheet), "Vendas");
    }

    // Proposals sheet
    const proposalsSheet = proposalsData.map((proposal: any) => ({
      "Corretor": proposal.sales_brokers?.name || "-",
      "Equipe": proposal.sales_brokers?.sales_teams?.name || "-",
      "Total Propostas": proposal.proposals_count || 0,
      "Convertidas": proposal.proposals_converted || 0,
      "Pendentes": (proposal.proposals_count || 0) - (proposal.proposals_converted || 0),
    }));
    if (proposalsSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proposalsSheet), "Propostas");
    }

    // Leads sheet
    const leadsSheet = leadsData.map((lead: any) => ({
      "Corretor": lead.sales_brokers?.name || "-",
      "Equipe": lead.sales_brokers?.sales_teams?.name || "-",
      "Leads Recebidos": lead.leads_received || 0,
      "Leads Ativos": lead.leads_active || 0,
      "Visitas Total": (lead.gimob_key_visits || 0) + (lead.scheduled_visits || 0) + (lead.builder_visits || 0),
    }));
    if (leadsSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadsSheet), "Leads");
    }

    // Evaluations sheet
    const evaluationsSheet = evaluationsData.map((evaluation: any) => ({
      "Corretor": evaluation.sales_brokers?.name || "-",
      "Média": evaluation.average_score?.toFixed(2) || "-",
      "Classificação": evaluation.classification || "-",
    }));
    if (evaluationsSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evaluationsSheet), "Avaliações");
    }

    // Rankings
    const brokersRankSheet = brokerRanking.map((broker: any) => ({
      "Posição": broker.rank,
      "Corretor": broker.broker_name,
      "VGV": broker.total_vgv,
    }));
    if (brokersRankSheet.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(brokersRankSheet), "Ranking Corretores");
    }

    XLSX.writeFile(wb, `relatorio_completo_${fileLabel}.xlsx`);
    toast.success("Relatório completo exportado!");
  };

  const totalVGV = salesData.reduce((acc: number, sale: any) => acc + (sale.sale_value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Consulte e exporte dados do sistema</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TeamFilter
            value={selectedTeamId}
            onChange={setSelectedTeamId}
          />
          <YearMonthSelector
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            allowFullYear
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowValues(!showValues)}
            title={showValues ? "Ocultar valores" : "Mostrar valores"}
          >
            {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button onClick={exportAll} variant="default">
            <Download className="h-4 w-4 mr-2" />
            Exportar Tudo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="proposals">Propostas</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="evaluations">Avaliações</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="brokers">Corretores</TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Vendas do Mês
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {salesData.length} vendas • VGV: {showValues ? formatCurrency(totalVGV) : "R$ ******"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportSales}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </CardHeader>
            <CardContent>
              {loadingSales ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : salesData.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma venda encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Corretor</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesData.map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell>{formatDate(sale.sale_date)}</TableCell>
                          <TableCell>{sale.sales_brokers?.name || "-"}</TableCell>
                          <TableCell>{sale.sales_brokers?.sales_teams?.name || "-"}</TableCell>
                          <TableCell>{sale.property_name || "-"}</TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {formatCurrency(sale.sale_value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Propostas do Mês
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {proposalsData.reduce((acc: number, p: any) => acc + (p.proposals_count || 0), 0)} propostas total
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportProposals}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProposals ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : proposalsData.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma proposta encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Corretor</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Convertidas</TableHead>
                        <TableHead className="text-center">Pendentes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proposalsData.map((proposal: any) => (
                        <TableRow key={proposal.id}>
                          <TableCell>{proposal.sales_brokers?.name || "-"}</TableCell>
                          <TableCell>{proposal.sales_brokers?.sales_teams?.name || "-"}</TableCell>
                          <TableCell className="text-center">{proposal.proposals_count || 0}</TableCell>
                          <TableCell className="text-center text-green-600">{proposal.proposals_converted || 0}</TableCell>
                          <TableCell className="text-center text-yellow-600">
                            {(proposal.proposals_count || 0) - (proposal.proposals_converted || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Leads do Mês
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {leadsData.reduce((acc: number, l: any) => acc + (l.leads_received || 0), 0)} leads recebidos
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportLeads}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </CardHeader>
            <CardContent>
              {loadingLeads ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : leadsData.length === 0 ? (
                <p className="text-muted-foreground">Nenhum lead encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Corretor</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-center">Recebidos</TableHead>
                        <TableHead className="text-center">Ativos</TableHead>
                        <TableHead className="text-center">Visitas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsData.map((lead: any) => (
                        <TableRow key={lead.id}>
                          <TableCell>{lead.sales_brokers?.name || "-"}</TableCell>
                          <TableCell>{lead.sales_brokers?.sales_teams?.name || "-"}</TableCell>
                          <TableCell className="text-center">{lead.leads_received || 0}</TableCell>
                          <TableCell className="text-center">{lead.leads_active || 0}</TableCell>
                          <TableCell className="text-center">
                            {(lead.gimob_key_visits || 0) + (lead.scheduled_visits || 0) + (lead.builder_visits || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Avaliações do Mês
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {evaluationsData.length} avaliações
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportEvaluations}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </CardHeader>
            <CardContent>
              {loadingEvaluations ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : evaluationsData.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma avaliação encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-accent/50" onClick={() => handleEvalSort("name")}>
                          <div className="flex items-center gap-1">
                            Corretor
                            {evalSortField === "name" ? (evalSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-accent/50" onClick={() => handleEvalSort("team")}>
                          <div className="flex items-center gap-1">
                            Equipe
                            {evalSortField === "team" ? (evalSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead className="text-center cursor-pointer hover:bg-accent/50" onClick={() => handleEvalSort("average_score")}>
                          <div className="flex items-center justify-center gap-1">
                            Média
                            {evalSortField === "average_score" ? (evalSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-accent/50" onClick={() => handleEvalSort("classification")}>
                          <div className="flex items-center gap-1">
                            Classificação
                            {evalSortField === "classification" ? (evalSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluationsData.map((evaluation: any) => (
                        <TableRow key={evaluation.id}>
                          <TableCell>{evaluation.sales_brokers?.name || "-"}</TableCell>
                          <TableCell>{evaluation.sales_brokers?.sales_teams?.name || "-"}</TableCell>
                          <TableCell className="text-center font-medium">
                            {evaluation.average_score?.toFixed(1) || "-"}
                          </TableCell>
                          <TableCell>{evaluation.classification || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ranking de Corretores</CardTitle>
                <Button variant="outline" size="sm" onClick={exportRanking}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </CardHeader>
              <CardContent>
                {brokerRanking.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum dado encontrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Corretor</TableHead>
                        <TableHead className="text-right">VGV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brokerRanking.slice(0, 10).map((broker: any) => (
                        <TableRow key={broker.broker_id}>
                          <TableCell className="font-bold">{broker.rank}º</TableCell>
                          <TableCell>{broker.broker_name}</TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {showValues ? formatCurrency(broker.total_vgv) : "R$ ******"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ranking de Equipes</CardTitle>
              </CardHeader>
              <CardContent>
                {teamRanking.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum dado encontrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead className="text-right">VGV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamRanking.map((team: any) => (
                        <TableRow key={team.team_id}>
                          <TableCell className="font-bold">{team.rank}º</TableCell>
                          <TableCell>{team.team_name}</TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {showValues ? formatCurrency(team.total_vgv) : "R$ ******"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Brokers Individual Report Tab */}
        <TabsContent value="brokers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Relatório Individual de Corretores
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecione um corretor para visualizar seu desempenho detalhado com gráficos de evolução
              </p>
            </CardHeader>
            <CardContent>
              <BrokerIndividualReport teamFilter={selectedTeamId} showValues={showValues} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
