import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, Loader2, Users, Calendar, AlertTriangle, CheckCircle2, 
  Clock, ArrowUpDown, ChevronLeft, ChevronRight
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePagination } from "@/hooks/usePagination";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  em_gozo: "Em Gozo",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  aprovada: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  em_gozo: "bg-green-500/10 text-green-600 border-green-500/20",
  concluida: "bg-muted text-muted-foreground border-muted",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

const excecaoMotivoLabels: Record<string, string> = {
  mes_bloqueado: "Mês bloqueado",
  venda_acima_limite: "Venda > 10 dias",
  familiar: "Familiar",
  conflito_setor: "Conflito setor",
  conflito_equipe: "Conflito equipe",
  ajuste_setor: "Ajuste setor",
  periodo_aquisitivo: "Per. aquisitivo",
  outro: "Outro",
};

export function ConsultaGeralTab() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedSetor, setSelectedSetor] = useState("_all_");
  const [selectedStatus, setSelectedStatus] = useState("_all_");
  const [selectedTipo, setSelectedTipo] = useState("_all_");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"nome" | "setor" | "status">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const { data: setores } = useQuery({
    queryKey: ["ferias-setores-consulta"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_setores").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: ferias, isLoading: feriasLoading } = useQuery({
    queryKey: ["ferias-consulta-geral", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select(`
          *,
          colaborador:ferias_colaboradores!colaborador_id(
            id, nome, cpf,
            setor:ferias_setores!setor_titular_id(id, nome)
          )
        `)
        .gte("quinzena1_inicio", `${selectedYear}-01-01`)
        .lte("quinzena1_inicio", `${selectedYear}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: totalColaboradores } = useQuery({
    queryKey: ["ferias-total-colaboradores"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ferias_colaboradores")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo");
      if (error) throw error;
      return count || 0;
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try { return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return dateStr; }
  };

  const filtered = useMemo(() => {
    if (!ferias) return [];
    return ferias
      .filter((f) => {
        const matchesSearch = !searchTerm || f.colaborador?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSetor = selectedSetor === "_all_" || f.colaborador?.setor?.id === selectedSetor;
        const matchesStatus = selectedStatus === "_all_" || f.status === selectedStatus;
        const matchesTipo = selectedTipo === "_all_" || 
          (selectedTipo === "excecao" && f.is_excecao) || 
          (selectedTipo === "normal" && !f.is_excecao);
        return matchesSearch && matchesSetor && matchesStatus && matchesTipo;
      })
      .sort((a, b) => {
        let valA = "", valB = "";
        if (sortField === "nome") {
          valA = a.colaborador?.nome || "";
          valB = b.colaborador?.nome || "";
        } else if (sortField === "setor") {
          valA = a.colaborador?.setor?.nome || "";
          valB = b.colaborador?.setor?.nome || "";
        } else {
          valA = a.status || "";
          valB = b.status || "";
        }
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
  }, [ferias, searchTerm, selectedSetor, selectedStatus, selectedTipo, sortField, sortDir]);

  const { currentPage, totalPages, paginatedItems, setCurrentPage } = usePagination(filtered, 15);

  const handleSort = (field: "nome" | "setor" | "status") => {
    if (sortField === field) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  // Stats
  const stats = useMemo(() => {
    if (!ferias) return { total: 0, emGozo: 0, concluidas: 0, pendentesAprovadas: 0, excecoes: 0, faltantes: 0 };
    const colabComFerias = new Set(ferias.map(f => f.colaborador_id).filter(Boolean));
    return {
      total: ferias.length,
      emGozo: ferias.filter(f => f.status === "em_gozo").length,
      concluidas: ferias.filter(f => f.status === "concluida").length,
      pendentesAprovadas: ferias.filter(f => f.status === "pendente" || f.status === "aprovada").length,
      excecoes: ferias.filter(f => f.is_excecao).length,
      faltantes: Math.max(0, (totalColaboradores || 0) - colabComFerias.size),
    };
  }, [ferias, totalColaboradores]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-green-600">Em Gozo</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.emGozo}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Concluídas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.concluidas}</div></CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-blue-600">Pendentes/Aprovadas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{stats.pendentesAprovadas}</div></CardContent>
        </Card>
        <Card className="border-orange-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-orange-600">Exceções</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{stats.excecoes}</div></CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-destructive">Faltantes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.faltantes}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar colaborador..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10" />
            </div>
            <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedSetor} onValueChange={(v) => { setSelectedSetor(v); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todos os setores</SelectItem>
                {setores?.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todos os status</SelectItem>
                {Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedTipo} onValueChange={(v) => { setSelectedTipo(v); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todos</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="excecao">Exceção</SelectItem>
                <SelectItem value="1_periodo">1 Período</SelectItem>
                <SelectItem value="2_periodos">2 Períodos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {feriasLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma férias encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>
                        Colaborador <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("setor")}>
                        Setor <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead>1º Período (Direito)</TableHead>
                      <TableHead>2º Período (Direito)</TableHead>
                      <TableHead>Gozo Real</TableHead>
                      <TableHead>Venda</TableHead>
                      <TableHead>Per. Aquisitivo</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                        Status <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Exceção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.colaborador?.nome || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.colaborador?.cpf || "—"}</TableCell>
                        <TableCell className="text-sm">{f.colaborador?.setor?.nome || "—"}</TableCell>
                        <TableCell className="text-sm">{formatDate(f.quinzena1_inicio)} - {formatDate(f.quinzena1_fim)}</TableCell>
                        <TableCell className="text-sm">{f.quinzena2_inicio ? `${formatDate(f.quinzena2_inicio)} - ${formatDate(f.quinzena2_fim)}` : <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">1 período</Badge>}</TableCell>
                        <TableCell className="text-sm">
                          {f.gozo_diferente ? (
                            <div className="space-y-1">
                              {f.gozo_quinzena1_inicio && <p>{formatDate(f.gozo_quinzena1_inicio)} - {formatDate(f.gozo_quinzena1_fim)}</p>}
                              {f.gozo_quinzena2_inicio && <p>{formatDate(f.gozo_quinzena2_inicio)} - {formatDate(f.gozo_quinzena2_fim)}</p>}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {f.vender_dias && f.dias_vendidos ? (
                            <Badge variant="outline" className="text-xs">{f.dias_vendidos}d</Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {f.periodo_aquisitivo_inicio ? `${formatDate(f.periodo_aquisitivo_inicio)} - ${formatDate(f.periodo_aquisitivo_fim)}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[f.status]}>{statusLabels[f.status] || f.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.origem === "formulario_anual" ? "Gerada" : "Manual"}</TableCell>
                        <TableCell>
                          {f.is_excecao ? (
                            <div>
                              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                                {excecaoMotivoLabels[f.excecao_motivo || ""] || f.excecao_motivo || "Sim"}
                              </Badge>
                              {f.excecao_justificativa && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate" title={f.excecao_justificativa}>{f.excecao_justificativa}</p>
                              )}
                            </div>
                          ) : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * 15) + 1} a {Math.min(currentPage * 15, filtered.length)} de {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{currentPage} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
