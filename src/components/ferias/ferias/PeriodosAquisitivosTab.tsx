import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Loader2, ArrowUpDown, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { format, parseISO, addYears, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/vendas/TableControls";
import { normalizeText } from "@/lib/textUtils";
import { getYearOptions } from "@/lib/dateUtils";

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
  saldo: number;
  status: "quitado" | "parcial" | "pendente" | "vencido";
}

// ========== Helpers ==========

function calcDiasGozo(ferias: any): number {
  // Calculate actual vacation days from the vacation record
  // Use gozo_periodos if available, otherwise calculate from quinzenas
  let dias = 0;
  
  // Count days from quinzena1
  if (ferias.quinzena1_inicio && ferias.quinzena1_fim) {
    const diff = differenceInDays(parseISO(ferias.quinzena1_fim), parseISO(ferias.quinzena1_inicio)) + 1;
    dias += diff;
  }
  
  // Count days from quinzena2
  if (ferias.quinzena2_inicio && ferias.quinzena2_fim) {
    const diff = differenceInDays(parseISO(ferias.quinzena2_fim), parseISO(ferias.quinzena2_inicio)) + 1;
    dias += diff;
  }

  // Subtract sold days since they are included in quinzena periods
  const vendidos = ferias.dias_vendidos || 0;
  dias -= vendidos;

  return Math.max(0, dias);
}

function buildPeriodosAquisitivos(
  colaboradores: any[],
  feriasRecords: any[],
  gozoPeriodos: any[],
  today: Date,
): PeriodoAquisitivo[] {
  const result: PeriodoAquisitivo[] = [];

  // Build gozo periods map
  const gozoMap: Record<string, any[]> = {};
  for (const p of gozoPeriodos) {
    if (!gozoMap[p.ferias_id]) gozoMap[p.ferias_id] = [];
    gozoMap[p.ferias_id].push(p);
  }

  for (const colab of colaboradores) {
    const admissao = parseISO(colab.data_admissao);
    const anosDesde = Math.floor(differenceInDays(today, admissao) / 365);
    
    // Generate periods from admission up to current + 1
    const maxPeriodos = Math.max(anosDesde + 1, 1);
    
    for (let i = 0; i < maxPeriodos; i++) {
      const periodoInicio = addYears(admissao, i);
      const periodoFim = addYears(admissao, i + 1);
      const concessivoInicio = periodoFim;
      const concessivoFim = addYears(periodoFim, 1);
      
      // Don't show periods that haven't started yet
      if (periodoInicio > today) continue;

      const periodoInicioStr = format(periodoInicio, "yyyy-MM-dd");
      const periodoFimStr = format(periodoFim, "yyyy-MM-dd");

      // Find ferias linked to this periodo
      const colabFerias = feriasRecords.filter(f => {
        if (f.colaborador_id !== colab.id) return false;
        if (f.status === "cancelada") return false;
        // Match by periodo_aquisitivo fields if available
        if (f.periodo_aquisitivo_inicio && f.periodo_aquisitivo_fim) {
          return f.periodo_aquisitivo_inicio === periodoInicioStr && f.periodo_aquisitivo_fim === periodoFimStr;
        }
        // Fallback: match by quinzena1_inicio falling within concessivo period
        const q1 = f.quinzena1_inicio;
        return q1 >= periodoInicioStr && q1 < format(concessivoFim, "yyyy-MM-dd");
      });

      let diasGozados = 0;
      let diasVendidos = 0;

      for (const f of colabFerias) {
        // Check if gozo_periodos exist for this ferias
        const periodos = gozoMap[f.id];
        if (periodos && periodos.length > 0) {
          diasGozados += periodos.reduce((sum: number, p: any) => sum + (p.dias || 0), 0);
        } else {
          diasGozados += calcDiasGozo(f);
        }
        diasVendidos += f.dias_vendidos || 0;
      }

      const saldo = 30 - diasGozados - diasVendidos;
      
      let status: PeriodoAquisitivo["status"];
      if (saldo <= 0) {
        status = "quitado";
      } else if (concessivoFim <= today && saldo > 0) {
        status = "vencido";
      } else if (diasGozados > 0 || diasVendidos > 0) {
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
        saldo: Math.max(saldo, 0),
        status,
      });
    }
  }

  return result;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  quitado: { label: "Quitado", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  parcial: { label: "Parcial", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Clock className="h-3 w-3" /> },
  pendente: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
  vencido: { label: "Vencido", color: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
};

// ========== Component ==========

export function PeriodosAquisitivosTab() {
  const today = new Date();
  const [searchTerm, setSearchTerm] = useState("");
  const [setorFilter, setSetorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [perPage, setPerPage] = useState(25);
  const [sortField, setSortField] = useState<"nome" | "periodo" | "saldo" | "status">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
    return buildPeriodosAquisitivos(colaboradores, feriasRecords, gozoPeriodos, today);
  }, [colaboradores, feriasRecords, gozoPeriodos]);

  const filtered = useMemo(() => {
    return periodos
      .filter(p => {
        const matchSearch = normalizeText(p.colaboradorNome).includes(normalizeText(searchTerm));
        const matchSetor = setorFilter === "all" || p.setorId === setorFilter;
        const matchStatus = statusFilter === "all" || p.status === statusFilter;
        return matchSearch && matchSetor && matchStatus;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "nome") cmp = a.colaboradorNome.localeCompare(b.colaboradorNome);
        else if (sortField === "periodo") cmp = a.periodoInicio.localeCompare(b.periodoInicio);
        else if (sortField === "saldo") cmp = a.saldo - b.saldo;
        else if (sortField === "status") {
          const order = { vencido: 0, pendente: 1, parcial: 2, quitado: 3 };
          cmp = (order[a.status] || 0) - (order[b.status] || 0);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [periodos, searchTerm, setorFilter, statusFilter, sortField, sortDir]);

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
    vencido: filtered.filter(p => p.status === "vencido").length,
  }), [filtered]);

  const isLoading = loadingColabs || loadingFerias;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card className="border-green-500/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-green-600">Quitados</div><div className="text-2xl font-bold text-green-600">{stats.quitado}</div></CardContent></Card>
        <Card className="border-blue-500/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-blue-600">Parciais</div><div className="text-2xl font-bold text-blue-600">{stats.parcial}</div></CardContent></Card>
        <Card className="border-yellow-500/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-yellow-600">Pendentes</div><div className="text-2xl font-bold text-yellow-600">{stats.pendente}</div></CardContent></Card>
        <Card className="border-destructive/20"><CardContent className="pt-4 pb-4"><div className="text-sm font-medium text-destructive">Vencidos</div><div className="text-2xl font-bold text-destructive">{stats.vencido}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((p, idx) => {
                    const st = statusConfig[p.status];
                    return (
                      <TableRow key={`${p.colaboradorId}-${p.periodoInicio}-${idx}`}>
                        <TableCell className="font-medium">{p.colaboradorNome}</TableCell>
                        <TableCell>{p.setorNome}</TableCell>
                        <TableCell className="text-sm">{formatDate(p.periodoInicio)} a {formatDate(p.periodoFim)}</TableCell>
                        <TableCell className="text-sm">{formatDate(p.concessivoInicio)} a {formatDate(p.concessivoFim)}</TableCell>
                        <TableCell className="text-center font-medium">{p.diasDireito}</TableCell>
                        <TableCell className="text-center">{p.diasGozados > 0 ? p.diasGozados : "—"}</TableCell>
                        <TableCell className="text-center">{p.diasVendidos > 0 ? p.diasVendidos : "—"}</TableCell>
                        <TableCell className="text-center font-bold">{p.saldo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${st.color} gap-1`}>
                            {st.icon}{st.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
    </div>
  );
}
