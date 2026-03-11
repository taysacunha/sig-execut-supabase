import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Mail, Calendar, Loader2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { TeamFilter } from "@/components/vendas/TeamFilter";
import { YearMonthSelector } from "@/components/vendas/YearMonthSelector";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination } from "@/components/vendas/TableControls";

interface BrokerLeadRow {
  broker_id: string;
  broker_name: string;
  team_id: string | null;
  team_name: string | null;
  lead_id: string | null;
  leads_received: number;
  leads_archived: number;
  leads_active: number;
  gimob_key_visits: number;
  scheduled_visits: number;
  builder_visits: number;
  last_visit_date: string;
  observations: string;
}

export default function Leads() {
  const queryClient = useQueryClient();
  const { user } = useUserRole();
  // ✅ USAR PERMISSÃO DE SISTEMA para controlar edição
  const { canEdit } = useSystemAccess();
  const canEditVendas = canEdit("vendas");
  
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [brokerRows, setBrokerRows] = useState<BrokerLeadRow[]>([]);
  const [savingBrokerId, setSavingBrokerId] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  const { data: existingLeads = [], isLoading } = useQuery({
    queryKey: ["monthly-leads", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase.from("monthly_leads").select("*");
      
      if (selectedMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", `${selectedYear}-${selectedMonth}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Build rows from brokers and existing leads
  useEffect(() => {
    const rows: BrokerLeadRow[] = brokers.map((broker: any) => {
      const brokerLeads = existingLeads.filter((l) => l.broker_id === broker.id);
      
      if (selectedMonth === null && brokerLeads.length > 0) {
        // ANO INTEIRO: somar todos os meses
        return {
          broker_id: broker.id,
          broker_name: broker.name,
          team_id: broker.team_id,
          team_name: broker.sales_teams?.name || null,
          lead_id: brokerLeads[0]?.id || null,
          leads_received: brokerLeads.reduce((sum, l) => sum + (l.leads_received || 0), 0),
          leads_archived: brokerLeads.reduce((sum, l) => sum + (l.leads_archived || 0), 0),
          leads_active: brokerLeads.reduce((sum, l) => sum + (l.leads_active || 0), 0),
          gimob_key_visits: brokerLeads.reduce((sum, l) => sum + (l.gimob_key_visits || 0), 0),
          scheduled_visits: brokerLeads.reduce((sum, l) => sum + (l.scheduled_visits || 0), 0),
          builder_visits: brokerLeads.reduce((sum, l) => sum + (l.builder_visits || 0), 0),
          last_visit_date: brokerLeads
            .map(l => l.last_visit_date)
            .filter(Boolean)
            .sort()
            .pop() || "",
          observations: "",
        };
      } else {
        // MÊS ESPECÍFICO: comportamento atual
        const existingLead = brokerLeads[0];
        return {
          broker_id: broker.id,
          broker_name: broker.name,
          team_id: broker.team_id,
          team_name: broker.sales_teams?.name || null,
          lead_id: existingLead?.id || null,
          leads_received: existingLead?.leads_received || 0,
          leads_archived: existingLead?.leads_archived || 0,
          leads_active: existingLead?.leads_active || 0,
          gimob_key_visits: existingLead?.gimob_key_visits || 0,
          scheduled_visits: existingLead?.scheduled_visits || 0,
          builder_visits: existingLead?.builder_visits || 0,
          last_visit_date: existingLead?.last_visit_date || "",
          observations: existingLead?.observations || "",
        };
      }
    });
    setBrokerRows(rows);
  }, [brokers, existingLeads, selectedMonth]);

  // Detect future months to block editing
  const currentYM = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const isFutureMonth = selectedMonth !== null && `${selectedYear}-${selectedMonth}` > currentYM;
  const isReadOnly = selectedMonth === null || isFutureMonth;

  // Get current yearMonth for saving (uses selected month, or current if full year view)
  const currentYearMonth = selectedMonth ? `${selectedYear}-${selectedMonth}` : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const saveMutation = useMutation({
    mutationFn: async (row: BrokerLeadRow) => {
      const totalVisits = row.gimob_key_visits + row.scheduled_visits + row.builder_visits;
      const payload = {
        broker_id: row.broker_id,
        year_month: currentYearMonth,
        leads_received: row.leads_received,
        leads_archived: row.leads_archived,
        leads_active: row.leads_active,
        gimob_key_visits: row.gimob_key_visits,
        scheduled_visits: row.scheduled_visits,
        builder_visits: row.builder_visits,
        last_visit_date: row.last_visit_date || null,
        observations: row.observations || null,
        average_leads: row.leads_received,
        average_visits: totalVisits,
        created_by: user?.id,
      };

      if (row.lead_id) {
        const { error } = await supabase
          .from("monthly_leads")
          .update(payload)
          .eq("id", row.lead_id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("monthly_leads").insert([payload]).select();
        if (error) throw error;
        // Update the lead_id in state
        if (data && data[0]) {
          setBrokerRows(prev => prev.map(r => 
            r.broker_id === row.broker_id ? { ...r, lead_id: data[0].id } : r
          ));
        }
      }
    },
    onSuccess: () => {
      setSavingBrokerId(null);
    },
    onError: () => {
      toast.error("Erro ao salvar dados");
      setSavingBrokerId(null);
    },
  });

  const debouncedSave = useCallback((row: BrokerLeadRow) => {
    if (debounceTimers.current[row.broker_id]) {
      clearTimeout(debounceTimers.current[row.broker_id]);
    }
    debounceTimers.current[row.broker_id] = setTimeout(() => {
      setSavingBrokerId(row.broker_id);
      saveMutation.mutate(row);
    }, 800);
  }, [saveMutation]);

  const updateRow = (brokerId: string, field: keyof BrokerLeadRow, value: any) => {
    setBrokerRows((prev) => {
      const newRows = prev.map((row) => {
        if (row.broker_id !== brokerId) return row;
        
        let updatedRow = { ...row, [field]: value };
        
        // Auto-calculation: recebidos - arquivados = ativos
        if (field === "leads_received" || field === "leads_archived") {
          const received = field === "leads_received" ? value : row.leads_received;
          const archived = field === "leads_archived" ? value : row.leads_archived;
          
          // Sempre calcular ativos quando recebidos e arquivados estão preenchidos
          if (received > 0 && archived >= 0) {
            updatedRow.leads_active = Math.max(0, received - archived);
          }
        }
        
        return updatedRow;
      });
      
      // Trigger debounced save
      const updatedRow = newRows.find(r => r.broker_id === brokerId);
      if (updatedRow) {
        debouncedSave(updatedRow);
      }
      
      return newRows;
    });
  };

  const getVisitStatusIcon = (lastVisitDate: string) => {
    if (!lastVisitDate) return <XCircle className="h-4 w-4 text-red-500" />;
    
    // Se "ano inteiro" estiver selecionado, usar dezembro como referência
    const refMonth = selectedMonth || "12";
    const refDate = new Date(`${selectedYear}-${refMonth}-01`);
    const visitDate = new Date(lastVisitDate + "T12:00:00");
    
    // Calcular diferença em meses
    const refMonthNum = refDate.getFullYear() * 12 + refDate.getMonth();
    const visitMonthNum = visitDate.getFullYear() * 12 + visitDate.getMonth();
    const monthsDiff = refMonthNum - visitMonthNum;
    
    // Verde: mês selecionado ou posterior (diff <= 0)
    if (monthsDiff <= 0) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    // Amarelo: 1 mês antes
    if (monthsDiff === 1) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    // Vermelho: 2+ meses antes
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const filteredRows = selectedTeam === "all"
    ? brokerRows
    : brokerRows.filter((r) => r.team_id === selectedTeam);

  const tableControls = useTableControls({
    data: filteredRows,
    searchField: "broker_name",
  });

  const totalLeadsReceived = filteredRows.reduce((acc, r) => acc + r.leads_received, 0);
  const totalLeadsActive = filteredRows.reduce((acc, r) => acc + r.leads_active, 0);
  const totalVisits = filteredRows.reduce(
    (acc, r) => acc + r.gimob_key_visits + r.scheduled_visits + r.builder_visits,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leads Mensais</h1>
          <p className="text-muted-foreground">
            {isFutureMonth 
              ? "Mês futuro — somente visualização"
              : "Preencha os dados de leads de todos os corretores"}
          </p>
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads Recebidos</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeadsReceived}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalLeadsActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Visitas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalVisits}</div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Leads por Corretor</CardTitle>
              {isReadOnly && (
                <p className="text-sm text-muted-foreground mt-1">
                  {isFutureMonth ? "Mês futuro — somente visualização" : "Selecione um mês específico para editar"}
                </p>
              )}
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
          ) : tableControls.paginatedData.length === 0 ? (
            <p className="text-muted-foreground">
              {tableControls.searchTerm
                ? "Nenhum corretor encontrado."
                : "Nenhum corretor ativo cadastrado."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Corretor</TableHead>
                      <TableHead className="min-w-[80px]">Equipe</TableHead>
                      <TableHead className="text-center w-[70px]">Receb.</TableHead>
                      <TableHead className="text-center w-[70px]">Arquiv.</TableHead>
                      <TableHead className="text-center w-[70px]">Ativos</TableHead>
                      <TableHead className="text-center w-[60px]">Gimob</TableHead>
                      <TableHead className="text-center w-[60px]">Agend.</TableHead>
                      <TableHead className="text-center w-[60px]">Constr.</TableHead>
                      <TableHead className="w-[140px]">Últ. Visita</TableHead>
                      <TableHead className="min-w-[150px]">Observações</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableControls.paginatedData.map((row) => (
                      <TableRow key={row.broker_id}>
                        <TableCell className="font-medium text-sm">{row.broker_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.team_name || "-"}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="w-14 h-8 flex items-center justify-center text-sm">{row.leads_received}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-14 h-8 text-center text-sm px-1"
                              value={row.leads_received || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "leads_received", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="w-14 h-8 flex items-center justify-center text-sm">{row.leads_archived}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-14 h-8 text-center text-sm px-1"
                              value={row.leads_archived || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "leads_archived", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="w-14 h-8 flex items-center justify-center text-sm">{row.leads_active}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-14 h-8 text-center text-sm px-1"
                              value={row.leads_active || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "leads_active", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="w-12 h-8 flex items-center justify-center text-sm">{row.gimob_key_visits}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-12 h-8 text-center text-sm px-1"
                              value={row.gimob_key_visits || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "gimob_key_visits", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="w-12 h-8 flex items-center justify-center text-sm">{row.scheduled_visits}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-12 h-8 text-center text-sm px-1"
                              value={row.scheduled_visits || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "scheduled_visits", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="w-12 h-8 flex items-center justify-center text-sm">{row.builder_visits}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-12 h-8 text-center text-sm px-1"
                              value={row.builder_visits || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "builder_visits", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          <div className="flex items-center gap-1 min-w-0">
                            {isReadOnly ? (
                              <span className="text-xs">{row.last_visit_date || "-"}</span>
                            ) : (
                              <Input
                                type="date"
                                className="w-28 min-w-0 h-8 text-xs px-1"
                                value={row.last_visit_date}
                                onChange={(e) =>
                                  updateRow(row.broker_id, "last_visit_date", e.target.value)
                                }
                              />
                            )}
                            {getVisitStatusIcon(row.last_visit_date)}
                          </div>
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="text-sm text-muted-foreground">-</span>
                          ) : (
                            <Textarea
                              className="min-h-[32px] h-8 text-sm resize-none"
                              placeholder="Obs..."
                              value={row.observations}
                              onChange={(e) =>
                                updateRow(row.broker_id, "observations", e.target.value)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {savingBrokerId === row.broker_id && selectedMonth !== null && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
    </div>
  );
}
