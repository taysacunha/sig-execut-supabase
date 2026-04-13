import { useState, useMemo } from "react";
import { normalizeText } from "@/lib/textUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Calendar, Search, RefreshCw, CalendarDays, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { format, parseISO, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Feriado {
  id: string;
  nome: string;
  data: string;
  tipo: string | null;
  recorrente: boolean | null;
  unidade_id: string | null;
  unidade?: { nome: string } | null;
}

interface FeriadoWithAdjustment extends Feriado {
  needsAdjustment?: boolean;
  displayYear?: number;
}

type SortField = "nome" | "data" | "tipo" | null;
type SortDirection = "asc" | "desc";

const TIPOS_FERIADO = [
  { value: "nacional", label: "Nacional" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
  { value: "interno", label: "Interno (empresa)" },
];

export function FeriadosTab() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFeriado, setEditingFeriado] = useState<Feriado | null>(null);
  const [feriadoToDelete, setFeriadoToDelete] = useState<Feriado | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    data: "",
    tipo: "nacional",
    recorrente: true,
    unidade_id: "_none_",
  });

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["ferias-feriados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_feriados")
        .select("*, unidade:ferias_unidades!unidade_id(nome)")
        .order("data");

      if (error) throw error;
      return data as Feriado[];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_unidades")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Apply sorting to data
  const sortData = <T extends FeriadoWithAdjustment>(data: T[]): T[] => {
    if (!sortField) return data;
    
    return [...data].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      
      if (sortField === "data") {
        aVal = new Date(a.data).getTime();
        bVal = new Date(b.data).getTime();
      } else if (sortField === "nome") {
        aVal = a.nome.toLowerCase();
        bVal = b.nome.toLowerCase();
      } else if (sortField === "tipo") {
        aVal = (a.tipo || "").toLowerCase();
        bVal = (b.tipo || "").toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Separate recurrent and unique holidays
  const { recorrentes, unicos } = useMemo(() => {
    const matchesSearch = (f: Feriado) =>
      normalizeText(f.nome).includes(normalizeText(searchTerm)) ||
      normalizeText(f.tipo || "").includes(normalizeText(searchTerm));

    const recorrentesFiltered = feriados.filter(
      (f) => f.recorrente && matchesSearch(f)
    );

    // Unique holidays: ALL appear, but we mark if they need adjustment
    const unicosFiltered: FeriadoWithAdjustment[] = feriados
      .filter((f) => !f.recorrente && matchesSearch(f))
      .map((f) => {
        const feriadoYear = getYear(parseISO(f.data));
        return {
          ...f,
          needsAdjustment: feriadoYear !== selectedYear,
          displayYear: feriadoYear,
        };
      });

    return { 
      recorrentes: sortData(recorrentesFiltered), 
      unicos: sortData(unicosFiltered) 
    };
  }, [feriados, searchTerm, selectedYear, sortField, sortDirection]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: formData.nome,
        data: formData.data,
        tipo: formData.tipo,
        recorrente: formData.recorrente,
        unidade_id: formData.unidade_id === "_none_" ? null : formData.unidade_id,
      };

      if (editingFeriado) {
        const { error } = await supabase
          .from("ferias_feriados")
          .update(payload)
          .eq("id", editingFeriado.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ferias_feriados")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-feriados"] });
      toast.success(editingFeriado ? "Feriado atualizado!" : "Feriado cadastrado!");
      handleCloseDialog();
    },
    onError: (error) => {
      console.error("Erro ao salvar feriado:", error);
      toast.error("Erro ao salvar feriado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ferias_feriados")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-feriados"] });
      toast.success("Feriado excluído!");
      setDeleteDialogOpen(false);
      setFeriadoToDelete(null);
    },
    onError: (error) => {
      console.error("Erro ao excluir feriado:", error);
      toast.error("Erro ao excluir feriado");
    },
  });

  const handleOpenDialog = (feriado?: Feriado) => {
    if (feriado) {
      setEditingFeriado(feriado);
      setFormData({
        nome: feriado.nome,
        data: feriado.data,
        tipo: feriado.tipo || "nacional",
        recorrente: feriado.recorrente ?? true,
        unidade_id: feriado.unidade_id || "_none_",
      });
    } else {
      setEditingFeriado(null);
      setFormData({
        nome: "",
        data: "",
        tipo: "nacional",
        recorrente: true,
        unidade_id: "_none_",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFeriado(null);
    setFormData({
      nome: "",
      data: "",
      tipo: "nacional",
      recorrente: true,
      unidade_id: "_none_",
    });
  };

  const handleDelete = (feriado: Feriado) => {
    setFeriadoToDelete(feriado);
    setDeleteDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getTipoBadge = (tipo: string | null) => {
    switch (tipo) {
      case "nacional":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">Nacional</Badge>;
      case "estadual":
        return <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400">Estadual</Badge>;
      case "municipal":
        return <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400">Municipal</Badge>;
      case "interno":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">Interno</Badge>;
      default:
        return <Badge variant="outline">{tipo || "—"}</Badge>;
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      onClick={() => handleSort(field)}
      className="cursor-pointer hover:bg-accent/50 transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon field={field} />
      </div>
    </TableHead>
  );

  const FeriadosTable = ({ 
    data, 
    emptyMessage,
    showAdjustmentBadge = false 
  }: { 
    data: FeriadoWithAdjustment[]; 
    emptyMessage: string;
    showAdjustmentBadge?: boolean;
  }) => (
    data.length === 0 ? (
      <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
        {emptyMessage}
      </div>
    ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="nome">Nome</SortableHeader>
              <SortableHeader field="data">Data</SortableHeader>
              <SortableHeader field="tipo">Tipo</SortableHeader>
              <TableHead>Unidade</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((feriado) => (
              <TableRow 
                key={feriado.id}
                className={showAdjustmentBadge && feriado.needsAdjustment ? "bg-amber-50 dark:bg-amber-900/10" : ""}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2 flex-wrap">
                    {feriado.nome}
                    {showAdjustmentBadge && feriado.needsAdjustment && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-600">
                        Ajustar para {selectedYear}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatDate(feriado.data)}</TableCell>
                <TableCell>{getTipoBadge(feriado.tipo)}</TableCell>
                <TableCell>
                  {feriado.unidade?.nome || <span className="text-muted-foreground">Todas</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(feriado)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(feriado)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Feriados
          </CardTitle>
          <CardDescription>
            Cadastre os feriados para validação de início de férias (véspera de feriado)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar feriado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Ano:</Label>
              <Input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value) || currentYear)}
                className="w-[100px]"
                min={2020}
                max={2100}
              />
            </div>
            <Button onClick={() => handleOpenDialog()} className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Novo Feriado
            </Button>
          </div>

          {/* Recurrent Holidays */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Feriados Recorrentes (Anuais)</h3>
              <Badge variant="secondary" className="text-xs">
                {recorrentes.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Feriados que se repetem todo ano na mesma data (ex: Natal, Ano Novo)
            </p>
            <FeriadosTable 
              data={recorrentes} 
              emptyMessage="Nenhum feriado recorrente cadastrado" 
            />
          </div>

          {/* Unique Holidays */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold">Feriados com Data Variável</h3>
              <Badge variant="outline" className="text-xs">
                {unicos.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Feriados que mudam de data a cada ano (ex: Carnaval, Corpus Christi). 
              Os destacados em amarelo precisam ter a data ajustada para {selectedYear}.
            </p>
            <FeriadosTable 
              data={unicos} 
              emptyMessage="Nenhum feriado com data variável cadastrado"
              showAdjustmentBadge={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialog para criar/editar feriado */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFeriado ? "Editar Feriado" : "Novo Feriado"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Natal, Carnaval..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_FERIADO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Unidade (opcional)</Label>
              <Select
                value={formData.unidade_id}
                onValueChange={(v) => setFormData({ ...formData, unidade_id: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Todas as unidades</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Feriado recorrente</Label>
                <p className="text-xs text-muted-foreground">
                  Se ativo, o feriado se repete todo ano na mesma data (ex: Natal 25/12).
                  Desative para feriados com data variável (ex: Carnaval).
                </p>
              </div>
              <Switch
                checked={formData.recorrente}
                onCheckedChange={(v) => setFormData({ ...formData, recorrente: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formData.nome || !formData.data || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFeriado ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o feriado <strong>{feriadoToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => feriadoToDelete && deleteMutation.mutate(feriadoToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
