import { useState } from "react";
import { normalizeText } from "@/lib/textUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brokerSchema } from "@/lib/validations/brokerSchema";
import { useSystemAccess } from "@/hooks/useSystemAccess";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2, Ban, Search, Eye, ArrowUp, ArrowDown, ArrowUpDown, Check, X } from "lucide-react";
import { formatCreci } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { WeekdayShiftSelector, WeekdayShiftAvailability, convertFromAvailableWeekdays, convertToAvailableWeekdays } from "@/components/WeekdayShiftSelector";
import { useDebounceSearch } from "@/hooks/useDebounceSearch";
import { Skeleton } from "@/components/ui/skeleton";

interface Broker {
  id: string;
  name: string;
  creci: string;
  is_active: boolean;
  available_weekdays?: string[];
  weekday_shift_availability?: WeekdayShiftAvailability;
}

const Brokers = () => {
  const [open, setOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const defaultShiftAvailability: WeekdayShiftAvailability = {
    monday: ["morning", "afternoon"],
    tuesday: ["morning", "afternoon"],
    wednesday: ["morning", "afternoon"],
    thursday: ["morning", "afternoon"],
    friday: ["morning", "afternoon"],
    saturday: ["morning", "afternoon"],
    sunday: ["morning", "afternoon"],
  };
  
  const [formData, setFormData] = useState({ 
    name: "", 
    creci: "", 
    weekday_shift_availability: defaultShiftAvailability
  });
  const [searchTerm, debouncedSearch, setSearchTerm] = useDebounceSearch("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<'name' | 'creci' | 'is_active'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewingBroker, setViewingBroker] = useState<Broker | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  // Estados para confirmação de ações
  const [toggleBrokerId, setToggleBrokerId] = useState<string | null>(null);
  const [toggleBrokerName, setToggleBrokerName] = useState<string>("");
  const [toggleBrokerStatus, setToggleBrokerStatus] = useState<boolean>(false);
  const [deleteBrokerId, setDeleteBrokerId] = useState<string | null>(null);
  const [deleteBrokerName, setDeleteBrokerName] = useState<string>("");
  
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const queryClient = useQueryClient();
  
  // ✅ USAR PERMISSÃO DE SISTEMA em vez de role
  const { canEdit, loading: permissionLoading } = useSystemAccess();
  const canEditEscalas = canEdit("escalas");

  const { data: brokers, isLoading } = useQuery({
    queryKey: ["brokers"],
    queryFn: async () => {
      // Sempre buscar todos os corretores - RLS protege baseado em system_access
      const { data, error } = await supabase
        .from("brokers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Broker[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !permissionLoading, // Wait for permission to be determined
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Derivar available_weekdays do weekday_shift_availability para compatibilidade
      const available_weekdays = convertToAvailableWeekdays(data.weekday_shift_availability);
      const { error } = await supabase.from("brokers").insert([{
        name: data.name,
        creci: data.creci,
        available_weekdays,
        weekday_shift_availability: data.weekday_shift_availability
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("Corretor adicionado com sucesso!");
      setOpen(false);
      setFormData({ name: "", creci: "", weekday_shift_availability: defaultShiftAvailability });
    },
    onError: (error: any) => {
      console.error("Erro ao adicionar corretor:", error);
      if (error?.code === "23505") {
        toast.error("Este CRECI já está cadastrado!");
      } else {
        toast.error("Não foi possível adicionar o corretor. Tente novamente.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const available_weekdays = convertToAvailableWeekdays(data.weekday_shift_availability);
      const { error } = await supabase.from("brokers").update({
        name: data.name,
        creci: data.creci,
        available_weekdays,
        weekday_shift_availability: data.weekday_shift_availability
      }).eq("id", id);
      if (error) throw error;

      // Cascatear disponibilidade para todos os locais vinculados
      const newAvail = data.weekday_shift_availability;
      const hasMorning = Object.values(newAvail).some(shifts => shifts?.includes("morning"));
      const hasAfternoon = Object.values(newAvail).some(shifts => shifts?.includes("afternoon"));

      const { data: linkedLocations } = await supabase
        .from("location_brokers")
        .select("id")
        .eq("broker_id", id);

      if (linkedLocations && linkedLocations.length > 0) {
        for (const lb of linkedLocations) {
          await supabase.from("location_brokers").update({
            weekday_shift_availability: newAvail as any,
            available_morning: hasMorning,
            available_afternoon: hasAfternoon,
          }).eq("id", lb.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Corretor atualizado com sucesso!");
      setOpen(false);
      setEditingBroker(null);
      setFormData({ name: "", creci: "", weekday_shift_availability: defaultShiftAvailability });
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar corretor:", error);
      if (error?.code === "23505") {
        toast.error("Este CRECI já está cadastrado!");
      } else {
        toast.error("Não foi possível atualizar o corretor. Tente novamente.");
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("brokers")
        .update({ is_active: !is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brokers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("Corretor excluído com sucesso!");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = brokerSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }
    
    if (editingBroker) {
      updateMutation.mutate({ id: editingBroker.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (broker: Broker) => {
    setEditingBroker(broker);
    // Usar weekday_shift_availability se existir, senão converter de available_weekdays
    const shiftAvailability = broker.weekday_shift_availability || 
      convertFromAvailableWeekdays(broker.available_weekdays || ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']);
    setFormData({ 
      name: broker.name, 
      creci: broker.creci, 
      weekday_shift_availability: shiftAvailability
    });
    setOpen(true);
  };

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const searchNormalized = normalizeText(debouncedSearch);
  const filteredBrokers = brokers?.filter((broker) =>
    normalizeText(broker.name).includes(searchNormalized) ||
    normalizeText(broker.creci).includes(searchNormalized)
  );

  const sortedBrokers = [...(filteredBrokers || [])].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (sortColumn === 'is_active') {
      return sortDirection === 'asc' 
        ? (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1)
        : (a.is_active === b.is_active ? 0 : a.is_active ? 1 : -1);
    }
    
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedBrokers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBrokers = sortedBrokers.slice(startIndex, endIndex);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Corretores</h1>
            <p className="text-muted-foreground">Gerencie os corretores cadastrados</p>
          </div>
          {canEditEscalas && (
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingBroker(null); setFormData({ name: "", creci: "", weekday_shift_availability: defaultShiftAvailability }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Corretor
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBroker ? "Editar" : "Adicionar"} Corretor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="creci">CRECI</Label>
                <Input
                  id="creci"
                  value={formData.creci}
                  onChange={(e) => {
                    const formatted = formatCreci(e.target.value);
                    setFormData({ ...formData, creci: formatted });
                  }}
                  placeholder="Ex: 123456-F"
                  required
                />
              </div>
              <WeekdayShiftSelector
                value={formData.weekday_shift_availability}
                onChange={(availability) => setFormData({ ...formData, weekday_shift_availability: availability })}
              />
              <Button type="submit" className="w-full">
                {editingBroker ? "Atualizar" : "Adicionar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CRECI..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                onClick={() => handleSort('name')}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Nome
                  {sortColumn === 'name' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-40" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                onClick={() => handleSort('creci')}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-1">
                  CRECI
                  {sortColumn === 'creci' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-40" />
                  )}
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort('is_active')}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Status
                  {sortColumn === 'is_active' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-40" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8" />
                      {canEditEscalas && (
                        <>
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedBrokers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {searchTerm ? "Nenhum corretor encontrado" : "Nenhum corretor cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedBrokers.map((broker) => (
                <TableRow key={broker.id}>
                  <TableCell className="font-medium">{broker.name}</TableCell>
                  <TableCell>{broker.creci}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        broker.is_active
                          ? "bg-accent/10 text-accent"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {broker.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setViewingBroker(broker);
                          setViewDialogOpen(true);
                        }}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditEscalas && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(broker)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setToggleBrokerId(broker.id);
                              setToggleBrokerName(broker.name);
                              setToggleBrokerStatus(broker.is_active);
                            }}
                            title={broker.is_active ? "Desativar" : "Ativar"}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              setDeleteBrokerId(broker.id);
                              setDeleteBrokerName(broker.name);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && sortedBrokers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1}-{Math.min(endIndex, sortedBrokers.length)} de {sortedBrokers.length} corretores
          </div>
          
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return null;
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Corretor</DialogTitle>
          </DialogHeader>
          {viewingBroker && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nome</Label>
                  <p className="font-medium">{viewingBroker.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">CRECI</Label>
                  <p className="font-medium">{viewingBroker.creci}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      viewingBroker.is_active
                        ? "bg-accent/10 text-accent"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {viewingBroker.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Disponibilidade de Turnos</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Dia</th>
                        <th className="px-3 py-2 text-center font-medium">Manhã</th>
                        <th className="px-3 py-2 text-center font-medium">Tarde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map((day, idx) => {
                        const dayNames: Record<string, string> = {
                          monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
                          thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo'
                        };
                        const availability = viewingBroker.weekday_shift_availability || {};
                        const dayShifts = availability[day] || [];
                        const hasMorning = dayShifts.includes('morning');
                        const hasAfternoon = dayShifts.includes('afternoon');
                        
                        return (
                          <tr key={day} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                            <td className="px-3 py-2 font-medium">{dayNames[day]}</td>
                            <td className="px-3 py-2 text-center">
                              {hasMorning ? (
                                <Check className="h-4 w-4 text-accent mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {hasAfternoon ? (
                                <Check className="h-4 w-4 text-accent mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {(viewingBroker as any).created_at && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-muted-foreground">Criado em</Label>
                    <p className="text-sm">
                      {new Date((viewingBroker as any).created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {(viewingBroker as any).updated_at && (
                    <div>
                      <Label className="text-muted-foreground">Atualizado em</Label>
                      <p className="text-sm">
                        {new Date((viewingBroker as any).updated_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar ativação/desativação */}
      <AlertDialog open={toggleBrokerId !== null} onOpenChange={(open) => !open && setToggleBrokerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleBrokerStatus ? "⚠️ Desativar Corretor" : "✅ Ativar Corretor"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {toggleBrokerStatus ? "desativar" : "ativar"} o corretor{" "}
              <strong>{toggleBrokerName}</strong>?
              {toggleBrokerStatus && " O corretor não aparecerá nas novas escalas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toggleBrokerId) {
                  toggleActiveMutation.mutate({
                    id: toggleBrokerId,
                    is_active: toggleBrokerStatus,
                  });
                  setToggleBrokerId(null);
                }
              }}
            >
              {toggleBrokerStatus ? "Desativar" : "Ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para confirmar exclusão */}
      <AlertDialog open={deleteBrokerId !== null} onOpenChange={(open) => !open && setDeleteBrokerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Excluir Corretor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o corretor{" "}
              <strong>{deleteBrokerName}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteBrokerId) {
                  deleteMutation.mutate(deleteBrokerId);
                  setDeleteBrokerId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Brokers;