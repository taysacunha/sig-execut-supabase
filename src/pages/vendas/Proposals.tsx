import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { FileText, CheckCircle, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { TeamFilter } from "@/components/vendas/TeamFilter";
import { YearMonthSelector } from "@/components/vendas/YearMonthSelector";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination } from "@/components/vendas/TableControls";

interface BrokerProposalRow {
  broker_id: string;
  broker_name: string;
  team_id: string | null;
  team_name: string | null;
  proposal_id: string | null;
  proposals_count: number;
  proposals_converted: number;
}

export default function Proposals() {
  const queryClient = useQueryClient();
  const { user } = useUserRole();
  // ✅ USAR PERMISSÃO DE SISTEMA para controlar edição
  const { canEdit } = useSystemAccess();
  const canEditVendas = canEdit("vendas");
  
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [brokerRows, setBrokerRows] = useState<BrokerProposalRow[]>([]);
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

  const yearMonth = selectedMonth ? `${selectedYear}-${selectedMonth}` : null;
  
  const { data: existingProposals = [], isLoading } = useQuery({
    queryKey: ["broker-monthly-proposals", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase.from("broker_monthly_proposals").select("*");
      
      if (yearMonth === null) {
        query = query.like("year_month", `${selectedYear}-%`);
      } else {
        query = query.eq("year_month", yearMonth);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0, // Always refetch when queryKey changes
  });

  // Build rows from brokers and existing proposals
  // When viewing full year, aggregate all months per broker
  useEffect(() => {
    const rows: BrokerProposalRow[] = brokers.map((broker: any) => {
      // For full year, sum all proposals for this broker; for single month, find the one record
      const brokerProposals = existingProposals.filter((p) => p.broker_id === broker.id);
      const proposalsCount = brokerProposals.reduce((sum, p) => sum + (p.proposals_count || 0), 0);
      const proposalsConverted = brokerProposals.reduce((sum, p) => sum + (p.proposals_converted || 0), 0);
      const proposalId = selectedMonth !== null && brokerProposals.length === 1 ? brokerProposals[0].id : null;
      
      return {
        broker_id: broker.id,
        broker_name: broker.name,
        team_id: broker.team_id,
        team_name: broker.sales_teams?.name || null,
        proposal_id: proposalId,
        proposals_count: proposalsCount,
        proposals_converted: proposalsConverted,
      };
    });
    setBrokerRows(rows);
  }, [brokers, existingProposals, selectedMonth]);

  // Detect future months to block editing
  const currentYM = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const isFutureMonth = selectedMonth !== null && `${selectedYear}-${selectedMonth}` > currentYM;
  const isReadOnly = selectedMonth === null || isFutureMonth;

  // Get current yearMonth for saving (uses selected month, or current if full year view)
  const currentYearMonth = yearMonth ?? `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const saveMutation = useMutation({
    mutationFn: async (row: BrokerProposalRow) => {
      if (!user?.id) {
        throw new Error("Usuário não autenticado");
      }
      
      if (row.proposal_id) {
        // Update - não incluir created_by no update
        const { error } = await supabase
          .from("broker_monthly_proposals")
          .update({
            proposals_count: row.proposals_count,
            proposals_converted: row.proposals_converted,
          })
          .eq("id", row.proposal_id);
        if (error) throw error;
      } else {
        // Insert - incluir created_by
        const { data, error } = await supabase
          .from("broker_monthly_proposals")
          .insert([{
            broker_id: row.broker_id,
            year_month: currentYearMonth,
            proposals_count: row.proposals_count,
            proposals_converted: row.proposals_converted,
            created_by: user.id,
          }])
          .select();
        if (error) throw error;
        // Update the proposal_id in state
        if (data && data[0]) {
          setBrokerRows(prev => prev.map(r => 
            r.broker_id === row.broker_id ? { ...r, proposal_id: data[0].id } : r
          ));
        }
      }
    },
    onSuccess: () => {
      setSavingBrokerId(null);
      queryClient.invalidateQueries({ queryKey: ["broker-monthly-proposals", selectedYear, selectedMonth] });
    },
    onError: (error: any) => {
      console.error("Save error:", error);
      toast.error("Erro ao salvar dados");
      setSavingBrokerId(null);
    },
  });

  const debouncedSave = useCallback((row: BrokerProposalRow) => {
    if (debounceTimers.current[row.broker_id]) {
      clearTimeout(debounceTimers.current[row.broker_id]);
    }
    debounceTimers.current[row.broker_id] = setTimeout(() => {
      setSavingBrokerId(row.broker_id);
      saveMutation.mutate(row);
    }, 800);
  }, [saveMutation]);

  const updateRow = (brokerId: string, field: keyof BrokerProposalRow, value: any) => {
    setBrokerRows((prev) => {
      const newRows = prev.map((row) => {
        if (row.broker_id !== brokerId) return row;
        return { ...row, [field]: value };
      });
      
      // Trigger debounced save
      const updatedRow = newRows.find(r => r.broker_id === brokerId);
      if (updatedRow) {
        debouncedSave(updatedRow);
      }
      
      return newRows;
    });
  };

  const filteredRows = selectedTeam === "all"
    ? brokerRows
    : brokerRows.filter((r) => r.team_id === selectedTeam);

  const tableControls = useTableControls({
    data: filteredRows,
    searchField: "broker_name",
  });

  const totalProposals = filteredRows.reduce((acc, r) => acc + r.proposals_count, 0);
  const totalConverted = filteredRows.reduce((acc, r) => acc + r.proposals_converted, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Propostas</h1>
          <p className="text-muted-foreground">
            {selectedMonth === null 
              ? "Visualização consolidada do ano (selecione um mês para editar)"
              : isFutureMonth
                ? "Mês futuro — somente visualização"
                : "Preencha as propostas mensais de todos os corretores"}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Propostas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProposals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Convertidas em Vendas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalConverted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Proposals Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Propostas por Corretor</CardTitle>
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
                      <TableHead className="min-w-[150px]">Corretor</TableHead>
                      <TableHead className="min-w-[100px]">Equipe</TableHead>
                      <TableHead className="text-center w-[120px]">Propostas</TableHead>
                      <TableHead className="text-center w-[120px]">Convertidas</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableControls.paginatedData.map((row) => (
                      <TableRow key={row.broker_id}>
                        <TableCell className="font-medium">{row.broker_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.team_name || "-"}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="text-sm font-medium text-center block">{row.proposals_count}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-20 h-8 text-center mx-auto"
                              value={row.proposals_count || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "proposals_count", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {isReadOnly ? (
                            <span className="text-sm font-medium text-center block text-green-600">{row.proposals_converted}</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="w-20 h-8 text-center mx-auto"
                              value={row.proposals_converted || ""}
                              onChange={(e) =>
                                updateRow(row.broker_id, "proposals_converted", parseInt(e.target.value) || 0)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {savingBrokerId === row.broker_id && (
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
