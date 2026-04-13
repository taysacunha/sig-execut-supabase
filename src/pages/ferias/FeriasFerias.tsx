import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Wand2, Search, Calendar, AlertTriangle, CheckCircle2, 
  Loader2, Edit, Eye, Plus, Sparkles, CalendarMinus,
  FileText, Clock, XCircle, Download, ArrowUpDown, Printer,
  ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { FeriasDialog } from "@/components/ferias/ferias/FeriasDialog";
import { FeriasViewDialog } from "@/components/ferias/ferias/FeriasViewDialog";
import { GeradorFeriasDialog } from "@/components/ferias/gerador/GeradorFeriasDialog";
import { ReducaoFeriasDialog } from "@/components/ferias/ferias/ReducaoFeriasDialog";
import { FormularioAnualDialog } from "@/components/ferias/formulario/FormularioAnualDialog";
import { FormularioAnualViewDialog } from "@/components/ferias/formulario/FormularioAnualViewDialog";
import { FormularioPDFGenerator } from "@/components/ferias/relatorios/FormularioPDFGenerator";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/vendas/TableControls";

// ========== Types ==========

interface FeriasRecord {
  id: string;
  colaborador_id: string;
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio: string | null;
  quinzena2_fim: string | null;
  gozo_diferente: boolean;
  gozo_flexivel: boolean;
  gozo_quinzena1_inicio: string | null;
  gozo_quinzena1_fim: string | null;
  gozo_quinzena2_inicio: string | null;
  gozo_quinzena2_fim: string | null;
  vender_dias: boolean;
  dias_vendidos: number | null;
  quinzena_venda: number | null;
  status: string;
  is_excecao: boolean;
  excecao_motivo: string | null;
  excecao_justificativa: string | null;
  origem: string | null;
  periodo_aquisitivo_inicio: string | null;
  periodo_aquisitivo_fim: string | null;
  created_at: string;
  colaborador: {
    id: string;
    nome: string;
    cpf: string | null;
    setor_titular: {
      id: string;
      nome: string;
    } | null;
  } | null;
}

interface GozoPeriodo {
  id: string;
  ferias_id: string;
  numero: number;
  dias: number;
  data_inicio: string;
  data_fim: string;
  referencia_periodo: number | null;
}

interface FormularioAnual {
  id: string;
  colaborador_id: string;
  ano_referencia: number;
  periodo1_mes: number | null;
  periodo1_quinzena: string | null;
  periodo2_mes: number | null;
  periodo2_quinzena: string | null;
  periodo3_mes: number | null;
  periodo3_quinzena: string | null;
  periodo_preferencia: number | null;
  vender_dias: boolean | null;
  dias_vender: number | null;
  observacao: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  colaborador?: {
    id: string;
    nome: string;
    setor_titular?: { id: string; nome: string; } | null;
  } | null;
}

// ========== Constants ==========

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

import { getYearOptions, FERIAS_STATUS_LABELS as statusLabels, FERIAS_STATUS_COLORS as statusColors, isFeriasEmGozo } from "@/lib/dateUtils";

const formularioStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: <Clock className="h-3 w-3" /> },
  aprovado: { label: "Aprovado", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejeitado: { label: "Rejeitado", color: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
  em_analise: { label: "Em Análise", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
};

// ========== Component ==========

export default function FeriasFerias() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const { hasAccess: hasRoleAccess } = useUserRole();
  const canEditFerias = canEdit("ferias");
  const isAdmin = hasRoleAccess(["super_admin", "admin", "manager"]);

  const [activeTab, setActiveTab] = useState("ferias");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [setorFilter, setSetorFilter] = useState<string>("all");
  const currentYear = new Date().getFullYear();
  const [anoFilter, setAnoFilter] = useState<string>(currentYear.toString());
  const [feriasSortField, setFeriasSortField] = useState<"nome" | "setor" | "status">("nome");
  const [feriasSortDir, setFeriasSortDir] = useState<"asc" | "desc">("asc");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [geradorDialogOpen, setGeradorDialogOpen] = useState(false);
  const [selectedFerias, setSelectedFerias] = useState<FeriasRecord | null>(null);
  const [reducaoDialogOpen, setReducaoDialogOpen] = useState(false);
  const [reducaoFerias, setReducaoFerias] = useState<FeriasRecord | null>(null);

  // Formulários state
  const [formSearchTerm, setFormSearchTerm] = useState("");
  const [formAnoFilter, setFormAnoFilter] = useState<string>((currentYear + 1).toString());
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formViewDialogOpen, setFormViewDialogOpen] = useState(false);
  const [selectedFormulario, setSelectedFormulario] = useState<FormularioAnual | null>(null);
  const [formulariosOpen, setFormulariosOpen] = useState(false);

  const years = getYearOptions(3, 3).map(String);

  const invalidateFeriasDashboardQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["ferias-dashboard-proximas"] });
    queryClient.invalidateQueries({ queryKey: ["ferias-dashboard-ferias-mes"] });
    queryClient.invalidateQueries({ queryKey: ["ferias-dashboard-alertas"] });
  }, [queryClient]);

  // ========== Queries ==========

  const { data: ferias = [], isLoading: feriasLoading, error: feriasError } = useQuery({
    queryKey: ["ferias-ferias", anoFilter],
    queryFn: async () => {
      const { error: statusError } = await supabase.rpc("atualizar_status_ferias");
      if (statusError) {
        console.error("Erro ao atualizar status de férias:", statusError);
        throw new Error(`Falha ao atualizar status: ${statusError.message}`);
      }
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select(`*, colaborador:ferias_colaboradores!colaborador_id (id, nome, cpf, setor_titular:ferias_setores!setor_titular_id (id, nome))`)
        .gte("quinzena1_inicio", `${anoFilter}-01-01`)
        .lte("quinzena1_inicio", `${anoFilter}-12-31`)
        .order("quinzena1_inicio", { ascending: false });
      if (error) throw error;
      return data as FeriasRecord[];
    },
  });

  const { data: formularios = [], isLoading: formLoading } = useQuery({
    queryKey: ["ferias-formularios", formAnoFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_formulario_anual")
        .select(`*, colaborador:ferias_colaboradores!colaborador_id (id, nome, setor_titular:ferias_setores!setor_titular_id (id, nome))`)
        .eq("ano_referencia", parseInt(formAnoFilter))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FormularioAnual[];
    },
  });

  // Fetch flexible gozo periods for all ferias with gozo_flexivel
  const flexFeriasIds = useMemo(() => ferias.filter(f => f.gozo_flexivel).map(f => f.id), [ferias]);
  
  const { data: gozoPeriodos = [] } = useQuery({
    queryKey: ["ferias-gozo-periodos-table", flexFeriasIds],
    queryFn: async () => {
      if (flexFeriasIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ferias_gozo_periodos" as any)
        .select("id, ferias_id, numero, dias, data_inicio, data_fim, referencia_periodo")
        .in("ferias_id", flexFeriasIds)
        .order("numero");
      if (error) throw error;
      return data as any as GozoPeriodo[];
    },
    enabled: flexFeriasIds.length > 0,
  });

  // Group gozo periods by ferias_id
  const gozoPeriodosByFeriasId = useMemo(() => {
    const map: Record<string, GozoPeriodo[]> = {};
    for (const p of gozoPeriodos) {
      if (!map[p.ferias_id]) map[p.ferias_id] = [];
      map[p.ferias_id].push(p);
    }
    return map;
  }, [gozoPeriodos]);

  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-filter"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_setores").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Delete mutations
  const deleteFeriasMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ferias_ferias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-ferias"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-com-ferias"] });
      invalidateFeriasDashboardQueries();
      toast.success("Férias excluída com sucesso!");
    },
    onError: () => toast.error("Erro ao excluir férias"),
  });

  const deleteFormularioMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ferias_formulario_anual").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-formularios"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-com-formulario"] });
      toast.success("Formulário excluído com sucesso!");
    },
    onError: () => toast.error("Erro ao excluir formulário"),
  });

  // ========== Filtered Data ==========

  const filteredFerias = useMemo(() => {
    return ferias.filter((f) => {
      const matchesSearch = normalizeText(f.colaborador?.nome || "").includes(normalizeText(searchTerm));
      const matchesStatus = statusFilter === "all" || f.status === statusFilter;
      const matchesSetor = setorFilter === "all" || f.colaborador?.setor_titular?.id === setorFilter;
      return matchesSearch && matchesStatus && matchesSetor;
    }).sort((a, b) => {
      let valA = "", valB = "";
      if (feriasSortField === "nome") { valA = a.colaborador?.nome || ""; valB = b.colaborador?.nome || ""; }
      else if (feriasSortField === "setor") { valA = a.colaborador?.setor_titular?.nome || ""; valB = b.colaborador?.setor_titular?.nome || ""; }
      else { valA = a.status || ""; valB = b.status || ""; }
      return feriasSortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [ferias, searchTerm, statusFilter, setorFilter, feriasSortField, feriasSortDir]);

  const filteredFormularios = useMemo(() => {
    return formularios.filter((f) => {
      const matchesSearch = normalizeText(f.colaborador?.nome || "").includes(normalizeText(formSearchTerm));
      return matchesSearch;
    });
  }, [formularios, formSearchTerm]);

  const [feriasPerPage, setFeriasPerPage] = useState(25);
  const [formPerPage, setFormPerPage] = useState(25);
  const [contadorPerPage, setContadorPerPage] = useState(25);

  const feriasPagination = usePagination(filteredFerias, feriasPerPage);
  const formPagination = usePagination(filteredFormularios, formPerPage);

  const handleFeriasSort = useCallback((field: "nome" | "setor" | "status") => {
    if (feriasSortField === field) setFeriasSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setFeriasSortField(field); setFeriasSortDir("asc"); }
  }, [feriasSortField]);

  // ========== Handlers ==========

  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return dateStr; }
  };
  const formatPeriodo = (inicio: string, fim: string) => `${formatDate(inicio)} a ${formatDate(fim)}`;
  const formatMes = (mes: number | null) => mes ? MONTHS[mes - 1] : "—";

  const feriasStats = useMemo(() => ({
    total: filteredFerias.length,
    emGozo: filteredFerias.filter(f => isFeriasEmGozo(f.status)).length,
    excecoes: filteredFerias.filter(f => f.is_excecao).length,
    geradas: filteredFerias.filter(f => f.origem === "formulario_anual").length,
  }), [filteredFerias]);

  const [contadorSortField, setContadorSortField] = useState<"nome" | "setor">("nome");
  const [contadorSortDir, setContadorSortDir] = useState<"asc" | "desc">("asc");

  const handleContadorSort = useCallback((field: "nome" | "setor") => {
    if (contadorSortField === field) setContadorSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setContadorSortField(field); setContadorSortDir("asc"); }
  }, [contadorSortField]);

  const contadorData = useMemo(() => {
    return filteredFerias
      .filter(f => f.status !== "cancelada")
      .sort((a, b) => {
        let valA = "", valB = "";
        if (contadorSortField === "nome") { valA = a.colaborador?.nome || ""; valB = b.colaborador?.nome || ""; }
        else { valA = a.colaborador?.setor_titular?.nome || ""; valB = b.colaborador?.setor_titular?.nome || ""; }
        return contadorSortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
  }, [filteredFerias, contadorSortField, contadorSortDir]);

  const contadorPagination = usePagination(contadorData, contadorPerPage);

  const calcAdjustedPeriodo = (inicio: string, fim: string, diasVendidos: number) => {
    if (diasVendidos <= 0) return formatPeriodo(inicio, fim);
    try {
      const restantes = 15 - diasVendidos;
      if (restantes <= 0) return "Vendido";
      const adjustedEnd = addDays(parseISO(inicio), restantes - 1);
      return `${formatDate(inicio)} a ${format(adjustedEnd, "dd/MM/yyyy", { locale: ptBR })}`;
    } catch { return formatPeriodo(inicio, fim); }
  };

  const generateContadorPDF = useCallback(() => {
    if (contadorData.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`TABELA DE FÉRIAS - CONTADOR - ${anoFilter}`, pageWidth / 2, 15, { align: "center" });

    let yPos = 25;
    const colWidths = [50, 30, 30, 45, 45, 45, 25];
    const headers = ["Colaborador", "CPF", "Setor", "Per. Aquisitivo", "1º Período", "2º Período", "Dias V."];

    pdf.setFillColor(220, 220, 220);
    pdf.rect(margin, yPos - 5, pageWidth - margin * 2, 8, "F");
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    let xPos = margin;
    headers.forEach((h, i) => { pdf.text(h, xPos + 2, yPos); xPos += colWidths[i]; });

    yPos += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);

    contadorData.forEach((f, idx) => {
      if (yPos > 190) {
        pdf.addPage();
        yPos = 15;
        pdf.setFillColor(220, 220, 220);
        pdf.rect(margin, yPos - 5, pageWidth - margin * 2, 8, "F");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        let hx = margin;
        headers.forEach((h, i) => { pdf.text(h, hx + 2, yPos); hx += colWidths[i]; });
        yPos += 6;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
      }

      if (idx % 2 === 1) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPos - 4, pageWidth - margin * 2, 6, "F");
      }

      const diasVend = f.vender_dias && f.dias_vendidos ? Math.min(f.dias_vendidos, 10) : 0;
      let vendP1 = 0, vendP2 = 0;
      if (diasVend > 0 && f.quinzena_venda) {
        if (f.quinzena_venda === 1) { vendP1 = diasVend; }
        else { vendP2 = diasVend; }
      }

      xPos = margin;
      pdf.text((f.colaborador?.nome || "—").substring(0, 28), xPos + 2, yPos);
      xPos += colWidths[0];
      pdf.text((f.colaborador?.cpf || "—").substring(0, 14), xPos + 2, yPos);
      xPos += colWidths[1];
      pdf.text((f.colaborador?.setor_titular?.nome || "—").substring(0, 15), xPos + 2, yPos);
      xPos += colWidths[2];
      pdf.text(f.periodo_aquisitivo_inicio && f.periodo_aquisitivo_fim ? formatPeriodo(f.periodo_aquisitivo_inicio, f.periodo_aquisitivo_fim) : "—", xPos + 2, yPos);
      xPos += colWidths[3];
      pdf.text(calcAdjustedPeriodo(f.quinzena1_inicio, f.quinzena1_fim, vendP1), xPos + 2, yPos);
      xPos += colWidths[4];
      pdf.text(f.quinzena2_inicio && f.quinzena2_fim ? calcAdjustedPeriodo(f.quinzena2_inicio, f.quinzena2_fim, vendP2) : "—", xPos + 2, yPos);
      xPos += colWidths[5];
      pdf.text(diasVend > 0 ? String(diasVend) : "—", xPos + 2, yPos);

      yPos += 6;
    });

    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | * Dias vendidos limitados a 10`, pageWidth / 2, pdf.internal.pageSize.getHeight() - 5, { align: "center" });

    pdf.save(`ferias-contador-${anoFilter}.pdf`);
    toast.success("PDF do contador exportado!");
  }, [contadorData, anoFilter, formatPeriodo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            Férias
          </h1>
          <p className="text-muted-foreground">Gerenciamento de férias dos colaboradores</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="ferias" className="flex items-center gap-2"><Calendar className="h-4 w-4" />Tabela de Férias</TabsTrigger>
          <TabsTrigger value="contador" className="flex items-center gap-2"><Download className="h-4 w-4" />Tabela do Contador</TabsTrigger>
        </TabsList>

        {/* ========== ABA: TABELA DE FÉRIAS ========== */}
        <TabsContent value="ferias" className="mt-6 space-y-6">
          {canEditFerias && (
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={() => setGeradorDialogOpen(true)} className="gap-2"><Wand2 className="h-4 w-4" />Gerar Férias</Button>
              <Button onClick={() => { setSelectedFerias(null); setDialogOpen(true); }} variant="outline" className="gap-2"><Plus className="h-4 w-4" />Cadastro Manual</Button>
              <Button onClick={() => { setSelectedFormulario(null); setFormDialogOpen(true); }} variant="outline" className="gap-2"><FileText className="h-4 w-4" />Novo Formulário</Button>
            </div>
          )}

          {feriasError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Erro ao atualizar status das férias: {feriasError.message}. Os dados exibidos podem estar desatualizados.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{feriasStats.total}</div></CardContent></Card>
            <Card className="border-green-500/20"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Em Gozo</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{feriasStats.emGozo}</div></CardContent></Card>
            <Card className="border-orange-500/20"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-600">Exceções</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{feriasStats.excecoes}</div></CardContent></Card>
            <Card className="border-primary/20"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-primary flex items-center gap-1"><Sparkles className="h-3 w-3" />Geradas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{feriasStats.geradas}</div></CardContent></Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
                <Select value={anoFilter} onValueChange={setAnoFilter}><SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
                <Select value={setorFilter} onValueChange={setSetorFilter}><SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os setores</SelectItem>{setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {feriasLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredFerias.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4 opacity-50" /><p>Nenhuma férias encontrada</p><p className="text-sm">Clique em "Gerar Férias" para criar a partir dos formulários</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleFeriasSort("nome")}>Colaborador <ArrowUpDown className="inline h-3 w-3 ml-1" /></TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleFeriasSort("setor")}>Setor <ArrowUpDown className="inline h-3 w-3 ml-1" /></TableHead>
                        <TableHead>Períodos</TableHead>
                        <TableHead>Venda</TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleFeriasSort("status")}>Status <ArrowUpDown className="inline h-3 w-3 ml-1" /></TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Exceção</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feriasPagination.paginatedItems.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.colaborador?.nome || "—"}</TableCell>
                          <TableCell>{f.colaborador?.setor_titular?.nome || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {f.gozo_flexivel && gozoPeriodosByFeriasId[f.id]?.length
                              ? (() => {
                                  const periods = gozoPeriodosByFeriasId[f.id];
                                  const hasQ2Flex = periods.some(p => p.referencia_periodo === 2);
                                  return (
                                    <>
                                      {periods.map((p) => (
                                        <div key={p.id}>{formatPeriodo(p.data_inicio, p.data_fim)} <span className="text-muted-foreground">({p.dias}d)</span></div>
                                      ))}
                                      {!hasQ2Flex && f.quinzena2_inicio && f.quinzena2_fim && (
                                        <div>{formatPeriodo(f.quinzena2_inicio, f.quinzena2_fim)}</div>
                                      )}
                                      {!hasQ2Flex && !f.quinzena2_inicio && (
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 text-xs mt-1"><Clock className="h-3 w-3" />2º pendente</Badge>
                                      )}
                                    </>
                                  );
                                })()
                              : f.gozo_diferente && f.gozo_quinzena1_inicio
                                ? (
                                  <>
                                    <div>{formatPeriodo(f.gozo_quinzena1_inicio, f.gozo_quinzena1_fim!)}</div>
                                    {f.gozo_quinzena2_inicio && f.gozo_quinzena2_fim && (
                                      <div>{formatPeriodo(f.gozo_quinzena2_inicio, f.gozo_quinzena2_fim)}</div>
                                    )}
                                  </>
                                )
                                : (
                                  <>
                                    <div>{formatPeriodo(f.quinzena1_inicio, f.quinzena1_fim)}</div>
                                    {f.quinzena2_inicio && f.quinzena2_fim
                                      ? <div>{formatPeriodo(f.quinzena2_inicio, f.quinzena2_fim)}</div>
                                      : <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 text-xs mt-1"><Clock className="h-3 w-3" />2º pendente</Badge>
                                    }
                                  </>
                                )
                            }
                          </TableCell>
                          <TableCell>{f.vender_dias && f.dias_vendidos ? <Badge variant="outline" className="text-xs">{f.dias_vendidos} dias</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                          <TableCell><Badge variant="outline" className={statusColors[f.status]}>{statusLabels[f.status] || f.status}</Badge></TableCell>
                          <TableCell>{f.origem === "formulario_anual" ? <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1"><Sparkles className="h-3 w-3" />Gerada</Badge> : <span className="text-muted-foreground text-xs">Manual</span>}</TableCell>
                          <TableCell>{f.is_excecao ? <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1"><AlertTriangle className="h-3 w-3" />Sim</Badge> : <CheckCircle2 className="h-4 w-4 text-green-500" />}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedFerias(f); setViewDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                              {canEditFerias && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => { setSelectedFerias(f); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                  {(f.status === "aprovada" || isFeriasEmGozo(f.status)) && (
                                    <Button variant="ghost" size="sm" title="Reduzir dias" onClick={() => { setReducaoFerias(f); setReducaoDialogOpen(true); }}><CalendarMinus className="h-4 w-4 text-warning" /></Button>
                                  )}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir férias</AlertDialogTitle>
                                        <AlertDialogDescription>Tem certeza que deseja excluir as férias de <strong>{f.colaborador?.nome}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteFeriasMutation.mutate(f.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    currentPage={feriasPagination.currentPage}
                    totalPages={feriasPagination.totalPages}
                    itemsPerPage={feriasPerPage}
                    onPageChange={feriasPagination.setCurrentPage}
                    onItemsPerPageChange={(v) => { setFeriasPerPage(v); feriasPagination.setCurrentPage(1); }}
                    totalItems={filteredFerias.length}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ========== SEÇÃO COLAPSÁVEL: FORMULÁRIOS ANUAIS ========== */}
          <Collapsible open={formulariosOpen} onOpenChange={setFormulariosOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Formulários Anuais ({formularios.length} registros)
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <FormularioPDFGenerator anoReferencia={parseInt(formAnoFilter)} />
                      {formulariosOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar colaborador..." value={formSearchTerm} onChange={(e) => setFormSearchTerm(e.target.value)} className="pl-10" /></div>
                    <Select value={formAnoFilter} onValueChange={setFormAnoFilter}><SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                  </div>

                  {formLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : filteredFormularios.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <FileText className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">Nenhum formulário encontrado</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Colaborador</TableHead>
                            <TableHead>Setor</TableHead>
                            <TableHead>1ª Opção</TableHead>
                            <TableHead>2ª Opção</TableHead>
                            <TableHead>3ª Opção</TableHead>
                            <TableHead>Preferido</TableHead>
                            <TableHead>Venda</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formPagination.paginatedItems.map((f) => {
                            const status = formularioStatusConfig[f.status || "pendente"];
                            return (
                              <TableRow key={f.id}>
                                <TableCell className="font-medium">{f.colaborador?.nome || "—"}</TableCell>
                                <TableCell>{f.colaborador?.setor_titular?.nome || "—"}</TableCell>
                                <TableCell className="text-sm">{formatMes(f.periodo1_mes)}</TableCell>
                                <TableCell className="text-sm">{formatMes(f.periodo2_mes)}</TableCell>
                                <TableCell className="text-sm">{formatMes(f.periodo3_mes)}</TableCell>
                                <TableCell>{f.periodo_preferencia ? <Badge variant="secondary" className="text-xs">{f.periodo_preferencia}ª opção</Badge> : "—"}</TableCell>
                                <TableCell>{f.vender_dias && f.dias_vender ? <Badge variant="outline" className="text-xs">{f.dias_vender} dias</Badge> : <span className="text-muted-foreground text-xs">Não</span>}</TableCell>
                                <TableCell><Badge variant="outline" className={`${status.color} gap-1`}>{status.icon}{status.label}</Badge></TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => { setSelectedFormulario(f); setFormViewDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                                    {canEditFerias && (
                                      <>
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedFormulario(f); setFormDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Excluir formulário</AlertDialogTitle>
                                              <AlertDialogDescription>Tem certeza que deseja excluir o formulário de <strong>{f.colaborador?.nome}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => deleteFormularioMutation.mutate(f.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <TablePagination
                        currentPage={formPagination.currentPage}
                        totalPages={formPagination.totalPages}
                        itemsPerPage={formPerPage}
                        onPageChange={formPagination.setCurrentPage}
                        onItemsPerPageChange={(v) => { setFormPerPage(v); formPagination.setCurrentPage(1); }}
                        totalItems={filteredFormularios.length}
                      />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        {/* ========== ABA: TABELA DO CONTADOR ========== */}
        <TabsContent value="contador" className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex gap-4 items-end">
              <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-56" /></div>
              <Select value={setorFilter} onValueChange={setSetorFilter}><SelectTrigger className="w-48"><SelectValue placeholder="Setor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os setores</SelectItem>{setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => generateContadorPDF()}><Printer className="h-4 w-4" />Exportar PDF</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {feriasLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : contadorData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Download className="h-12 w-12 mb-4 opacity-50" /><p>Nenhuma férias encontrada para o ano selecionado</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleContadorSort("nome")}>Colaborador <ArrowUpDown className="inline h-3 w-3 ml-1" /></TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleContadorSort("setor")}>Setor <ArrowUpDown className="inline h-3 w-3 ml-1" /></TableHead>
                        <TableHead>Período Aquisitivo</TableHead>
                        <TableHead>1º Período</TableHead>
                        <TableHead>2º Período</TableHead>
                        <TableHead>Dias Vendidos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contadorPagination.paginatedItems.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.colaborador?.nome || "—"}</TableCell>
                          <TableCell>{f.colaborador?.setor_titular?.nome || "—"}</TableCell>
                          <TableCell className="text-sm">{f.periodo_aquisitivo_inicio && f.periodo_aquisitivo_fim ? formatPeriodo(f.periodo_aquisitivo_inicio, f.periodo_aquisitivo_fim) : "—"}</TableCell>
                          <TableCell className="text-sm">{formatPeriodo(f.quinzena1_inicio, f.quinzena1_fim)}</TableCell>
                          <TableCell className="text-sm">{f.quinzena2_inicio && f.quinzena2_fim ? formatPeriodo(f.quinzena2_inicio, f.quinzena2_fim) : "—"}</TableCell>
                          <TableCell>{f.vender_dias && f.dias_vendidos ? <Badge variant="outline" className="text-xs">{Math.min(f.dias_vendidos, 10)} dias</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    currentPage={contadorPagination.currentPage}
                    totalPages={contadorPagination.totalPages}
                    itemsPerPage={contadorPerPage}
                    onPageChange={contadorPagination.setCurrentPage}
                    onItemsPerPageChange={(v) => { setContadorPerPage(v); contadorPagination.setCurrentPage(1); }}
                    totalItems={contadorData.length}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== DIALOGS ========== */}
      <FeriasDialog open={dialogOpen} onOpenChange={setDialogOpen} ferias={selectedFerias} anoReferencia={parseInt(anoFilter)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["ferias-ferias"] }); queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-com-ferias"] }); setDialogOpen(false); }} />
      <FeriasViewDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} ferias={selectedFerias} />
      <GeradorFeriasDialog open={geradorDialogOpen} onOpenChange={setGeradorDialogOpen} anoReferencia={parseInt(anoFilter)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["ferias-ferias"] }); queryClient.invalidateQueries({ queryKey: ["ferias-formularios"] }); }} />
      <ReducaoFeriasDialog open={reducaoDialogOpen} onOpenChange={setReducaoDialogOpen} ferias={reducaoFerias} colaboradorNome={reducaoFerias?.colaborador?.nome || ""} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ferias-ferias"] })} />
      <FormularioAnualDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} formulario={selectedFormulario} anoReferencia={parseInt(formAnoFilter)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["ferias-formularios"] }); queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-com-formulario"] }); setFormDialogOpen(false); }} />
      <FormularioAnualViewDialog open={formViewDialogOpen} onOpenChange={setFormViewDialogOpen} formulario={selectedFormulario} />
    </div>
  );
}
