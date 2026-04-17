import { useState, useMemo } from "react";
import { normalizeText } from "@/lib/textUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachWeekendOfInterval, isSaturday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Calendar, CheckCircle, AlertCircle, Plus, Trash2, RefreshCw, Loader2, ArrowRight, ArrowLeftRight, Grid3X3, Search, Users, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { Checkbox } from "@/components/ui/checkbox";
import { GeradorFolgasDialog } from "@/components/ferias/folgas/GeradorFolgasDialog";
import { PerdaFolgaDialog } from "@/components/ferias/folgas/PerdaFolgaDialog";
import { MoverFolgaDialog } from "@/components/ferias/folgas/MoverFolgaDialog";
import { TrocarFolgaDialog } from "@/components/ferias/folgas/TrocarFolgaDialog";
import { SetoresSabadosTable } from "@/components/ferias/folgas/SetoresSabadosTable";
import { FolgasPrintGenerator } from "@/components/ferias/folgas/FolgasPrintGenerator";
import { MoverFolgasLoteDialog } from "@/components/ferias/folgas/MoverFolgasLoteDialog";
import { RemoverFolgaDialog } from "@/components/ferias/folgas/RemoverFolgaDialog";
import { cn } from "@/lib/utils";

interface Colaborador {
  id: string;
  nome: string;
  nome_exibicao: string | null;
  setor_titular_id: string;
  setor?: { nome: string } | null;
  status: string | null;
  familiar_id: string | null;
}

interface Folga {
  id: string;
  data_sabado: string;
  colaborador_id: string;
  escala_id: string | null;
  is_excecao: boolean;
  excecao_motivo: string | null;
  excecao_justificativa: string | null;
  colaborador?: { nome: string; nome_exibicao: string | null; familiar_id: string | null } | null;
}

interface Perda {
  id: string;
  colaborador_id: string;
  ano: number;
  mes: number;
  motivo: string;
  observacoes: string | null;
  colaborador?: { nome: string } | null;
}

// Função para obter nome de exibição
const getDisplayName = (colaborador: { nome: string; nome_exibicao?: string | null } | null | undefined): string => {
  if (!colaborador) return "—";
  if (colaborador.nome_exibicao) return colaborador.nome_exibicao;
  const parts = colaborador.nome.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const FeriasFolgas = () => {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditFerias = canEdit("ferias");
  
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [selectedSetor, setSelectedSetor] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialogs
  const [generateOpen, setGenerateOpen] = useState(false);
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualColaborador, setManualColaborador] = useState<string>("");
  const [manualData, setManualData] = useState("");
  const [manualExcecao, setManualExcecao] = useState(false);
  const [manualMotivo, setManualMotivo] = useState("");
  const [manualJustificativa, setManualJustificativa] = useState("");
  const [manualUseCredit, setManualUseCredit] = useState(false);
  
  // Delete confirmation states
  const [folgaToDelete, setFolgaToDelete] = useState<any | null>(null);
  const [perdaToDelete, setPerdaToDelete] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  
  // Move/Swap dialogs
  const [folgaToMove, setFolgaToMove] = useState<Folga | null>(null);
  const [folgaToSwap, setFolgaToSwap] = useState<Folga | null>(null);
  const [loteDialogOpen, setLoteDialogOpen] = useState(false);

  // Queries
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-folgas", selectedSetor],
    queryFn: async () => {
      let query = supabase
        .from("ferias_colaboradores")
        .select("id, nome, nome_exibicao, setor_titular_id, status, familiar_id, setor:ferias_setores!ferias_colaboradores_setor_titular_id_fkey(nome)")
        .eq("status", "ativo");
      
      if (selectedSetor) {
        query = query.eq("setor_titular_id", selectedSetor);
      }
      
      const { data, error } = await query.order("nome");
      if (error) throw error;
      return data as Colaborador[];
    },
  });

  const { data: folgas = [], isLoading: loadingFolgas } = useQuery({
    queryKey: ["ferias-folgas", year, month, selectedSetor],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      
      let query = supabase
        .from("ferias_folgas")
        .select("id, data_sabado, colaborador_id, escala_id, is_excecao, excecao_motivo, excecao_justificativa, colaborador:ferias_colaboradores!ferias_folgas_colaborador_id_fkey(nome, nome_exibicao, familiar_id)")
        .gte("data_sabado", monthStart)
        .lte("data_sabado", monthEnd);
      
      const { data, error } = await query.order("data_sabado");
      if (error) throw error;
      return data as Folga[];
    },
  });

  const { data: perdas = [], isLoading: loadingPerdas } = useQuery({
    queryKey: ["ferias-perdas", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_folgas_perdas")
        .select("id, colaborador_id, ano, mes, motivo, observacoes, colaborador:ferias_colaboradores!ferias_folgas_perdas_colaborador_id_fkey(nome)")
        .eq("ano", year)
        .eq("mes", month)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Perda[];
    },
  });

  // Get saturdays of the month
  const saturdaysOfMonth = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    const weekends = eachWeekendOfInterval({ start, end });
    return weekends.filter(d => isSaturday(d)).map(d => format(d, "yyyy-MM-dd"));
  }, [year, month]);

  // Identificar familiares que folgam juntos
  const familiarPairsOnSameSaturday = useMemo(() => {
    const pairs = new Set<string>();
    
    folgas.forEach(folga => {
      if (!folga.colaborador?.familiar_id) return;
      
      const familiarFolga = folgas.find(
        f => f.colaborador_id === folga.colaborador?.familiar_id && 
             f.data_sabado === folga.data_sabado
      );
      
      if (familiarFolga) {
        pairs.add(folga.colaborador_id);
      }
    });
    
    return pairs;
  }, [folgas]);

  // Filtrar folgas por busca
  const filteredFolgas = useMemo(() => {
    if (!searchTerm.trim()) return folgas;
    const term = normalizeText(searchTerm);
    return folgas.filter(f => 
      normalizeText(f.colaborador?.nome || "").includes(term) ||
      normalizeText(f.colaborador?.nome_exibicao || "").includes(term)
    );
  }, [folgas, searchTerm]);

  // Mutations
  // deleteFolgaMutation is now handled by RemoverFolgaDialog

  const deleteAllFolgasMutation = useMutation({
    mutationFn: async () => {
      const monthStart = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      
      const { error: escalaError } = await supabase
        .from("ferias_folgas_escala")
        .delete()
        .eq("ano", year)
        .eq("mes", month);
      if (escalaError) throw escalaError;

      const { error } = await supabase
        .from("ferias_folgas")
        .delete()
        .gte("data_sabado", monthStart)
        .lte("data_sabado", monthEnd);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala do mês apagada!");
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-pdf"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-escalas"] });
      setShowDeleteAllConfirm(false);
    },
    onError: () => toast.error("Erro ao apagar escala"),
  });

  const deletePerdaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ferias_folgas_perdas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro de perda removido!");
      queryClient.invalidateQueries({ queryKey: ["ferias-perdas"] });
      setPerdaToDelete(null);
    },
    onError: () => toast.error("Erro ao remover perda"),
  });

  // Query available 'folga' credits for the manual-selected colaborador
  const { data: manualCreditos = [] } = useQuery({
    queryKey: ["ferias-creditos-manual-folga", manualColaborador],
    queryFn: async () => {
      if (!manualColaborador) return [];
      const { data, error } = await supabase
        .from("ferias_folgas_creditos")
        .select("id, dias, origem_data")
        .eq("colaborador_id", manualColaborador)
        .eq("tipo", "folga")
        .eq("status", "disponivel")
        .order("origem_data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!manualColaborador && manualOpen,
  });

  const totalManualCreditos = manualCreditos.reduce((s: number, c: any) => s + (c.dias || 0), 0);

  const addManualFolgaMutation = useMutation({
    mutationFn: async () => {
      const existingFolga = folgas.find(f => f.colaborador_id === manualColaborador);
      const isExcecaoFinal = manualUseCredit ? true : (existingFolga ? true : manualExcecao);
      const motivoFinal = manualUseCredit ? "credito_folga" : (manualMotivo || (existingFolga ? "Ajuste manual" : null));
      const justificativaFinal = manualUseCredit
        ? `Crédito de folga utilizado em ${manualData}`
        : (manualJustificativa || null);

      if (existingFolga) {
        const { error } = await supabase
          .from("ferias_folgas")
          .update({
            data_sabado: manualData,
            is_excecao: isExcecaoFinal,
            excecao_motivo: motivoFinal,
            excecao_justificativa: justificativaFinal,
          })
          .eq("id", existingFolga.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ferias_folgas")
          .insert({
            colaborador_id: manualColaborador,
            data_sabado: manualData,
            is_excecao: isExcecaoFinal,
            excecao_motivo: isExcecaoFinal ? motivoFinal : null,
            excecao_justificativa: isExcecaoFinal ? justificativaFinal : null,
          });
        if (error) throw error;
      }

      // Consume oldest credit if requested
      if (manualUseCredit && manualCreditos.length > 0) {
        const oldest = manualCreditos[0];
        const { error: credErr } = await supabase
          .from("ferias_folgas_creditos")
          .update({
            status: "utilizado",
            utilizado_em: new Date().toISOString().split("T")[0],
            utilizado_referencia: `Folga em ${manualData}`,
          })
          .eq("id", oldest.id);
        if (credErr) throw credErr;
      }
    },
    onSuccess: () => {
      toast.success(manualUseCredit ? "Folga salva e crédito consumido!" : "Folga salva!");
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-pdf"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-creditos"] });
      setManualOpen(false);
      setManualColaborador("");
      setManualData("");
      setManualExcecao(false);
      setManualMotivo("");
      setManualJustificativa("");
      setManualUseCredit(false);
    },
    onError: (err: any) => toast.error(`Erro ao salvar folga: ${err?.message || "Erro desconhecido"}`),
  });

  const loading = loadingFolgas || loadingPerdas;

  // Stats
  const totalFolgas = folgas.length;
  const folgasExcecao = folgas.filter(f => f.is_excecao).length;
  const totalPerdas = perdas.length;

  // Check if colaborador already has folga
  const colabHasFolga = (colabId: string) => {
    return folgas.some(f => f.colaborador_id === colabId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-8 w-8" />
            Folgas de Sábado
          </h1>
          <p className="text-muted-foreground">
            Geração e controle de escalas de folgas mensais
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor (filtro)</Label>
              <Select 
                value={selectedSetor || "_all_"} 
                onValueChange={(v) => setSelectedSetor(v === "_all_" ? "" : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todos os setores</SelectItem>
                  {setores.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canEditFerias && (
              <div className="flex gap-2 ml-auto">
                <FolgasPrintGenerator year={year} month={month} />

                <Button variant="outline" onClick={() => setLoteDialogOpen(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Mover em Lote
                </Button>
                
                <Button onClick={() => setGenerateOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Gerar Escala
                </Button>

                {folgas.length > 0 && (
                  <Button variant="destructive" onClick={() => setShowDeleteAllConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Apagar Escala
                  </Button>
                )}

                <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Ajuste Manual
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ajuste Manual de Folga</DialogTitle>
                      <DialogDescription>
                        Adicione ou substitua a folga de um colaborador. Se ele já tiver uma folga no mês, será substituída.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Colaborador *</Label>
                        <Select value={manualColaborador} onValueChange={setManualColaborador}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {colaboradores.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {getDisplayName(c)}
                                {colabHasFolga(c.id) && " (substituir)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {manualColaborador && colabHasFolga(manualColaborador) && (
                          <p className="text-sm text-warning">
                            Este colaborador já tem uma folga. Ela será substituída.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Data do Sábado *</Label>
                        <Select value={manualData} onValueChange={setManualData}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a data" />
                          </SelectTrigger>
                          <SelectContent>
                            {saturdaysOfMonth.map(sat => (
                              <SelectItem key={sat} value={sat}>
                                {format(new Date(sat + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {manualColaborador && totalManualCreditos > 0 && (
                        <Alert>
                          <CreditCard className="h-4 w-4" />
                          <AlertDescription className="space-y-2">
                            <div>
                              Este colaborador tem <strong>{manualCreditos.length} crédito(s)</strong> de folga
                              disponível(is) (<strong>{totalManualCreditos} dia(s)</strong>).
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={manualUseCredit}
                                onCheckedChange={(v) => setManualUseCredit(!!v)}
                              />
                              <span className="text-sm">Utilizar crédito de folga neste ajuste</span>
                            </label>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label>Motivo (opcional)</Label>
                        <Input value={manualMotivo} onChange={(e) => setManualMotivo(e.target.value)} placeholder="Ex: Troca entre colaboradores" disabled={manualUseCredit} />
                      </div>
                      <div className="space-y-2">
                        <Label>Justificativa (opcional)</Label>
                        <Textarea value={manualJustificativa} onChange={(e) => setManualJustificativa(e.target.value)} placeholder="Detalhes adicionais..." disabled={manualUseCredit} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
                      <Button 
                        onClick={() => addManualFolgaMutation.mutate()} 
                        disabled={!manualColaborador || !manualData || addManualFolgaMutation.isPending}
                      >
                        {addManualFolgaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sábados do Mês</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{saturdaysOfMonth.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Folgas Alocadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFolgas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceções</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{folgasExcecao}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Perdas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPerdas}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="folgas" className="w-full">
        <TabsList>
          <TabsTrigger value="folgas">Folgas do Mês</TabsTrigger>
          <TabsTrigger value="mapa">Mapa por Setor</TabsTrigger>
          <TabsTrigger value="perdas">Perdas de Folga</TabsTrigger>
        </TabsList>

        <TabsContent value="folgas">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Folgas de {format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR })}</CardTitle>
                  <CardDescription>Lista de todas as folgas de sábado alocadas</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredFolgas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Nenhuma folga encontrada com esse nome" : "Nenhuma folga registrada para este período"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Data</TableHead>
                      <TableHead className="font-semibold">Colaborador</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      {canEditFerias && <TableHead className="text-right font-semibold">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFolgas.map((folga, idx) => {
                      const isFamiliar = familiarPairsOnSameSaturday.has(folga.colaborador_id);
                      return (
                        <TableRow 
                          key={folga.id}
                          className={cn(idx % 2 === 0 ? "bg-background" : "bg-muted/30")}
                        >
                          <TableCell className="font-medium">
                            {format(new Date(folga.data_sabado + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                isFamiliar && "px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                              )}>
                                {getDisplayName(folga.colaborador)}
                              </span>
                              {isFamiliar && (
                                <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200">
                                  Familiar junto
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {folga.is_excecao ? (
                              <Badge variant="outline" className="text-warning border-warning">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Exceção
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Normal
                              </Badge>
                            )}
                          </TableCell>
                          {canEditFerias && (
                            <TableCell className="text-right space-x-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setFolgaToMove(folga)}
                                title="Mover para outro sábado"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setFolgaToSwap(folga)}
                                title="Trocar com outro colaborador"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => setFolgaToDelete(folga)}
                                title="Remover (com crédito)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapa">
          <SetoresSabadosTable year={year} month={month} />
        </TabsContent>

        <TabsContent value="perdas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Perdas de Folga</CardTitle>
                <CardDescription>Registro de folgas perdidas por colaboradores</CardDescription>
              </div>
              {canEditFerias && (
                <Button variant="outline" onClick={() => setPerdaOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Perda
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {perdas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma perda registrada para este período
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Colaborador</TableHead>
                      <TableHead className="font-semibold">Motivo</TableHead>
                      <TableHead className="font-semibold">Observações</TableHead>
                      {canEditFerias && <TableHead className="text-right font-semibold">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perdas.map((perda, idx) => (
                      <TableRow 
                        key={perda.id}
                        className={cn(idx % 2 === 0 ? "bg-background" : "bg-muted/30")}
                      >
                        <TableCell className="font-medium">{perda.colaborador?.nome || "—"}</TableCell>
                        <TableCell>{perda.motivo}</TableCell>
                        <TableCell className="text-muted-foreground">{perda.observacoes || "—"}</TableCell>
                        {canEditFerias && (
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => setPerdaToDelete(perda.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <GeradorFolgasDialog 
        open={generateOpen} 
        onOpenChange={setGenerateOpen}
        year={year}
        month={month}
      />
      
      <PerdaFolgaDialog 
        open={perdaOpen} 
        onOpenChange={setPerdaOpen}
        year={year}
        month={month}
        selectedSetor={selectedSetor}
      />

      <MoverFolgaDialog
        open={!!folgaToMove}
        onOpenChange={(open) => !open && setFolgaToMove(null)}
        folga={folgaToMove}
        saturdaysOfMonth={saturdaysOfMonth}
      />

      <TrocarFolgaDialog
        open={!!folgaToSwap}
        onOpenChange={(open) => !open && setFolgaToSwap(null)}
        folga={folgaToSwap}
        allFolgas={folgas}
      />

      <MoverFolgasLoteDialog
        open={loteDialogOpen}
        onOpenChange={setLoteDialogOpen}
        folgas={folgas}
        saturdaysOfMonth={saturdaysOfMonth}
        colaboradores={colaboradores}
      />

      {/* Remove Folga Dialog (with credit) */}
      <RemoverFolgaDialog
        open={!!folgaToDelete}
        onOpenChange={(open) => !open && setFolgaToDelete(null)}
        folga={folgaToDelete}
      />

      {/* Delete All Folgas Confirmation */}
      <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar toda a escala do mês</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar TODAS as folgas de {format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR })}? 
              Esta ação não pode ser desfeita e removerá {totalFolgas} folga(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllFolgasMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAllFolgasMutation.isPending}
            >
              {deleteAllFolgasMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apagar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Perda Confirmation */}
      <AlertDialog open={!!perdaToDelete} onOpenChange={() => setPerdaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de perda de folga? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => perdaToDelete && deletePerdaMutation.mutate(perdaToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FeriasFolgas;