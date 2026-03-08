import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  FileText,
  Users,
  Star,
  Rocket,
  Download,
  Loader2,
  Info,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EvaluationDetailsDialog } from "./EvaluationDetailsDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Target, TrendingUp as TrendingUpIcon2, Calendar } from "lucide-react";

type PeriodType = "month" | "quarter" | "semester" | "annual";

const QUARTERS = [
  { value: "1", label: "1º Trimestre (Jan-Mar)", months: ["01", "02", "03"] },
  { value: "2", label: "2º Trimestre (Abr-Jun)", months: ["04", "05", "06"] },
  { value: "3", label: "3º Trimestre (Jul-Set)", months: ["07", "08", "09"] },
  { value: "4", label: "4º Trimestre (Out-Dez)", months: ["10", "11", "12"] },
];

const SEMESTERS = [
  { value: "1", label: "1º Semestre (Jan-Jun)", months: ["01", "02", "03", "04", "05", "06"] },
  { value: "2", label: "2º Semestre (Jul-Dez)", months: ["07", "08", "09", "10", "11", "12"] },
];

const MONTHS_OPTIONS = [
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

const queryConfig = {
  staleTime: 0, // Sempre buscar dados frescos para evitar inconsistências
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
};


interface BrokerIndividualReportProps {
  teamFilter?: string;
}

export function BrokerIndividualReport({ teamFilter = "all" }: BrokerIndividualReportProps) {
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [periodType, setPeriodType] = useState<PeriodType>("annual");
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedQuarter, setSelectedQuarter] = useState("1");
  const [selectedSemester, setSelectedSemester] = useState("1");
  const [isExporting, setIsExporting] = useState(false);
  const [pdfEvaluationSnapshot, setPdfEvaluationSnapshot] = useState<any | null>(null);
  const [pdfLastVisitSnapshot, setPdfLastVisitSnapshot] = useState<string | null>(null);
  const [evaluationDetailsOpen, setEvaluationDetailsOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => (currentYear - i).toString());

  // Calculate months based on period type
  const months = useMemo(() => {
    switch (periodType) {
      case "month": {
        // Include previous month for evolution context
        const monthNum = parseInt(selectedMonth);
        const yearNum = parseInt(selectedYear);
        let prevMonth: string;
        if (monthNum === 1) {
          prevMonth = `${yearNum - 1}-12`;
        } else {
          prevMonth = `${yearNum}-${String(monthNum - 1).padStart(2, "0")}`;
        }
        return [prevMonth, `${selectedYear}-${selectedMonth}`];
      }
      case "quarter":
        const quarter = QUARTERS.find(q => q.value === selectedQuarter);
        return quarter ? quarter.months.map(m => `${selectedYear}-${m}`) : [];
      case "semester":
        const semester = SEMESTERS.find(s => s.value === selectedSemester);
        return semester ? semester.months.map(m => `${selectedYear}-${m}`) : [];
      case "annual":
      default:
        return Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, "0")}`);
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, selectedSemester]);

  // reportMonths = only the selected period (no previous month for context)
  const reportMonths = useMemo(() => {
    if (periodType === "month") {
      return [months[months.length - 1]];
    }
    return months;
  }, [months, periodType]);

  // Get period label for report header
  const periodLabel = useMemo(() => {
    switch (periodType) {
      case "month":
        const monthOption = MONTHS_OPTIONS.find(m => m.value === selectedMonth);
        return `${monthOption?.label} de ${selectedYear}`;
      case "quarter":
        const quarter = QUARTERS.find(q => q.value === selectedQuarter);
        return `${quarter?.label} - ${selectedYear}`;
      case "semester":
        const semester = SEMESTERS.find(s => s.value === selectedSemester);
        return `${semester?.label} - ${selectedYear}`;
      case "annual":
      default:
        return `Relatório Anual - ${selectedYear}`;
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, selectedSemester]);

  // Fetch all active brokers
  const { data: brokersRaw = [] } = useQuery({
    queryKey: ["sales-brokers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_brokers")
        .select("id, name, team_id, is_launch, sales_teams(name)")
        .eq("is_active", true)
        .eq("broker_type", "venda")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    ...queryConfig,
  });

  // Filtrar corretores pela equipe selecionada
  const brokers = useMemo(() => {
    if (teamFilter === "all") return brokersRaw;
    return brokersRaw.filter((b: any) => b.team_id === teamFilter);
  }, [brokersRaw, teamFilter]);

  // Fetch broker's sales data for the period using proportional values
  const { data: salesData = [], isLoading: loadingSales } = useQuery({
    queryKey: ["broker-sales-history", selectedBrokerId, months],
    queryFn: async () => {
      if (!selectedBrokerId || months.length === 0) return [];
      const results = await Promise.all(
        months.map(async (month) => {
          // Use view for proportional values
          const { data } = await supabase
            .from("broker_sales_proportional")
            .select("proportional_value, sale_id, property_name, sale_date, role")
            .eq("broker_id", selectedBrokerId)
            .eq("year_month", month);
          const total = (data || []).reduce((acc, s) => acc + (Number(s.proportional_value) || 0), 0);
          const count = new Set(data?.map(s => s.sale_id)).size;
          const [y, m] = month.split("-").map(Number);
          return {
            yearMonth: month,
            month: format(new Date(y, m - 1, 1), "MMM", { locale: ptBR }),
            vgv: total,
            vendas: count,
          };
        })
      );
      return results;
    },
    enabled: !!selectedBrokerId,
    ...queryConfig,
  });

  // Fetch broker's proposals data for the period
  const { data: proposalsData = [], isLoading: loadingProposals } = useQuery({
    queryKey: ["broker-proposals-history", selectedBrokerId, months],
    queryFn: async () => {
      if (!selectedBrokerId || months.length === 0) return [];
      const results = await Promise.all(
        months.map(async (month) => {
          const { data } = await supabase
            .from("broker_monthly_proposals")
            .select("proposals_count, proposals_converted")
            .eq("broker_id", selectedBrokerId)
            .eq("year_month", month)
            .maybeSingle();
          const [y, m] = month.split("-").map(Number);
          return {
            yearMonth: month,
            month: format(new Date(y, m - 1, 1), "MMM", { locale: ptBR }),
            total: data?.proposals_count || 0,
            convertidas: data?.proposals_converted || 0,
          };
        })
      );
      return results;
    },
    enabled: !!selectedBrokerId,
    ...queryConfig,
  });

  // Fetch broker's leads data for the period
  const { data: leadsData = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["broker-leads-history", selectedBrokerId, months],
    queryFn: async () => {
      if (!selectedBrokerId || months.length === 0) return [];
      const results = await Promise.all(
        months.map(async (month) => {
          const { data } = await supabase
            .from("monthly_leads")
            .select("leads_received, leads_active, gimob_key_visits, scheduled_visits, builder_visits")
            .eq("broker_id", selectedBrokerId)
            .eq("year_month", month)
            .maybeSingle();
          const totalVisits = (data?.gimob_key_visits || 0) + (data?.scheduled_visits || 0) + (data?.builder_visits || 0);
          const [y, m] = month.split("-").map(Number);
          return {
            yearMonth: month,
            month: format(new Date(y, m - 1, 1), "MMM", { locale: ptBR }),
            recebidos: data?.leads_received || 0,
            ativos: data?.leads_active || 0,
            visitas: totalVisits,
          };
        })
      );
      return results;
    },
    enabled: !!selectedBrokerId,
    ...queryConfig,
  });

  // Fetch broker's evaluations data for the period
  const { data: evaluationsData = [], isLoading: loadingEvaluations } = useQuery({
    queryKey: ["broker-evaluations-history", selectedBrokerId, months],
    queryFn: async () => {
      if (!selectedBrokerId || months.length === 0) return [];
      const results = await Promise.all(
        months.map(async (month) => {
          const { data } = await supabase
            .from("broker_evaluations")
            .select("average_score, classification, is_launch")
            .eq("broker_id", selectedBrokerId)
            .eq("year_month", month)
            .maybeSingle();
          const [y, m] = month.split("-").map(Number);
          return {
            yearMonth: month,
            month: format(new Date(y, m - 1, 1), "MMM", { locale: ptBR }),
            nota: data?.average_score || 0,
            classificacao: data?.classification || "-",
            isLaunch: data?.is_launch || false,
          };
        })
      );
      return results;
    },
    enabled: !!selectedBrokerId,
    ...queryConfig,
  });

  // Verificar se o corretor foi marcado como lançamento em algum mês do período
  const isLaunchInPeriod = evaluationsData.some(e => e.isLaunch === true);

  // Calculate totals
  // Fetch individual sale details for VGV popover
  const { data: saleDetails = [] } = useQuery({
    queryKey: ["broker-sale-details", selectedBrokerId, reportMonths],
    queryFn: async () => {
      if (!selectedBrokerId || reportMonths.length === 0) return [];
      const { data } = await supabase
        .from("broker_sales_proportional")
        .select("sale_id, property_name, sale_date, proportional_value, role")
        .eq("broker_id", selectedBrokerId)
        .in("year_month", reportMonths)
        .order("sale_date", { ascending: true });
      return data || [];
    },
    enabled: !!selectedBrokerId && reportMonths.length > 0,
    ...queryConfig,
  });

  // Pre-load evaluation details for PDF export
  const { data: evalDetailsPdf } = useQuery({
    queryKey: ["broker-eval-details-preload", selectedBrokerId, reportMonths],
    queryFn: async () => {
      if (!selectedBrokerId || reportMonths.length === 0) return null;
      const { data, error } = await supabase
        .from("broker_evaluations")
        .select("year_month, obs_feedbacks, acoes_melhorias_c2s, metas_acoes_futuras, average_score")
        .eq("broker_id", selectedBrokerId)
        .in("year_month", reportMonths)
        .order("year_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBrokerId && reportMonths.length > 0,
    ...queryConfig,
  });

  const { data: lastVisitDatePdf } = useQuery({
    queryKey: ["broker-last-visit-preload", selectedBrokerId, reportMonths],
    queryFn: async () => {
      if (!selectedBrokerId || reportMonths.length === 0) return null;
      const { data, error } = await supabase
        .from("monthly_leads")
        .select("last_visit_date")
        .eq("broker_id", selectedBrokerId)
        .in("year_month", reportMonths)
        .not("last_visit_date", "is", null)
        .order("last_visit_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.last_visit_date || null;
    },
    enabled: !!selectedBrokerId && reportMonths.length > 0,
    ...queryConfig,
  });

  const reportSalesData = salesData.filter(s => reportMonths.includes(s.yearMonth));
  const reportProposalsData = proposalsData.filter(p => reportMonths.includes(p.yearMonth));
  const reportLeadsData = leadsData.filter(l => reportMonths.includes(l.yearMonth));
  const reportEvaluationsData = evaluationsData.filter(e => reportMonths.includes(e.yearMonth));

  const totalVGV = reportSalesData.reduce((acc, s) => acc + s.vgv, 0);
  const totalSales = reportSalesData.reduce((acc, s) => acc + s.vendas, 0);
  const totalProposals = reportProposalsData.reduce((acc, p) => acc + p.total, 0);
  const totalConverted = reportProposalsData.reduce((acc, p) => acc + p.convertidas, 0);
  const totalLeads = reportLeadsData.reduce((acc, l) => acc + l.recebidos, 0);
  const totalLeadsActive = reportLeadsData.reduce((acc, l) => Math.max(acc, l.ativos), 0);
  const totalVisits = reportLeadsData.reduce((acc, l) => acc + l.visitas, 0);
  const avgScore = reportEvaluationsData.filter(e => e.nota > 0).length > 0
    ? reportEvaluationsData.filter(e => e.nota > 0).reduce((acc, e) => acc + e.nota, 0) / reportEvaluationsData.filter(e => e.nota > 0).length
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value === 0) return "";
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  const selectedBroker = brokers.find((b: { id: string }) => b.id === selectedBrokerId) as { id: string; name: string; team_id: string | null; is_launch?: boolean; sales_teams: { name: string } | null } | undefined;

  const handleExportPDF = async () => {
    if (!reportRef.current || !selectedBrokerId) {
      toast.error("Selecione um corretor primeiro");
      return;
    }

    try {
      const [evaluationRes, lastVisitRes] = await Promise.all([
        supabase
          .from("broker_evaluations")
          .select("year_month, obs_feedbacks, acoes_melhorias_c2s, metas_acoes_futuras, average_score")
          .eq("broker_id", selectedBrokerId)
          .in("year_month", reportMonths)
          .order("year_month", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("monthly_leads")
          .select("last_visit_date")
          .eq("broker_id", selectedBrokerId)
          .in("year_month", reportMonths)
          .not("last_visit_date", "is", null)
          .order("last_visit_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setPdfEvaluationSnapshot(evaluationRes.data ?? null);
      setPdfLastVisitSnapshot(lastVisitRes.data?.last_visit_date ?? null);

      setIsExporting(true);
      // Wait for React to render PDF-only blocks
      await new Promise((r) => setTimeout(r, 450));

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          const svgs = clonedDoc.querySelectorAll("svg");
          svgs.forEach((svg) => {
            svg.style.fontFamily = "sans-serif";
          });
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const margin = 5;
      const maxWidth = pdfWidth - margin * 2;
      const maxHeight = pdfHeight - margin * 2;
      const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = margin;

      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`relatorio_${selectedBroker?.name || "corretor"}_${selectedYear}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
      setPdfEvaluationSnapshot(null);
      setPdfLastVisitSnapshot(null);
    }
  };

  const isLoading = loadingSales || loadingProposals || loadingLeads || loadingEvaluations;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Selecione um corretor" />
          </SelectTrigger>
          <SelectContent>
            {brokers.map((broker: { id: string; name: string; sales_teams: { name: string } | null }) => (
              <SelectItem key={broker.id} value={broker.id}>
                {broker.name}
                {broker.sales_teams && ` (${broker.sales_teams.name})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mensal</SelectItem>
            <SelectItem value="quarter">Trimestral</SelectItem>
            <SelectItem value="semester">Semestral</SelectItem>
            <SelectItem value="annual">Anual</SelectItem>
          </SelectContent>
        </Select>

        {periodType === "month" && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_OPTIONS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {periodType === "quarter" && (
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => (
                <SelectItem key={q.value} value={q.value}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {periodType === "semester" && (
          <Select value={selectedSemester} onValueChange={setSelectedSemester}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEMESTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button 
          onClick={handleExportPDF} 
          disabled={!selectedBrokerId || isExporting}
          variant="outline"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar PDF
        </Button>
      </div>

      {!selectedBrokerId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um corretor para visualizar o relatório individual
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div ref={reportRef} className="space-y-6 bg-background p-4 rounded-lg">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-2xl font-bold">{selectedBroker?.name}</h2>
            {selectedBroker?.sales_teams && (
              <p className="text-muted-foreground">Equipe: {selectedBroker.sales_teams.name}</p>
            )}
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  VGV Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-primary">{formatCurrency(totalVGV)}</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <p className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors underline">
                      {totalSales} vendas
                    </p>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-h-60 overflow-y-auto">
                    <h4 className="font-medium text-sm mb-2">Detalhes das Vendas</h4>
                    {saleDetails.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
                    ) : (
                      <div className="space-y-2">
                        {saleDetails.map((sale: any, idx: number) => {
                          const [y,m,d] = (sale.sale_date || "").split("-").map(Number);
                          const dateStr = y ? new Date(y, m-1, d).toLocaleDateString("pt-BR") : "-";
                          return (
                            <div key={idx} className="flex justify-between items-start p-2 bg-muted/50 rounded text-sm">
                              <div>
                                <div className="font-medium">{sale.property_name || "Sem nome"}</div>
                                <div className="text-xs text-muted-foreground">{dateStr}</div>
                                <Badge variant="outline" className="text-[10px] mt-1">
                                  {sale.role === "owner" ? "Titular" : "Parceiro"}
                                </Badge>
                              </div>
                              <div className="font-semibold text-primary text-right">
                                {Number(sale.proportional_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Propostas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{totalProposals}</div>
                <p className="text-xs text-muted-foreground">{totalConverted} convertidas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{totalLeads}</div>
                <p className="text-xs text-muted-foreground">
                  Ativos: {totalLeadsActive} | Visitas: {totalVisits}
                </p>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow hover:ring-2 hover:ring-primary/20",
                isLaunchInPeriod && "ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-900/10"
              )}
              onClick={() => setEvaluationDetailsOpen(true)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {isLaunchInPeriod ? (
                    <Rocket className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Star className="h-4 w-4 text-yellow-500" />
                  )}
                  Média Avaliação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{avgScore.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">clique para ver detalhes</p>
              </CardContent>
            </Card>
          </div>

          {/* Evaluation Details Dialog */}
          <EvaluationDetailsDialog
            open={evaluationDetailsOpen}
            onOpenChange={setEvaluationDetailsOpen}
            brokerId={selectedBrokerId}
            brokerName={selectedBroker?.name || ""}
            months={months}
          />

          {/* Detalhes das Vendas - apenas no PDF */}
          {isExporting && saleDetails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalhes das Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imóvel</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleDetails.map((sale: any, idx: number) => {
                      const [y,m,d] = (sale.sale_date || "").split("-").map(Number);
                      const dateStr = y ? new Date(y, m-1, d).toLocaleDateString("pt-BR") : "-";
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{sale.property_name || "Sem nome"}</TableCell>
                          <TableCell>{dateStr}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {sale.role === "owner" ? "Titular" : "Parceiro"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {Number(sale.proportional_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Detalhes da Avaliação - apenas no PDF (snapshot do export) */}
          {isExporting && (((pdfEvaluationSnapshot ?? evalDetailsPdf)?.obs_feedbacks) || ((pdfEvaluationSnapshot ?? evalDetailsPdf)?.acoes_melhorias_c2s) || ((pdfEvaluationSnapshot ?? evalDetailsPdf)?.metas_acoes_futuras) || (pdfLastVisitSnapshot ?? lastVisitDatePdf)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalhes da Avaliação</CardTitle>
                {(pdfEvaluationSnapshot ?? evalDetailsPdf)?.year_month && (
                  <p className="text-xs text-muted-foreground">
                    Ref: {(pdfEvaluationSnapshot ?? evalDetailsPdf).year_month}
                    {(pdfEvaluationSnapshot ?? evalDetailsPdf).average_score !== null && ` (Nota: ${(pdfEvaluationSnapshot ?? evalDetailsPdf).average_score.toFixed(1)})`}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {(pdfLastVisitSnapshot ?? lastVisitDatePdf) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                      <Calendar className="h-3 w-3" />
                      Última Visita
                    </div>
                    <p className="text-sm font-medium">
                      {(() => { const [y,m,d] = (pdfLastVisitSnapshot ?? lastVisitDatePdf).split("-").map(Number); return new Date(y, m-1, d).toLocaleDateString("pt-BR"); })()}
                    </p>
                  </div>
                )}
                {(pdfEvaluationSnapshot ?? evalDetailsPdf)?.obs_feedbacks && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      OBS/Feedbacks
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{(pdfEvaluationSnapshot ?? evalDetailsPdf).obs_feedbacks}</p>
                  </div>
                )}
                {(pdfEvaluationSnapshot ?? evalDetailsPdf)?.acoes_melhorias_c2s && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                      <TrendingUpIcon2 className="h-3 w-3" />
                      Ações para Melhorias C2S
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{(pdfEvaluationSnapshot ?? evalDetailsPdf).acoes_melhorias_c2s}</p>
                  </div>
                )}
                {(pdfEvaluationSnapshot ?? evalDetailsPdf)?.metas_acoes_futuras && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                      <Target className="h-3 w-3" />
                      Metas/Ações Futuras
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{(pdfEvaluationSnapshot ?? evalDetailsPdf).metas_acoes_futuras}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* VGV Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução de VGV</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="vgv" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      <LabelList 
                        dataKey="vgv" 
                        position="top" 
                        formatter={(v: number) => formatCurrencyShort(v)} 
                        fontSize={9}
                        fill="hsl(var(--foreground))"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Proposals Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução de Propostas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={proposalsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]}>
                      <LabelList 
                        dataKey="total" 
                        position="top" 
                        fontSize={9}
                        fill="hsl(var(--foreground))"
                        formatter={(v: number) => v > 0 ? v : ""}
                      />
                    </Bar>
                    <Bar dataKey="convertidas" name="Convertidas" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]}>
                      <LabelList 
                        dataKey="convertidas" 
                        position="top" 
                        fontSize={9}
                        fill="hsl(var(--foreground))"
                        formatter={(v: number) => v > 0 ? v : ""}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Leads Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução de Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={leadsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="recebidos" name="Recebidos" stroke="hsl(217 91% 60%)" strokeWidth={2}>
                      <LabelList 
                        dataKey="recebidos" 
                        position="top" 
                        fontSize={9}
                        fill="hsl(217 91% 60%)"
                        formatter={(v: number) => v > 0 ? v : ""}
                      />
                    </Line>
                    <Line type="monotone" dataKey="ativos" name="Ativos" stroke="hsl(142 76% 36%)" strokeWidth={2}>
                      <LabelList 
                        dataKey="ativos" 
                        position="bottom" 
                        fontSize={9}
                        fill="hsl(142 76% 36%)"
                        formatter={(v: number) => v > 0 ? v : ""}
                      />
                    </Line>
                    <Line type="monotone" dataKey="visitas" name="Visitas" stroke="hsl(38 92% 50%)" strokeWidth={2}>
                      <LabelList 
                        dataKey="visitas" 
                        position="top" 
                        fontSize={9}
                        fill="hsl(38 92% 50%)"
                        offset={15}
                        formatter={(v: number) => v > 0 ? v : ""}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Evaluation Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução de Avaliações</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={evaluationsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="nota" 
                      name="Nota" 
                      stroke="hsl(38 92% 50%)" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(38 92% 50%)" }}
                    >
                      <LabelList 
                        dataKey="nota" 
                        position="top" 
                        fontSize={10}
                        fill="hsl(38 92% 50%)"
                        formatter={(v: number) => v > 0 ? v.toFixed(1) : ""}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
