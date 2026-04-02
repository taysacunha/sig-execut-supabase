import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserPlus, Loader2, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { normalizeText, isSimilarName } from "@/lib/textUtils";
import { formatCreci } from "@/lib/utils";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const brokerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  nome_exibicao: z.string().nullable(),
  creci: z.string().nullable(),
  team_id: z.string().nullable(),
  is_active: z.boolean(),
  deactivated_month: z.string().nullable(),
  is_manager: z.boolean(),
  hire_date: z.string().nullable(),
  birth_date: z.string().nullable(),
  broker_type: z.enum(["venda", "locacao"]),
});

type BrokerFormData = z.infer<typeof brokerSchema>;

interface SalesBroker {
  id: string;
  name: string;
  creci: string | null;
  team_id: string | null;
  team_name?: string;
  is_active: boolean;
  deactivated_month: string | null;
  is_manager: boolean;
  hire_date: string | null;
  birth_date: string | null;
  broker_type: "venda" | "locacao";
  created_at: string;
}

interface SalesTeam {
  id: string;
  name: string;
}

const SalesBrokers = () => {
  const queryClient = useQueryClient();
  // ✅ USAR PERMISSÃO DE SISTEMA para controlar botões de edição
  const { canEdit } = useSystemAccess();
  const canEditVendas = canEdit("vendas");
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteBroker, setDeleteBroker] = useState<SalesBroker | null>(null);
  const [editingBroker, setEditingBroker] = useState<SalesBroker | null>(null);
  const [cascadeYear, setCascadeYear] = useState<string>(new Date().getFullYear().toString());
  const [cascadeMonth, setCascadeMonth] = useState<string | null>(null);
  const [originalTeamId, setOriginalTeamId] = useState<string | null>(null);

  const updateSalesFrom = useMemo(() => {
    if (cascadeMonth) return `${cascadeYear}-${cascadeMonth}`;
    return null;
  }, [cascadeYear, cascadeMonth]);
  const [formData, setFormData] = useState<BrokerFormData>({
    name: "",
    nome_exibicao: null,
    creci: null,
    team_id: null,
    is_active: true,
    deactivated_month: null,
    is_manager: false,
    hire_date: null,
    birth_date: null,
    broker_type: "venda",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: teams } = useQuery({
    queryKey: ["sales-teams-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as SalesTeam[];
    },
  });

  const { data: brokers = [], isLoading } = useQuery({
    queryKey: ["sales-brokers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_brokers")
        .select(`
          *,
          sales_teams (name)
        `)
        .order("name");

      if (error) throw error;

      return (data || []).map((broker: any) => ({
        id: broker.id,
        name: broker.name,
        creci: broker.creci || null,
        team_id: broker.team_id,
        team_name: broker.sales_teams?.name || null,
        is_active: broker.is_active,
        deactivated_month: broker.deactivated_month,
        is_manager: broker.is_manager ?? false,
        hire_date: broker.hire_date,
        birth_date: broker.birth_date,
        broker_type: broker.broker_type || "venda",
        created_at: broker.created_at,
      })) as SalesBroker[];
    },
  });

  const tableControls = useTableControls({
    data: brokers,
    searchField: "name" as keyof SalesBroker,
  });

  // Month options for deactivation
  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    };
  });

  const checkDuplicateName = (name: string, excludeId?: string): boolean => {
    return brokers.some(
      (broker) =>
        broker.id !== excludeId && isSimilarName(broker.name, name)
    );
  };

  const createMutation = useMutation({
    mutationFn: async (data: BrokerFormData) => {
      const { error } = await supabase.from("sales_brokers").insert([{
        name: data.name,
        nome_exibicao: data.nome_exibicao || null,
        creci: data.creci || null,
        team_id: data.team_id || null,
        is_active: data.is_active,
        deactivated_month: !data.is_active ? data.deactivated_month : null,
        is_manager: data.is_manager,
        hire_date: data.hire_date || null,
        birth_date: data.birth_date || null,
        broker_type: data.broker_type,
      } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-brokers"] });
      queryClient.invalidateQueries({ queryKey: ["sales-teams"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-birthdays"] });
      toast.success("Corretor criado com sucesso!");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar corretor");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, cascadeTeamFrom }: { id: string; data: BrokerFormData; cascadeTeamFrom?: string | null }) => {
      const { error } = await supabase
        .from("sales_brokers")
        .update({
          name: data.name,
          nome_exibicao: data.nome_exibicao || null,
          creci: data.creci || null,
          team_id: data.team_id || null,
          is_active: data.is_active,
          deactivated_month: !data.is_active ? data.deactivated_month : null,
          is_manager: data.is_manager,
          hire_date: data.hire_date || null,
          birth_date: data.birth_date || null,
          broker_type: data.broker_type,
        } as any)
        .eq("id", id);
      if (error) throw error;

      // Cascade team_id to sales table if requested
      if (cascadeTeamFrom && data.team_id) {
        const { error: salesError } = await supabase
          .from("sales")
          .update({ team_id: data.team_id } as any)
          .eq("broker_id", id)
          .gte("year_month", cascadeTeamFrom);
        if (salesError) {
          console.error("Erro ao atualizar vendas:", salesError);
          throw new Error("Corretor atualizado, mas houve erro ao migrar vendas para a nova equipe.");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-brokers"] });
      queryClient.invalidateQueries({ queryKey: ["sales-teams"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-birthdays"] });
      toast.success("Corretor atualizado com sucesso!");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar corretor");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if broker has any sales, proposals, or leads
      const [salesCheck, proposalsCheck, leadsCheck] = await Promise.all([
        supabase.from("sales").select("id").eq("broker_id", id).limit(1),
        supabase.from("broker_monthly_proposals").select("id").eq("broker_id", id).limit(1),
        supabase.from("monthly_leads").select("id").eq("broker_id", id).limit(1),
      ]);
      
      const hasSales = (salesCheck.data?.length || 0) > 0;
      const hasProposals = (proposalsCheck.data?.length || 0) > 0;
      const hasLeads = (leadsCheck.data?.length || 0) > 0;
      
      if (hasSales || hasProposals || hasLeads) {
        throw new Error("DEACTIVATE_INSTEAD");
      }
      
      const { error } = await supabase.from("sales_brokers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-brokers"] });
      queryClient.invalidateQueries({ queryKey: ["sales-teams"] });
      toast.success("Corretor removido com sucesso!");
      setDeleteBroker(null);
    },
    onError: (error: any) => {
      if (error.message === "DEACTIVATE_INSTEAD") {
        toast.error("Este corretor possui registros vinculados. Use a opção de desativar em vez de remover.");
      } else {
        toast.error(error.message || "Erro ao remover corretor");
      }
      setDeleteBroker(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingBroker(null);
    setFormData({ name: "", nome_exibicao: null, creci: null, team_id: null, is_active: true, deactivated_month: null, is_manager: false, hire_date: null, birth_date: null, broker_type: "venda" });
    setErrors({});
    setDialogOpen(true);
  };
  const handleOpenEdit = (broker: SalesBroker) => {
    setEditingBroker(broker);
    setOriginalTeamId(broker.team_id);
    setUpdateSalesFrom(null);
    setFormData({
      name: broker.name,
      nome_exibicao: (broker as any).nome_exibicao || null,
      creci: broker.creci || null,
      team_id: broker.team_id,
      is_active: broker.is_active,
      deactivated_month: broker.deactivated_month,
      is_manager: broker.is_manager,
      hire_date: broker.hire_date,
      birth_date: broker.birth_date,
      broker_type: broker.broker_type,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBroker(null);
    setOriginalTeamId(null);
    setUpdateSalesFrom(null);
    setFormData({ name: "", nome_exibicao: null, creci: null, team_id: null, is_active: true, deactivated_month: null, is_manager: false, hire_date: null, birth_date: null, broker_type: "venda" });
    setErrors({});
  };

  const handleSubmit = () => {
    const result = brokerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Check for duplicates
    if (checkDuplicateName(formData.name, editingBroker?.id)) {
      setErrors({ name: "Já existe um corretor com nome similar" });
      toast.error("Já existe um corretor com nome similar (ex: Flávia = Flavia)");
      return;
    }

    if (editingBroker) {
      const teamChanged = formData.team_id !== originalTeamId;
      updateMutation.mutate({ 
        id: editingBroker.id, 
        data: result.data,
        cascadeTeamFrom: teamChanged ? updateSalesFrom : null,
      });
    } else {
      createMutation.mutate(result.data);
    }
  };

  const handleExportPDF = useCallback(async () => {
    const activeBrokers = brokers
      .filter(b => b.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (activeBrokers.length === 0) {
      toast.error("Nenhum corretor ativo para exportar");
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Load logo
      let logoBase64: string | null = null;
      try {
        const response = await fetch("/src/assets/execut-logo.jpg");
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        // Logo optional
      }

      // Header
      let yPos = 15;
      if (logoBase64) {
        doc.addImage(logoBase64, "JPEG", 14, yPos, 25, 25);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Execut Negócios Imobiliários", 44, yPos + 10);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("Lista de Corretores", 44, yPos + 18);
        doc.setFontSize(10);
        doc.text(`Total: ${activeBrokers.length} corretores ativos`, 44, yPos + 25);
        yPos += 35;
      } else {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Execut Negócios Imobiliários", 14, yPos);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Lista de Corretores — ${activeBrokers.length} ativos`, 14, yPos + 8);
        yPos += 18;
      }

      // Table header
      doc.setDrawColor(200);
      doc.setFillColor(240, 240, 240);
      doc.rect(14, yPos, 182, 8, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("#", 18, yPos + 5.5);
      doc.text("Nome", 30, yPos + 5.5);
      doc.text("CRECI", 150, yPos + 5.5);
      yPos += 10;

      // Table rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      activeBrokers.forEach((broker, index) => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 15;
        }
        if (index % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(14, yPos - 4, 182, 7, "F");
        }
        doc.text(String(index + 1), 18, yPos);
        doc.text(broker.name, 30, yPos);
        doc.text(broker.creci || "—", 150, yPos);
        yPos += 7;
      });

      doc.save("corretores-ativos.pdf");
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  }, [brokers]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Corretores de Vendas</h1>
          <p className="text-muted-foreground">Gerencie os corretores do sistema de vendas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          {canEditVendas && (
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Corretor
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Corretores Cadastrados
              </CardTitle>
              <CardDescription>{brokers.length} corretores no sistema</CardDescription>
            </div>
            <TableSearch
              value={tableControls.searchTerm}
              onChange={tableControls.setSearchTerm}
              placeholder="Buscar corretor..."
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader
                        label="Nome"
                        field="name"
                        currentField={tableControls.sortField as string}
                        direction={tableControls.sortDirection}
                        onSort={() => tableControls.setSorting("name" as keyof SalesBroker)}
                      />
                    </TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Desativação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableControls.paginatedData.map((broker) => (
                    <TableRow key={broker.id}>
                      <TableCell className="font-medium">{broker.name}</TableCell>
                      <TableCell>
                        {broker.team_name ? (
                          <Badge variant="outline">{broker.team_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sem equipe</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={broker.broker_type === "venda" ? "default" : "secondary"}>
                          {broker.broker_type === "venda" ? "Venda" : "Locação"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={broker.is_active ? "default" : "secondary"}>
                          {broker.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {broker.deactivated_month ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(broker.deactivated_month + "-01"), "MMM/yyyy", { locale: ptBR })}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEditVendas && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(broker)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteBroker(broker)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {tableControls.paginatedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {tableControls.searchTerm ? "Nenhum corretor encontrado" : "Nenhum corretor cadastrado"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBroker ? "Editar Corretor" : "Novo Corretor"}</DialogTitle>
            <DialogDescription>
              {editingBroker
                ? "Altere os dados do corretor"
                : "Preencha os dados para criar um novo corretor"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Corretor</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: João Silva"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="creci">CRECI</Label>
              <Input
                id="creci"
                value={formData.creci || ""}
                onChange={(e) => setFormData({ ...formData, creci: formatCreci(e.target.value) })}
                placeholder="Ex: 12345-F"
              />
              <p className="text-xs text-muted-foreground">
                Número do CRECI. Usado para cruzar dados entre sistemas.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_exibicao">Nome para Exibição</Label>
              <Input
                id="nome_exibicao"
                value={formData.nome_exibicao || ""}
                onChange={(e) => setFormData({ ...formData, nome_exibicao: e.target.value || null })}
                placeholder="Ex: João, Marquinho, Zé"
              />
              <p className="text-xs text-muted-foreground">
                Nome curto usado nas tabelas e PDFs. Se não preenchido, usará Primeiro + Último nome.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">Equipe</Label>
              <Select
                value={formData.team_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, team_id: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem equipe</SelectItem>
                  {teams?.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Show cascade option when team changed during edit */}
              {editingBroker && formData.team_id !== originalTeamId && formData.team_id && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Atualizar vendas existentes para a nova equipe?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Selecione a partir de qual mês as vendas deste corretor devem ser migradas para a nova equipe.
                  </p>
                  <Select
                    value={updateSalesFrom || "none"}
                    onValueChange={(value) => setUpdateSalesFrom(value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Não atualizar vendas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não atualizar vendas</SelectItem>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          A partir de {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="broker_type">Tipo de Corretor</Label>
              <Select
                value={formData.broker_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, broker_type: value as "venda" | "locacao" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="locacao">Locação</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Corretores de locação não aparecem na página de avaliações C2S
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hire_date">Data de Entrada na Imobiliária</Label>
              <Input
                id="hire_date"
                type="date"
                value={formData.hire_date || ""}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value || null })}
              />
              <p className="text-xs text-muted-foreground">
                O corretor só aparecerá nas avaliações a partir desta data
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date || ""}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value || null })}
              />
              <p className="text-xs text-muted-foreground">
                Usado para exibir na página de aniversariantes
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_manager">Este corretor é Gerente</Label>
                <p className="text-xs text-muted-foreground">Gerentes não aparecem na página de avaliações</p>
              </div>
              <Switch
                id="is_manager"
                checked={formData.is_manager}
                onCheckedChange={(checked) => setFormData({ ...formData, is_manager: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Corretor Ativo</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {!formData.is_active && (
              <div className="space-y-2">
                <Label htmlFor="deactivated_month">Mês de Desativação</Label>
                <Select
                  value={formData.deactivated_month || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, deactivated_month: value || null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O corretor não aparecerá nos relatórios após este mês
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingBroker ? (
                "Salvar Alterações"
              ) : (
                "Criar Corretor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBroker} onOpenChange={() => setDeleteBroker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Corretor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o corretor <strong>{deleteBroker?.name}</strong>?
              <br /><br />
              <span className="text-muted-foreground">
                Nota: Se este corretor possuir vendas, propostas ou leads registrados, 
                a remoção será impedida. Neste caso, use a opção de desativar o corretor.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBroker && deleteMutation.mutate(deleteBroker.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesBrokers;
