import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TrendingUp, Search, Eye, EyeOff, Users } from "lucide-react";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { TeamFilter } from "@/components/vendas/TeamFilter";
import { YearMonthSelector } from "@/components/vendas/YearMonthSelector";
import { TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { useTableControls } from "@/hooks/useTableControls";

const saleSchema = z.object({
  broker_id: z.string().min(1, "Selecione um corretor"),
  sale_date: z.string().min(1, "Selecione a data da venda"),
  sale_value: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  property_name: z.string().min(1, "Número do processo é obrigatório"),
  has_partners: z.boolean().default(false),
  partner_ids: z.array(z.string()).default([]),
});

type SaleForm = z.infer<typeof saleSchema>;

interface SaleProportional {
  sale_id: string;
  broker_id: string;
  owner_broker_id: string;
  team_id: string | null;
  sale_date: string;
  year_month: string;
  property_name: string | null;
  total_value: number;
  has_partners: boolean;
  participant_count: number;
  proportional_value: number;
  role: string;
  broker_name: string;
  owner_name: string;
  team_name: string;
}

interface SalePartner {
  id: string;
  broker_id: string;
  sales_brokers: {
    id: string;
    name: string;
  };
}

interface Sale {
  id: string;
  broker_id: string;
  team_id: string | null;
  sale_date: string;
  sale_value: number;
  property_name: string | null;
  year_month: string;
  created_at: string | null;
  has_partners: boolean;
  sale_partners?: SalePartner[];
}

export default function Sales() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useUserRole();
  // ✅ USAR PERMISSÃO DE SISTEMA para controlar botões de edição
  const { canEdit } = useSystemAccess();
  const canEditVendas = canEdit("vendas");
  
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedTeam, setSelectedTeam] = useState("all");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<SaleProportional | null>(null);
  const [showValues, setShowValues] = useState(false);

  const form = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      broker_id: "",
      sale_date: "",
      sale_value: 0,
      property_name: "",
      has_partners: false,
      partner_ids: [],
    },
  });

  const watchHasPartners = form.watch("has_partners");
  const watchBrokerId = form.watch("broker_id");

  const { data: brokers = [] } = useQuery({
    queryKey: ["sales-brokers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_brokers")
        .select("id, name, team_id, sales_teams(id, name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // All brokers (active and inactive) for partner selection
  const { data: allBrokers = [] } = useQuery({
    queryKey: ["sales-brokers-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_brokers")
        .select("id, name, team_id, is_active, sales_teams(id, name)")
        .order("is_active", { ascending: false })
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Filter brokers for partner selection (exclude owner)
  const availablePartners = useMemo(() => {
    return allBrokers.filter(b => b.id !== watchBrokerId);
  }, [allBrokers, watchBrokerId]);

  // Query using the broker_sales_proportional view
  const { data: salesProportional = [], isLoading } = useQuery({
    queryKey: ["sales-proportional", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("broker_sales_proportional")
        .select("*")
        .order("sale_date", { ascending: false })
        .order("property_name");
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch broker and team names
      const brokerIds = [...new Set(data.map(d => d.broker_id))];
      const ownerIds = [...new Set(data.map(d => d.owner_broker_id))];
      const allBrokerIds = [...new Set([...brokerIds, ...ownerIds])];
      const teamIds = [...new Set(data.map(d => d.team_id).filter(Boolean))] as string[];
      
      const [brokersRes, teamsRes] = await Promise.all([
        supabase.from("sales_brokers").select("id, name").in("id", allBrokerIds),
        teamIds.length > 0 
          ? supabase.from("sales_teams").select("id, name").in("id", teamIds)
          : Promise.resolve({ data: [] })
      ]);
      
      const brokerMap = Object.fromEntries((brokersRes.data || []).map(b => [b.id, b.name]));
      const teamMap = Object.fromEntries((teamsRes.data || []).map(t => [t.id, t.name]));
      
      return data.map(row => ({
        ...row,
        broker_name: brokerMap[row.broker_id] || "-",
        owner_name: brokerMap[row.owner_broker_id] || "-",
        team_name: row.team_id ? teamMap[row.team_id] || "-" : "-",
      })) as SaleProportional[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SaleForm) => {
      const saleDate = data.sale_date;
      const saleYearMonth = format(new Date(saleDate + "T12:00:00"), "yyyy-MM");
      
      // Get the broker's current team to save with the sale
      const broker = brokers.find(b => b.id === data.broker_id);
      const teamId = broker?.team_id || null;
      
      const { data: newSale, error } = await supabase.from("sales").insert([{
        broker_id: data.broker_id,
        team_id: teamId,
        sale_date: saleDate,
        sale_value: data.sale_value,
        property_name: data.property_name || null,
        year_month: saleYearMonth,
        has_partners: data.has_partners,
        created_by: user?.id,
      }]).select("id").single();
      if (error) throw error;

      // Insert partners if has_partners is true
      if (data.has_partners && data.partner_ids.length > 0 && newSale) {
        const { error: partnersError } = await supabase.from("sale_partners").insert(
          data.partner_ids.map(partnerId => ({
            sale_id: newSale.id,
            broker_id: partnerId,
          }))
        );
        if (partnersError) throw partnersError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-proportional"] });
      toast.success("Venda registrada com sucesso!");
      handleCloseDialog();
    },
    onError: () => toast.error("Erro ao registrar venda"),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SaleForm & { id: string; originalBrokerId?: string }) => {
      const saleDate = data.sale_date;
      const saleYearMonth = format(new Date(saleDate + "T12:00:00"), "yyyy-MM");
      
      // Only recalculate team_id if broker changed
      const brokerChanged = data.originalBrokerId && data.originalBrokerId !== data.broker_id;
      const updateData: Record<string, unknown> = {
        broker_id: data.broker_id,
        sale_date: saleDate,
        sale_value: data.sale_value,
        property_name: data.property_name || null,
        year_month: saleYearMonth,
        has_partners: data.has_partners,
      };
      
      // Only update team_id if broker was changed
      if (brokerChanged) {
        const broker = brokers.find(b => b.id === data.broker_id);
        updateData.team_id = broker?.team_id || null;
      }
      
      const { error } = await supabase
        .from("sales")
        .update(updateData)
        .eq("id", data.id);
      if (error) throw error;

      // Delete existing partners
      await supabase.from("sale_partners").delete().eq("sale_id", data.id);

      // Insert new partners if has_partners is true
      if (data.has_partners && data.partner_ids.length > 0) {
        const { error: partnersError } = await supabase.from("sale_partners").insert(
          data.partner_ids.map(partnerId => ({
            sale_id: data.id,
            broker_id: partnerId,
          }))
        );
        if (partnersError) throw partnersError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-proportional"] });
      toast.success("Venda atualizada com sucesso!");
      handleCloseDialog();
    },
    onError: () => toast.error("Erro ao atualizar venda"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-proportional"] });
      toast.success("Venda excluída com sucesso!");
      setIsDeleteDialogOpen(false);
      setSaleToDelete(null);
    },
    onError: () => toast.error("Erro ao excluir venda"),
  });

  const handleOpenCreate = () => {
    form.reset({
      broker_id: "",
      sale_date: format(new Date(), "yyyy-MM-dd"),
      sale_value: 0,
      property_name: "",
      has_partners: false,
      partner_ids: [],
    });
    setEditingSale(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = async (saleProp: SaleProportional) => {
    // Fetch the complete sale record with partners
    const { data: saleData } = await supabase
      .from("sales")
      .select("*, sale_partners(id, broker_id, sales_brokers(id, name))")
      .eq("id", saleProp.sale_id)
      .single();
    
    if (!saleData) {
      toast.error("Erro ao carregar dados da venda");
      return;
    }
    
    const partnerIds = saleData.sale_partners?.map((p: SalePartner) => p.broker_id) || [];
    
    form.reset({
      broker_id: saleData.broker_id,
      sale_date: saleData.sale_date,
      sale_value: saleData.sale_value, // Total value for editing
      property_name: saleData.property_name || "",
      has_partners: saleData.has_partners || false,
      partner_ids: partnerIds,
    });
    
    setEditingSale(saleData as Sale);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSale(null);
    form.reset();
  };

  const handleOpenDelete = (sale: SaleProportional) => {
    // Block deletion for partners
    if (sale.role === "partner") {
      toast.error(`Esta venda pertence ao(a) ${sale.owner_name}. Para excluir, acesse o registro do titular.`);
      return;
    }
    
    setSaleToDelete(sale);
    setIsDeleteDialogOpen(true);
  };

  const onSubmit = async (data: SaleForm) => {
    // Check for duplicate process number
    const { data: existing } = await supabase
      .from("sales")
      .select("id")
      .eq("property_name", data.property_name)
      .neq("id", editingSale?.id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    
    if (existing) {
      toast.error("Este número de processo já está cadastrado em outra venda");
      return;
    }
    
    if (editingSale) {
      updateMutation.mutate({ ...data, id: editingSale.id, originalBrokerId: editingSale.broker_id });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter by team using the proportional data's team_id
  const filteredByTeam = useMemo(() => {
    if (selectedTeam === "all") return salesProportional;
    return salesProportional.filter(sale => sale.team_id === selectedTeam);
  }, [salesProportional, selectedTeam]);

  // Use table controls for search, pagination, and sorting
  const tableControls = useTableControls({
    data: filteredByTeam,
    searchField: ["broker_name", "property_name"],
    defaultItemsPerPage: 20,
  });

  // Calculate totals using proportional values
  const totalVGV = tableControls.filteredData.reduce((acc, sale) => acc + sale.proportional_value, 0);
  // Count unique sales
  const uniqueSaleIds = new Set(tableControls.filteredData.map(s => s.sale_id));
  const totalSales = uniqueSaleIds.size;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(new Date(date + "T12:00:00"), "dd/MM/yyyy");
  };

  const periodLabel = selectedMonth === null ? "do Ano" : "do Mês";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">Gerencie as vendas realizadas</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <YearMonthSelector
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            allowFullYear
          />
          <TeamFilter value={selectedTeam} onChange={setSelectedTeam} />
          {canEditVendas && (
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Venda
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">VGV {periodLabel}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowValues(!showValues)}
            >
              {showValues ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{showValues ? formatCurrency(totalVGV) : "R$ ******"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Vendas Registradas</CardTitle>
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar corretor ou processo..."
                value={tableControls.searchTerm}
                onChange={(e) => tableControls.setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : tableControls.filteredData.length === 0 ? (
            <p className="text-muted-foreground">
              {tableControls.searchTerm ? "Nenhuma venda encontrada para a busca." : "Nenhuma venda encontrada."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortableHeader
                          label="Data"
                          field="sale_date"
                          currentField={tableControls.sortField as string}
                          direction={tableControls.sortDirection}
                          onSort={() => tableControls.setSorting("sale_date" as keyof SaleProportional)}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHeader
                          label="Corretor"
                          field="broker_name"
                          currentField={tableControls.sortField as string}
                          direction={tableControls.sortDirection}
                          onSort={() => tableControls.setSorting("broker_name" as keyof SaleProportional)}
                        />
                      </TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Processo</TableHead>
                      <TableHead className="text-right">
                        <SortableHeader
                          label="Valor"
                          field="proportional_value"
                          currentField={tableControls.sortField as string}
                          direction={tableControls.sortDirection}
                          onSort={() => tableControls.setSorting("proportional_value" as keyof SaleProportional)}
                          className="justify-end"
                        />
                      </TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableControls.paginatedData.map((sale, index) => (
                      <TableRow key={`${sale.sale_id}-${sale.broker_id}-${index}`}>
                        <TableCell>{formatDate(sale.sale_date)}</TableCell>
                        <TableCell className="font-medium">
                          <TooltipProvider>
                            <div className="flex items-center gap-1">
                              {sale.broker_name}
                              {sale.role === "partner" && (
                                <span className="text-xs text-muted-foreground">(parceiro)</span>
                              )}
                              {sale.has_partners && sale.role === "owner" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Users className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">Venda com parceria</p>
                                    <p>{sale.participant_count} participantes</p>
                                    <p>Valor total: {formatCurrency(sale.total_value)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{sale.team_name}</TableCell>
                        <TableCell>{sale.property_name || "-"}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCurrency(sale.proportional_value)}
                        </TableCell>
                        <TableCell>
                          {sale.role === "owner" && canEditVendas ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(sale)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {canEditVendas && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDelete(sale)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground px-2">-</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Apenas o titular pode editar/excluir</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={tableControls.currentPage}
                totalPages={tableControls.totalPages}
                itemsPerPage={tableControls.itemsPerPage}
                onPageChange={tableControls.setCurrentPage}
                onItemsPerPageChange={tableControls.setItemsPerPage}
                totalItems={tableControls.filteredData.length}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingSale ? "Editar Venda" : "Registrar Venda"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              <FormField
                control={form.control}
                name="broker_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corretor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um corretor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {brokers.map((broker) => (
                          <SelectItem key={broker.id} value={broker.id}>
                            {broker.name}
                            {broker.sales_teams && ` (${broker.sales_teams.name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sale_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da Venda</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sale_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Processo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Partnership Section */}
              <FormField
                control={form.control}
                name="has_partners"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Venda com parceria</FormLabel>
                      <FormDescription>
                        Dividir valor com outros corretores
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (!checked) {
                            form.setValue("partner_ids", []);
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchHasPartners && watchBrokerId && (
                <FormField
                  control={form.control}
                  name="partner_ids"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corretores Parceiros</FormLabel>
                      <FormDescription>
                        O valor será dividido igualmente entre o titular e os parceiros
                      </FormDescription>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                        {availablePartners.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum outro corretor disponível</p>
                        ) : (
                          availablePartners.map((broker) => (
                            <div key={broker.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`partner-${broker.id}`}
                                checked={field.value?.includes(broker.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, broker.id]);
                                  } else {
                                    field.onChange(current.filter(id => id !== broker.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`partner-${broker.id}`}
                                className={`text-sm font-medium leading-none cursor-pointer ${
                                  !broker.is_active ? "text-muted-foreground line-through" : ""
                                }`}
                              >
                                {broker.name}
                                {broker.sales_teams && ` (${broker.sales_teams.name})`}
                                {!broker.is_active && (
                                  <span className="ml-2 text-xs text-orange-500 no-underline">(inativo)</span>
                                )}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      {field.value && field.value.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded-md">
                          <p>
                            <strong>Participantes:</strong> {1 + field.value.length} (titular + {field.value.length} parceiro{field.value.length > 1 ? "s" : ""})
                          </p>
                          {form.watch("sale_value") > 0 && (
                            <p>
                              <strong>Valor por corretor:</strong>{" "}
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                                form.watch("sale_value") / (1 + field.value.length)
                              )}
                            </p>
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              </div>

              <DialogFooter className="shrink-0 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingSale ? "Salvar" : "Registrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {saleToDelete?.has_partners 
                ? "Excluir venda com parceria?" 
                : "Confirmar exclusão"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {saleToDelete?.has_partners ? (
                  <>
                    <p>
                      Esta venda possui <strong>{saleToDelete.participant_count} participantes</strong>.
                      Ao excluir, os registros de todos serão removidos.
                    </p>
                    <p className="text-sm">
                      Processo: <strong>{saleToDelete.property_name}</strong>
                    </p>
                    <p className="text-sm">
                      Valor total da venda: <strong>{formatCurrency(saleToDelete.total_value)}</strong>
                    </p>
                  </>
                ) : (
                  <p>
                    Deseja excluir a venda de {saleToDelete?.broker_name} no valor de{" "}
                    {formatCurrency(saleToDelete?.proportional_value || 0)}?
                  </p>
                )}
                <p className="text-destructive font-medium pt-2">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => saleToDelete && deleteMutation.mutate(saleToDelete.sale_id)}
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
