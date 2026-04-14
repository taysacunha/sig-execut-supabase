import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Search, Loader2, ArrowUpDown, CheckCircle2, Clock, AlertTriangle, XCircle, Undo2, CheckCheck, Printer, ChevronDown, Timer } from "lucide-react";
import { format, parseISO, addYears, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/vendas/TableControls";
import { normalizeText } from "@/lib/textUtils";
import { toast } from "@/hooks/use-toast";
import { QuitarPeriodoDialog } from "./QuitarPeriodoDialog";

// ========== Types ==========

interface PeriodoAquisitivo {
  colaboradorId: string;
  colaboradorNome: string;
  setorNome: string;
  setorId: string;
  dataAdmissao: string;
  periodoInicio: string;
  periodoFim: string;
  concessivoInicio: string;
  concessivoFim: string;
  diasDireito: number;
  diasGozados: number;
  diasVendidos: number;
  diasQuitados: number;
  saldo: number;
  status: "quitado" | "parcial" | "pendente" | "a_vencer" | "vencido";
  quitacaoManualId?: string;
}

// ========== Helpers ==========

function calcDiasGozo(ferias: any): number {
  let dias = 0;
  if (ferias.quinzena1_inicio && ferias.quinzena1_fim) {
    dias += differenceInDays(parseISO(ferias.quinzena1_fim), parseISO(ferias.quinzena1_inicio)) + 1;
  }
  if (ferias.quinzena2_inicio && ferias.quinzena2_fim) {
    dias += differenceInDays(parseISO(ferias.quinzena2_fim), parseISO(ferias.quinzena2_inicio)) + 1;
  }
  const vendidos = ferias.dias_vendidos || 0;
  dias -= vendidos;
  return Math.max(0, dias);
}

function buildPeriodosAquisitivos(
  colaboradores: any[],
  feriasRecords: any[],
  gozoPeriodos: any[],
  quitacoes: any[],
  today: Date,
): PeriodoAquisitivo[] {
  const result: PeriodoAquisitivo[] = [];

  const gozoMap: Record<string, any[]> = {};
  for (const p of gozoPeriodos) {
    if (!gozoMap[p.ferias_id]) gozoMap[p.ferias_id] = [];
    gozoMap[p.ferias_id].push(p);
  }

  const quitMap: Record<string, any> = {};
  for (const q of quitacoes) {
    quitMap[`${q.colaborador_id}-${q.periodo_inicio}`] = q;
  }

  for (const colab of colaboradores) {
    const admissao = parseISO(colab.data_admissao);
    const anosDesde = Math.floor(differenceInDays(today, admissao) / 365);
    const maxPeriodos = Math.max(anosDesde + 1, 1);

    for (let i = 0; i < maxPeriodos; i++) {
      const periodoInicio = addYears(admissao, i);
      const periodoFim = addYears(admissao, i + 1);
      const concessivoInicio = periodoFim;
      const concessivoFim = addYears(periodoFim, 1);

      if (periodoInicio > today) continue;

      const periodoInicioStr = format(periodoInicio, "yyyy-MM-dd");
      const periodoFimStr = format(periodoFim, "yyyy-MM-dd");

      const colabFerias = feriasRecords.filter(f => {
        if (f.colaborador_id !== colab.id) return false;
        if (f.status === "cancelada") return false;
        if (f.periodo_aquisitivo_inicio && f.periodo_aquisitivo_fim) {
          return f.periodo_aquisitivo_inicio === periodoInicioStr && f.periodo_aquisitivo_fim === periodoFimStr;
        }
        const q1 = f.quinzena1_inicio;
        return q1 >= periodoInicioStr && q1 < format(concessivoFim, "yyyy-MM-dd");
      });

      let diasGozados = 0;
      let diasVendidos = 0;

      for (const f of colabFerias) {
        const periodos = gozoMap[f.id];
        if (periodos && periodos.length > 0) {
          diasGozados += periodos.reduce((sum: number, p: any) => sum + (p.dias || 0), 0);
        } else {
          diasGozados += calcDiasGozo(f);
        }
        diasVendidos += f.dias_vendidos || 0;
      }

      const quitacao = quitMap[`${colab.id}-${periodoInicioStr}`];
      const diasQuitados = quitacao?.dias_quitados || 0;

      const saldo = 30 - diasGozados - diasVendidos - diasQuitados;

      const diasParaVencer = differenceInDays(concessivoFim, today);

      let status: PeriodoAquisitivo["status"];
      if (saldo <= 0) {
        status = "quitado";
      } else if (concessivoFim <= today && saldo > 0) {
        status = "vencido";
      } else if (diasParaVencer <= 60 && diasParaVencer > 0 && saldo > 0 && (diasGozados === 0 && diasVendidos === 0 && diasQuitados === 0)) {
        status = "a_vencer";
      } else if (diasParaVencer <= 60 && diasParaVencer > 0 && saldo > 0) {
        // parcial but about to expire — still a_vencer
        status = "a_vencer";
      } else if (diasGozados > 0 || diasVendidos > 0 || diasQuitados > 0) {
        status = "parcial";
      } else {
        status = "pendente";
      }

      result.push({
        colaboradorId: colab.id,
        colaboradorNome: colab.nome,
        setorNome: colab.setor_titular?.nome || "—",
        setorId: colab.setor_titular?.id || "",
        dataAdmissao: colab.data_admissao,
        periodoInicio: periodoInicioStr,
        periodoFim: periodoFimStr,
        concessivoInicio: format(concessivoInicio, "yyyy-MM-dd"),
        concessivoFim: format(concessivoFim, "yyyy-MM-dd"),
        diasDireito: 30,
        diasGozados: Math.min(diasGozados, 30),
        diasVendidos: Math.min(diasVendidos, 30),
        diasQuitados,
        saldo: Math.max(saldo, 0),
        status,
        quitacaoManualId: quitacao?.id,
      });
    }
  }

  return result;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  quitado: { label: "Quitado", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  parcial: { label: "Parcial", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Clock className="h-3 w-3" /> },
  pendente: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
  a_vencer: { label: "A Vencer", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: <Timer className="h-3 w-3" /> },
  vencido: { label: "Vencido", color: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
};

// ========== Component ==========

export function PeriodosAquisitivosTab() {
  const today = new Date();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [setorFilter, setSetorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [perPage, setPerPage] = useState(25);
  const [sortField, setSortField] = useState<"nome" | "periodo" | "saldo" | "status">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quitarDialogOpen, setQuitarDialogOpen] = useState(false);
  const [quitarTarget, setQuitarTarget] = useState<PeriodoAquisitivo[]>([]);

  const { data: colaboradores = [], isLoading: loadingColabs } = useQuery({
    queryKey: ["periodos-aquisitivos-colabs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, data_admissao, setor_titular:ferias_setores!setor_titular_id (id, nome)")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: feriasRecords = [], isLoading: loadingFerias } = useQuery({
    queryKey: ["periodos-aquisitivos-ferias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("id, colaborador_id, quinzena1_inicio, quinzena1_fim, quinzena2_inicio, quinzena2_fim, dias_vendidos, vender_dias, status, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, gozo_diferente, gozo_quinzena1_inicio, gozo_quinzena1_fim, gozo_quinzena2_inicio, gozo_quinzena2_fim")
        .neq("status", "cancelada")
        .range(0, 5000);
      if (error) throw error;
      return data || [];
    },
  });

  const feriasIds = useMemo(() => feriasRecords.map(f => f.id), [feriasRecords]);

  const { data: gozoPeriodos = [] } = useQuery({
    queryKey: ["periodos-aquisitivos-gozo", feriasIds],
    queryFn: async () => {
      if (feriasIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ferias_gozo_periodos" as any)
        .select("id, ferias_id, numero, dias, data_inicio, data_fim, referencia_periodo")
        .in("ferias_id", feriasIds);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: feriasIds.length > 0,
  });

  const { data: quitacoes = [] } = useQuery({
    queryKey: ["periodos-aquisitivos-quitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_periodos_quitados" as any)
        .select("id, colaborador_id, periodo_inicio, periodo_fim, dias_quitados, observacoes");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: setores = [] } = useQuery({
    queryKey: ["periodos-aquisitivos-setores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_setores").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const periodos = useMemo(() => {
    if (colaboradores.length === 0) return [];
    return buildPeriodosAquisitivos(colaboradores, feriasRecords, gozoPeriodos, quitacoes, today);
  }, [colaboradores, feriasRecords, gozoPeriodos, quitacoes]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    periodos.forEach(p => years.add(parseInt(p.periodoInicio.substring(0, 4))));
    return Array.from(years).sort((a, b) => b - a);
  }, [periodos]);

  const filtered = useMemo(() => {
    return periodos
      .filter(p => {
        const matchSearch = normalizeText(p.colaboradorNome).includes(normalizeText(searchTerm));
        const matchSetor = setorFilter === "all" || p.setorId === setorFilter;
        const matchStatus = statusFilter === "all" || p.status === statusFilter;
        const matchYear = yearFilter === "all" || p.periodoInicio.startsWith(yearFilter);
        return matchSearch && matchSetor && matchStatus && matchYear;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "nome") cmp = a.colaboradorNome.localeCompare(b.colaboradorNome);
        else if (sortField === "periodo") cmp = a.periodoInicio.localeCompare(b.periodoInicio);
        else if (sortField === "saldo") cmp = a.saldo - b.saldo;
        else if (sortField === "status") {
          const order = { vencido: 0, a_vencer: 1, pendente: 2, parcial: 3, quitado: 4 };
          cmp = (order[a.status] || 0) - (order[b.status] || 0);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [periodos, searchTerm, setorFilter, statusFilter, yearFilter, sortField, sortDir]);

  // Group by year for collapsible sections
  const groupedByYear = useMemo(() => {
    if (yearFilter !== "all") return null; // No grouping when year filter is active
    const groups: Record<number, PeriodoAquisitivo[]> = {};
    filtered.forEach(p => {
      const year = parseInt(p.periodoInicio.substring(0, 4));
      if (!groups[year]) groups[year] = [];
      groups[year].push(p);
    });
    return Object.entries(groups)
      .map(([year, items]) => ({ year: parseInt(year), items }))
      .sort((a, b) => b.year - a.year);
  }, [filtered, yearFilter]);

  const pagination = usePagination(filtered, perPage);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const formatDate = (d: string) => {
    try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  const stats = useMemo(() => ({
    total: filtered.length,
    quitado: filtered.filter(p => p.status === "quitado").length,
    parcial: filtered.filter(p => p.status === "parcial").length,
    pendente: filtered.filter(p => p.status === "pendente").length,
    a_vencer: filtered.filter(p => p.status === "a_vencer").length,
    vencido: filtered.filter(p => p.status === "vencido").length,
  }), [filtered]);

  const isLoading = loadingColabs || loadingFerias;

  // Quitação mutations
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["periodos-aquisitivos-quitacoes"] });
    queryClient.invalidateQueries({ queryKey: ["ferias-dashboard-alertas"] });
  };

  const quitarMutation = useMutation({
    mutationFn: async ({ items, dias, obs }: { items: PeriodoAquisitivo[]; dias: number; obs: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = items.map(p => ({
        colaborador_id: p.colaboradorId,
        periodo_inicio: p.periodoInicio,
        periodo_fim: p.periodoFim,
        dias_quitados: dias,
        observacoes: obs,
        created_by: user?.id,
      }));
      const { error } = await (supabase.from("ferias_periodos_quitados" as any) as any).upsert(rows, { onConflict: "colaborador_id,periodo_inicio" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidateQueries();
      setSelected(new Set());
      setQuitarDialogOpen(false);
      toast({ title: `${vars.items.length} período(s) quitado(s) com sucesso` });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao quitar", description: err.message, variant: "destructive" });
    },
  });

  const desfazerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("ferias_periodos_quitados" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateQueries();
      toast({ title: "Quitação desfeita" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao desfazer", description: err.message, variant: "destructive" });
    },
  });

  // Selection helpers
  const periodoKey = (p: PeriodoAquisitivo) => `${p.colaboradorId}-${p.periodoInicio}`;
  const selectableItems = filtered.filter(p => p.status === "vencido" || p.status === "pendente" || p.status === "a_vencer");

  const toggleSelect = (p: PeriodoAquisitivo) => {
    const key = periodoKey(p);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === selectableItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableItems.map(periodoKey)));
    }
  };

  const handleQuitarSelecionados = () => {
    const items = filtered.filter(p => selected.has(periodoKey(p)));
    if (items.length === 0) return;
    setQuitarTarget(items);
    setQuitarDialogOpen(true);
  };

  const handleQuitarTodosVencidos = () => {
    const vencidos = filtered.filter(p => p.status === "vencido");
    if (vencidos.length === 0) return;
    setQuitarTarget(vencidos);
    setQuitarDialogOpen(true);
  };

  const handleQuitarIndividual = (p: PeriodoAquisitivo) => {
    setQuitarTarget([p]);
    setQuitarDialogOpen(true);
  };

  const handleConfirmQuitar = (dias: number, obs: string) => {
    quitarMutation.mutate({ items: quitarTarget, dias, obs });
  };

  // PDF Export
  const generatePDF = useCallback(() => {
    const exportData = filtered.filter(p => p.status !== "quitado");
    if (exportData.length === 0) {
      toast({ title: "Nenhum período para exportar", description: "Todos estão quitados.", variant: "destructive" });
      return;
    }

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("RELATORIO DE PERIODOS AQUISITIVOS", pageWidth / 2, 12, { align: "center" });

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    const filterInfo = [
      yearFilter !== "all" ? `Ano: ${yearFilter}` : "Todos os anos",
      setorFilter !== "all" ? `Setor: ${setores.find(s => s.id === setorFilter)?.nome}` : "Todos os setores",
      statusFilter !== "all" ? `Status: ${statusConfig[statusFilter]?.label}` : "Pendentes, A Vencer e Vencidos",
    ].join(" | ");
    pdf.text(filterInfo, pageWidth / 2, 17, { align: "center" });

    let yPos = 23;
    const colWidths = [55, 30, 40, 40, 15, 15, 15, 15, 20];
    const headers = ["Colaborador", "Setor", "Per. Aquisitivo", "Per. Concessivo", "Dir.", "Goz.", "Vend.", "Saldo", "Status"];

    const drawHeader = () => {
      pdf.setFillColor(220, 220, 220);
      pdf.rect(margin, yPos - 4, pageWidth - margin * 2, 7, "F");
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      let xPos = margin;
      headers.forEach((h, i) => { pdf.text(h, xPos + 1, yPos); xPos += colWidths[i]; });
      yPos += 5;
      pdf.setFont("helvetica", "normal");
    };

    drawHeader();

    const statusOrder = ["a_vencer", "pendente", "vencido", "parcial"];
    const sorted = [...exportData].sort((a, b) => {
      const ia = statusOrder.indexOf(a.status);
      const ib = statusOrder.indexOf(b.status);
      if (ia !== ib) return ia - ib;
      return a.colaboradorNome.localeCompare(b.colaboradorNome);
    });

    pdf.setFontSize(6.5);
    sorted.forEach((p, idx) => {
      if (yPos > 190) {
        pdf.addPage();
        yPos = 12;
        drawHeader();
        pdf.setFontSize(6.5);
      }

      if (idx % 2 === 1) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPos - 3.5, pageWidth - margin * 2, 5, "F");
      }

      let xPos = margin;
      pdf.text(p.colaboradorNome.substring(0, 30), xPos + 1, yPos);
      xPos += colWidths[0];
      pdf.text(p.setorNome.substring(0, 15), xPos + 1, yPos);
      xPos += colWidths[1];
      pdf.text(`${formatDate(p.periodoInicio)} a ${formatDate(p.periodoFim)}`, xPos + 1, yPos);
      xPos += colWidths[2];
      pdf.text(`${formatDate(p.concessivoInicio)} a ${formatDate(p.concessivoFim)}`, xPos + 1, yPos);
      xPos += colWidths[3];
      pdf.text("30", xPos + 1, yPos);
      xPos += colWidths[4];
      pdf.text(String(p.diasGozados + p.diasQuitados), xPos + 1, yPos);
      xPos += colWidths[5];
      pdf.text(String(p.diasVendidos), xPos + 1, yPos);
      xPos += colWidths[6];
      pdf.text(String(p.saldo), xPos + 1, yPos);
      xPos += colWidths[7];
      pdf.text(statusConfig[p.status]?.label || p.status, xPos + 1, yPos);

      yPos += 5;
    });

    pdf.setFontSize(6);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'as' HH:mm")} | Total: ${sorted.length} periodos`,
      pageWidth / 2, pdf.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );

    pdf.save(`periodos-aquisitivos-${yearFilter !== "all" ? yearFilter : "todos"}.pdf`);
    toast({ title: "PDF exportado com sucesso!" });
  }, [filtered, yearFilter, setorFilter, statusFilter, setores]);

  // Render table rows
  const renderTableRows = (items: PeriodoAquisitivo[]) => {
    return items.map((p, idx) => {
      const st = statusConfig[p.status];
      const key = periodoKey(p);
      const isSelectable = p.status === "vencido" || p.status === "pendente" || p.status === "a_vencer";
      const hasManualQuit = !!p.quitacaoManualId;

      return (
        <TableRow key={`${key}-${idx}`}>
          <TableCell>
            {isSelectable ? (
              <Checkbox
                checked={selected.has(key)}
                onCheckedChange={() => toggleSelect(p)}
              />
            ) : null}
          </TableCell>
          <TableCell className="font-medium">{p.colaboradorNome}</TableCell>
          <TableCell>{p.setorNome}</TableCell>
          <TableCell className="text-sm">{formatDate(p.periodoInicio)} a {formatDate(p.periodoFim)}</TableCell>
          <TableCell className="text-sm">{formatDate(p.concessivoInicio)} a {formatDate(p.concessivoFim)}</TableCell>
          <TableCell className="text-center font-medium">{p.diasDireito}</TableCell>
          <TableCell className="text-center">
            {(p.diasGozados > 0 || p.diasQuitados > 0) ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {p.diasGozados + p.diasQuitados}
                    {hasManualQuit && <span className="text-xs text-muted-foreground ml-0.5">*</span>}
                  </TooltipTrigger>
                  <TooltipContent>
                    {p.diasGozados > 0 && <div>Sistema: {p.diasGozados} dias</div>}
                    {p.diasQuitados > 0 && <div>Quitação manual: {p.diasQuitados} dias</div>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : "—"}
          </TableCell>
          <TableCell className="text-center">{p.diasVendidos > 0 ? p.diasVendidos : "—"}</TableCell>
          <TableCell className="text-center font-bold">{p.saldo}</TableCell>
          <TableCell>
            <Badge variant="outline" className={`${st.color} gap-1`}>
              {st.icon}{st.label}
            </Badge>
            {hasManualQuit && (
              <span className="text-xs text-muted-foreground ml-1">(manual)</span>
            )}
          </TableCell>
          <TableCell className="text-center">
            {hasManualQuit ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => desfazerMutation.mutate(p.quitacaoManualId!)}
                      disabled={desfazerMutation.isPending}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Desfazer quitação manual</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : isSelectable ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => handleQuitarIndividual(p)}
              >
                Quitar
              </Button>
            ) : null}
          </TableCell>
        </TableRow>
      );
    });
  };

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead className="w-10">
          <Checkbox
            checked={selectableItems.length > 0 && selected.size === selectableItems.length}
            onCheckedChange={toggleSelectAll}
          />
        </TableHead>
        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>
          Colaborador <ArrowUpDown className="inline h-3 w-3 ml-1" />
        </TableHead>
        <TableHead>Setor</TableHead>
        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("periodo")}>
          Período Aquisitivo <ArrowUpDown className="inline h-3 w-3 ml-1" />
        </TableHead>
        <TableHead>Período Concessivo</TableHead>
        <TableHead className="text-center">Direito</TableHead>
        <TableHead className="text-center">Gozados</TableHead>
        <TableHead className="text-center">Vendidos</TableHead>
        <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("saldo")}>
          Saldo <ArrowUpDown className="inline h-3 w-3 ml-1" />
        </TableHead>
        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
          Status <ArrowUpDown className="inline h-3 w-3 ml-1" />
        </TableHead>
        <TableHead className="text-center">Ações</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card className="border-green-500/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-green-600">Quitados</div><div className="text-2xl font-bold text-green-600">{stats.quitado}</div></CardContent></Card>
        <Card className="border-blue-500/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-blue-600">Parciais</div><div className="text-2xl font-bold text-blue-600">{stats.parcial}</div></CardContent></Card>
        <Card className="border-yellow-500/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-yellow-600">Pendentes</div><div className="text-2xl font-bold text-yellow-600">{stats.pendente}</div></CardContent></Card>
        <Card className="border-orange-500/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-orange-600">A Vencer</div><div className="text-2xl font-bold text-orange-600">{stats.a_vencer}</div></CardContent></Card>
        <Card className="border-destructive/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-destructive">Vencidos</div><div className="text-2xl font-bold text-destructive">{stats.vencido}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar colaborador..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="quitado">Quitado</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="a_vencer">A Vencer</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={generatePDF}>
              <Printer className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>

          {/* Batch actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {selected.size > 0 && (
              <Button size="sm" onClick={handleQuitarSelecionados}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Quitar {selected.size} selecionado(s)
              </Button>
            )}
            {stats.vencido > 0 && (
              <Button size="sm" variant="outline" onClick={handleQuitarTodosVencidos}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Quitar todos vencidos ({stats.vencido})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum período aquisitivo encontrado</p>
            </div>
          ) : groupedByYear ? (
            // Collapsible year sections when no year filter
            <div className="divide-y">
              {groupedByYear.map(group => (
                <Collapsible key={group.year} defaultOpen={group.year >= today.getFullYear() - 1}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="h-4 w-4 transition-transform [&[data-state=open]]:rotate-180" />
                      <span className="font-semibold text-lg">{group.year}</span>
                      <Badge variant="secondary">{group.items.length} períodos</Badge>
                      {group.items.filter(p => p.status === "vencido").length > 0 && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          {group.items.filter(p => p.status === "vencido").length} vencidos
                        </Badge>
                      )}
                      {group.items.filter(p => p.status === "a_vencer").length > 0 && (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                          {group.items.filter(p => p.status === "a_vencer").length} a vencer
                        </Badge>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto">
                      <Table>
                        {tableHeader}
                        <TableBody>
                          {renderTableRows(group.items)}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            // Simple paginated table when year filter is active
            <div className="overflow-x-auto">
              <Table>
                {tableHeader}
                <TableBody>
                  {renderTableRows(pagination.paginatedItems)}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                itemsPerPage={perPage}
                onPageChange={pagination.setCurrentPage}
                onItemsPerPageChange={(v) => { setPerPage(v); pagination.setCurrentPage(1); }}
                totalItems={filtered.length}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quitar Dialog */}
      <QuitarPeriodoDialog
        open={quitarDialogOpen}
        onOpenChange={setQuitarDialogOpen}
        periodos={quitarTarget}
        onConfirm={handleConfirmQuitar}
        isLoading={quitarMutation.isPending}
      />
    </div>
  );
}
