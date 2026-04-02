import { useState, useMemo, useEffect } from "react";
import { normalizeText } from "@/lib/textUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { locationSchema } from "@/lib/validations/locationSchema";
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
import { Plus, Edit, Trash2, Ban, Search, Settings, Calendar, Eye, ArrowUp, ArrowDown, ArrowUpDown, Building2, Home } from "lucide-react";
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
import { BrokerAvailabilityForm } from "@/components/BrokerAvailabilityForm";
import { LocationPeriodTree } from "@/components/LocationPeriodTree";
import { Skeleton } from "@/components/ui/skeleton";

interface Location {
  id: string;
  name: string;
  cep: string;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  location_type: string;
  shift_config_mode?: string;
  builder_company: string | null;
  is_active: boolean;
}

// Mapear nomes de dias para números (0 = domingo, 1 = segunda, etc)
const weekdayToNumber: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Contar quantas vezes um dia da semana ocorre em um período
const countWeekdayOccurrences = (
  startDate: string,
  endDate: string,
  weekday: string
): number => {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const targetDay = weekdayToNumber[weekday];
  
  if (targetDay === undefined) return 0;
  
  let count = 0;
  const current = new Date(start);
  
  // Iterar por cada dia do período
  while (current <= end) {
    if (current.getDay() === targetDay) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

const calculateTotalDays = (location: any) => {
  if (!location.location_periods || location.location_periods.length === 0) {
    return 0;
  }

  let totalDays = 0;

  for (const period of location.location_periods) {
    // Para modo specific_date OU externos: contar period_specific_day_configs
    if (period.period_specific_day_configs?.length > 0) {
      totalDays += period.period_specific_day_configs.length;
    } 
    // Para modo weekday interno: calcular ocorrências dos dias da semana no período
    else if (period.period_day_configs?.length > 0 && period.start_date && period.end_date) {
      for (const dayConfig of period.period_day_configs) {
        const occurrences = countWeekdayOccurrences(
          period.start_date,
          period.end_date,
          dayConfig.weekday
        );
        totalDays += occurrences;
      }
    }
  }

  return totalDays;
};

const Locations = () => {
  // ✅ USAR PERMISSÃO DE SISTEMA em vez de role
  const { canEdit } = useSystemAccess();
  const canEditEscalas = canEdit("escalas");
  const [open, setOpen] = useState(false);
  const [periodsDialogOpen, setPeriodsDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationType, setLocationType] = useState<"internal" | "external">("external");
  const [shiftConfigMode, setShiftConfigMode] = useState<"weekday" | "specific_date">("weekday");
  const [shiftModeChangeDialog, setShiftModeChangeDialog] = useState(false);
  const [toggleLocationId, setToggleLocationId] = useState<string | null>(null);
  const [toggleLocationStatus, setToggleLocationStatus] = useState<boolean>(false);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [deleteLocationName, setDeleteLocationName] = useState<string>("");
  const [selectedBrokers, setSelectedBrokers] = useState<{
    brokerId: string;
    availableMorning: boolean;
    availableAfternoon: boolean;
    weekday_shift_availability?: { [key: string]: ("morning" | "afternoon")[] };
  }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<'name' | 'location_type' | 'city' | 'brokers_count' | 'days_count' | 'is_active'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewingLocation, setViewingLocation] = useState<Location | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    name: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    location_type: "external",
    shift_config_mode: "weekday",
    builder_company: "",
  });
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select(`
          *,
          location_brokers(broker_id),
          location_periods(
            id,
            start_date,
            end_date,
            period_day_configs(weekday),
            period_specific_day_configs(specific_date)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const { data: brokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brokers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const searchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            street: data.logradouro || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
          }));
          toast.success("CEP encontrado!");
        } else {
          toast.error("CEP não encontrado");
        }
      } catch (error) {
        toast.error("Erro ao buscar CEP");
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: newLocation, error } = await supabase
        .from("locations")
        .insert([data])
        .select()
        .single();
      if (error) throw error;

      // Inserir associações com corretores
      if (selectedBrokers.length > 0) {
        const brokerAssociations = selectedBrokers.map((b) => ({
          location_id: newLocation.id,
          broker_id: b.brokerId,
          available_morning: b.availableMorning,
          available_afternoon: b.availableAfternoon,
          weekday_shift_availability: b.weekday_shift_availability || null,
        }));
        const { error: brokerError } = await supabase
          .from("location_brokers")
          .insert(brokerAssociations);
        if (brokerError) throw brokerError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Local adicionado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Erro ao adicionar local:", error);
      toast.error("Não foi possível adicionar o local. Tente novamente.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("locations").update(data).eq("id", id);
      if (error) throw error;

      // Deletar associações antigas e inserir novas
      await supabase.from("location_brokers").delete().eq("location_id", id);
      if (selectedBrokers.length > 0) {
        const brokerAssociations = selectedBrokers.map((b) => ({
          location_id: id,
          broker_id: b.brokerId,
          available_morning: b.availableMorning,
          available_afternoon: b.availableAfternoon,
          weekday_shift_availability: b.weekday_shift_availability || null,
        }));
        const { error: brokerError } = await supabase
          .from("location_brokers")
          .insert(brokerAssociations);
        if (brokerError) throw brokerError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["location-periods"] });
      queryClient.invalidateQueries({ queryKey: ["period-day-configs"] });
      toast.success("Local atualizado com sucesso!", {
        duration: 4000,
      });
      setOpen(false);
      setEditingLocation(null);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar local:", error);
      toast.error("Não foi possível atualizar o local. Tente novamente.");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("locations")
        .update({ is_active: !is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Local excluído com sucesso!");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      location_type: "external",
      shift_config_mode: "weekday",
      builder_company: "",
    });
    setLocationType("external");
    setShiftConfigMode("weekday");
    setSelectedBrokers([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar dados com Zod
    const validation = locationSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }
    
    // Verificar se está editando e mudou o shift_config_mode
    if (editingLocation && editingLocation.shift_config_mode !== formData.shift_config_mode) {
      // Verificar se existem períodos cadastrados
      const { data: periods, error: periodsError } = await supabase
        .from("location_periods")
        .select("id")
        .eq("location_id", editingLocation.id);

      if (periodsError) {
        toast.error("Erro ao verificar períodos existentes.");
        return;
      }

      // Se existem períodos, mostrar dialog de confirmação
      if (periods && periods.length > 0) {
        setShiftModeChangeDialog(true);
        return;
      }
    }
    
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfirmShiftModeChange = async () => {
    if (!editingLocation) return;

    try {
      // Excluir todos os períodos relacionados
      const { error: deleteError } = await supabase
        .from("location_periods")
        .delete()
        .eq("location_id", editingLocation.id);

      if (deleteError) throw deleteError;

      // Atualizar o local com o novo modo
      updateMutation.mutate({ id: editingLocation.id, data: formData });

      // Fechar dialog
      setShiftModeChangeDialog(false);
      toast.success("Períodos anteriores excluídos. Local atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar modo:", error);
      toast.error("Erro ao atualizar configuração de turno.");
    }
  };

  const openEditDialog = async (location: any) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      cep: location.cep,
      street: location.street,
      number: location.number || "",
      complement: location.complement || "",
      neighborhood: location.neighborhood,
      city: location.city,
      state: location.state,
      location_type: location.location_type || "external",
      shift_config_mode: location.shift_config_mode || "weekday",
      builder_company: location.builder_company || "",
    });
    setLocationType(location.location_type || "external");
    setShiftConfigMode(location.shift_config_mode || "weekday");

    // Carregar corretores associados
    const { data: brokers } = await supabase
      .from("location_brokers")
      .select("*")
      .eq("location_id", location.id);
    
    // Filtrar apenas corretores ativos ao carregar para edição
    const activeBrokerIds = new Set(brokers?.map((b: any) => b.id) || []);
    setSelectedBrokers(
      brokers_data
        ?.filter((b: any) => activeBrokerIds.has(b.broker_id))
        ?.map((b: any) => ({
          brokerId: b.broker_id,
          availableMorning: b.available_morning,
          availableAfternoon: b.available_afternoon,
          weekday_shift_availability: b.weekday_shift_availability || undefined,
        })) || []
    );
    setOpen(true);
  };

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const filteredAndSortedLocations = useMemo(() => {
    const searchNormalized = normalizeText(debouncedSearch);
    const filtered = locations?.filter((location) =>
      normalizeText(location.name).includes(searchNormalized) ||
      normalizeText(location.city).includes(searchNormalized) ||
      normalizeText(location.neighborhood).includes(searchNormalized)
    ) || [];

    // Aplicar ordenação
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'location_type':
          comparison = (a.location_type || '').localeCompare(b.location_type || '');
          break;
        case 'city':
          comparison = a.city.localeCompare(b.city);
          break;
        case 'brokers_count':
          const brokersA = (a as any).location_brokers?.length || 0;
          const brokersB = (b as any).location_brokers?.length || 0;
          comparison = brokersA - brokersB;
          break;
        case 'days_count':
          comparison = calculateTotalDays(a) - calculateTotalDays(b);
          break;
        case 'is_active':
          comparison = (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [locations, debouncedSearch, sortColumn, sortDirection]);

  const totalPages = Math.ceil((filteredAndSortedLocations?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLocations = filteredAndSortedLocations?.slice(startIndex, endIndex);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Locais</h1>
            <p className="text-muted-foreground">Gerencie os locais de plantão</p>
          </div>
          {canEditEscalas && (
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingLocation(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Local
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle>{editingLocation ? "Editar" : "Adicionar"} Local</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Local</Label>
                <ToggleGroup
                  type="single"
                  value={locationType}
                  onValueChange={(value) => {
                    if (value) {
                      setLocationType(value as "internal" | "external");
                      setFormData({ ...formData, location_type: value });
                    }
                  }}
                  className="grid grid-cols-2 gap-4"
                >
                  <ToggleGroupItem
                    value="external"
                    className="flex flex-col items-center gap-2 h-auto p-3 border-2 border-muted data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    <Building2 className="h-5 w-5" />
                    <div className="text-center">
                      <div className="font-medium">Externo</div>
                      <div className="text-xs text-muted-foreground data-[state=on]:text-primary-foreground">(Construtoras)</div>
                    </div>
                  </ToggleGroupItem>
                  
                  <ToggleGroupItem
                    value="internal"
                    className="flex flex-col items-center gap-2 h-auto p-3 border-2 border-muted data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    <Home className="h-5 w-5" />
                    <div className="text-center">
                      <div className="font-medium">Interno</div>
                      <div className="text-xs text-muted-foreground data-[state=on]:text-primary-foreground">(Imobiliárias)</div>
                    </div>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div>
                <Label htmlFor="name">
                  {locationType === "external" ? "Nome do Empreendimento" : "Nome do Local"}
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={locationType === "external" ? "Ex: Residencial Jardim das Flores" : "Ex: Loja Centro"}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nome do local que aparecerá nas escalas e relatórios
                </p>
              </div>
              {locationType === "external" && (
                <div>
                  <Label htmlFor="builder_company">
                    Nome da Construtora
                  </Label>
                  <Input
                    id="builder_company"
                    value={formData.builder_company || ""}
                    onChange={(e) => setFormData({ ...formData, builder_company: e.target.value })}
                    placeholder="Ex: Construtora XYZ Ltda"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado para evitar que um corretor fique em 2 empreendimentos da mesma construtora no mesmo dia
                  </p>
                </div>
              )}
              
              {locationType === "external" && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="shift_config_mode"
                      checked={shiftConfigMode === "specific_date"}
                      onCheckedChange={(checked) => {
                        const newMode = checked ? "specific_date" : "weekday";
                        setShiftConfigMode(newMode);
                        setFormData({ ...formData, shift_config_mode: newMode });
                      }}
                    />
                    <div className="flex-1">
                      <Label htmlFor="shift_config_mode" className="cursor-pointer font-medium">
                        Este local tem restrição de turno por dia específico?
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {shiftConfigMode === "specific_date" 
                          ? "✅ Habilitado: Configure cada dia individualmente (como no Orla)"
                          : "Padrão: Turnos agrupados por dia da semana (segundas, terças, etc.)"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      required
                      placeholder="00000-000"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => searchCep(formData.cep)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="street">Rua</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Corretores Associados</Label>
                <BrokerAvailabilityForm
                  brokers={brokers || []}
                  value={selectedBrokers}
                  onChange={setSelectedBrokers}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingLocation ? "Atualizar" : "Adicionar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou bairro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Por página:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(parseInt(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="w-full -mx-4 sm:mx-0">
        <div className="overflow-x-auto border rounded-md">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead 
                className="min-w-[150px] cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Nome
                  {sortColumn === 'name' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="min-w-[80px] cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('location_type')}
              >
                <div className="flex items-center gap-1">
                  Tipo
                  {sortColumn === 'location_type' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="min-w-[200px] cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('city')}
              >
                <div className="flex items-center gap-1">
                  Endereço
                  {sortColumn === 'city' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="min-w-[100px] cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('brokers_count')}
              >
                <div className="flex items-center gap-1">
                  Corretores
                  {sortColumn === 'brokers_count' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="min-w-[100px] cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('days_count')}
              >
                <div className="flex items-center gap-1">
                  Dias
                  {sortColumn === 'days_count' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="min-w-[80px] cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('is_active')}
              >
                <div className="flex items-center gap-1">
                  Status
                  {sortColumn === 'is_active' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right min-w-[200px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredAndSortedLocations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  {searchTerm ? "Nenhum local encontrado" : "Nenhum local cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedLocations?.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{location.name}</span>
                      {location.builder_company && (
                        <Badge variant="outline" className="w-fit text-xs">
                          {location.builder_company}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={location.location_type === "external" ? "default" : "secondary"}>
                      {location.location_type === "external" ? "Externo" : "Interno"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {location.street}, {location.number} - {location.city}/{location.state}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {location.location_brokers?.length || 0} corretor(es)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {calculateTotalDays(location)} dia(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={location.is_active ? "default" : "destructive"}>
                      {location.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setViewingLocation(location);
                          setViewDialogOpen(true);
                        }}
                        title="Ver detalhes"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canEditEscalas && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedLocationId(location.id);
                              setPeriodsDialogOpen(true);
                            }}
                            title="Gerenciar Períodos"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(location)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setToggleLocationId(location.id);
                              setToggleLocationStatus(location.is_active);
                            }}
                            title={location.is_active ? "Desativar local" : "Ativar local"}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setDeleteLocationId(location.id);
                              setDeleteLocationName(location.name);
                            }}
                            title="Excluir local"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* Paginação */}
        {filteredAndSortedLocations && filteredAndSortedLocations.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{Math.min(endIndex, filteredAndSortedLocations.length)} de{" "}
                {filteredAndSortedLocations.length} locais
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Por página:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(parseInt(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                {/* Páginas */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Mostrar apenas algumas páginas (primeira, última, atual e adjacentes)
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
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
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
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className={
                      currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Dialog de Visualização */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Local</DialogTitle>
          </DialogHeader>
          {viewingLocation && (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium">{viewingLocation.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tipo</Label>
                    <div className="mt-1">
                      <Badge variant={viewingLocation.location_type === "external" ? "default" : "secondary"}>
                        {viewingLocation.location_type === "external" ? "Externo" : "Interno"}
                      </Badge>
                    </div>
                  </div>
                  {viewingLocation.builder_company && (
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground">Construtora</Label>
                      <p className="font-medium">{viewingLocation.builder_company}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge variant={viewingLocation.is_active ? "default" : "destructive"}>
                        {viewingLocation.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Endereço Completo */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  Endereço
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">CEP</Label>
                    <p className="font-medium">{viewingLocation.cep}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Número</Label>
                    <p className="font-medium">{viewingLocation.number || "S/N"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-muted-foreground">Rua</Label>
                    <p className="font-medium">{viewingLocation.street}</p>
                  </div>
                  {viewingLocation.complement && (
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground">Complemento</Label>
                      <p className="font-medium">{viewingLocation.complement}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Bairro</Label>
                    <p className="font-medium">{viewingLocation.neighborhood}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cidade/Estado</Label>
                    <p className="font-medium">{viewingLocation.city}/{viewingLocation.state}</p>
                  </div>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  Estatísticas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Corretores Vinculados</Label>
                    <div className="mt-1">
                      <Badge variant="outline">
                        {(viewingLocation as any).location_brokers?.length || 0} corretor(es)
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Períodos Configurados</Label>
                    <div className="mt-1">
                      <Badge variant="outline">
                        {(viewingLocation as any).location_periods?.length || 0} período(s)
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Datas de Sistema */}
              {(viewingLocation as any).created_at && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    Informações do Sistema
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Criado em</Label>
                      <p className="text-sm">
                        {new Date((viewingLocation as any).created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    {(viewingLocation as any).updated_at && (
                      <div>
                        <Label className="text-muted-foreground">Última atualização</Label>
                        <p className="text-sm">
                          {new Date((viewingLocation as any).updated_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

        <Dialog open={periodsDialogOpen} onOpenChange={setPeriodsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle>
                Gerenciar Períodos
                {selectedLocationId && locations && (
                  <span className="text-muted-foreground">
                    {" - "}
                    {locations.find(l => l.id === selectedLocationId)?.name}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedLocationId && locations && (
              <LocationPeriodTree 
                locationId={selectedLocationId}
                locationName={locations.find(l => l.id === selectedLocationId)?.name || ""}
                locationType={locations.find(l => l.id === selectedLocationId)?.location_type as "internal" | "external" || "external"}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação: Mudança de Modo */}
        <AlertDialog open={shiftModeChangeDialog} onOpenChange={setShiftModeChangeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Atenção: Mudança de Configuração</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Você está alterando o modo de configuração de turnos deste local.
                </p>
                <p className="font-medium text-foreground">
                  {formData.shift_config_mode === "specific_date" 
                    ? "🔄 De: Agrupado por dia da semana → Para: Por dia específico"
                    : "🔄 De: Por dia específico → Para: Agrupado por dia da semana"
                  }
                </p>
                <p className="text-destructive font-medium">
                  ⚠️ IMPORTANTE: Todos os períodos já cadastrados para este local serão EXCLUÍDOS, 
                  pois foram criados com regras diferentes das novas configurações.
                </p>
                <p>
                  Você precisará cadastrar novos períodos após esta mudança.
                </p>
                <p className="font-medium">
                  Deseja continuar?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShiftConfigMode(editingLocation?.shift_config_mode as "weekday" | "specific_date" || "weekday");
                setFormData({ 
                  ...formData, 
                  shift_config_mode: editingLocation?.shift_config_mode || "weekday" 
                });
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmShiftModeChange}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar e Excluir Períodos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Confirmação: Ativar/Desativar */}
        <AlertDialog 
          open={toggleLocationId !== null} 
          onOpenChange={(open) => !open && setToggleLocationId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {toggleLocationStatus ? "Desativar Local" : "Ativar Local"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {toggleLocationStatus 
                  ? "Tem certeza que deseja desativar este local? Ele não aparecerá mais nas listagens ativas."
                  : "Tem certeza que deseja ativar este local? Ele voltará a aparecer nas listagens ativas."
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (toggleLocationId) {
                    toggleActiveMutation.mutate({
                      id: toggleLocationId,
                      is_active: toggleLocationStatus,
                    });
                    setToggleLocationId(null);
                  }
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Confirmação: Excluir */}
        <AlertDialog 
          open={deleteLocationId !== null} 
          onOpenChange={(open) => !open && setDeleteLocationId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Excluir Local</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Tem certeza que deseja excluir permanentemente o local{" "}
                  <span className="font-semibold text-foreground">"{deleteLocationName}"</span>?
                </p>
                <p className="text-destructive font-medium">
                  ⚠️ Esta ação não pode ser desfeita e todos os dados associados 
                  (períodos, escalas, etc.) também serão excluídos.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteLocationId) {
                    deleteMutation.mutate(deleteLocationId);
                    setDeleteLocationId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
};

export default Locations;
