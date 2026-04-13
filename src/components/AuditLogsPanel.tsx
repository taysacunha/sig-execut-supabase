import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, History, User, Shield, ChevronDown, ChevronUp, Filter, RefreshCw } from "lucide-react";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminAuditLog {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_name: string | null;
  target_id: string;
  target_email: string;
  target_name: string | null;
  action: string;
  details: unknown;
  created_at: string;
}

interface ModuleAuditLog {
  id: string;
  module_name: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: unknown;
  new_data: unknown;
  changed_fields: string[] | null;
  changed_by: string;
  changed_by_email: string;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  deactivate: "Desativar usuário",
  reactivate: "Reativar usuário",
  delete: "Remover usuário",
  update_email: "Alterar email",
  update_password: "Alterar senha",
  INSERT: "Inserir",
  UPDATE: "Atualizar",
  DELETE: "Remover",
};

const actionColors: Record<string, string> = {
  deactivate: "bg-amber-500 text-white",
  reactivate: "bg-green-500 text-white",
  delete: "bg-destructive text-destructive-foreground",
  update_email: "bg-blue-500 text-white",
  update_password: "bg-purple-500 text-white",
  INSERT: "bg-green-500 text-white",
  UPDATE: "bg-blue-500 text-white",
  DELETE: "bg-destructive text-destructive-foreground",
};

const moduleLabels: Record<string, string> = {
  escalas: "Escalas",
  vendas: "Vendas",
  estoque: "Estoques",
  sistema: "Sistema",
};

const tableLabels: Record<string, string> = {
  brokers: "Corretores",
  locations: "Locais",
  schedule_assignments: "Alocações",
  generated_schedules: "Escalas",
  sales: "Vendas",
  sales_brokers: "Corretores de Vendas",
  sales_teams: "Equipes",
  broker_evaluations: "Avaliações",
  monthly_leads: "Leads",
  proposals: "Propostas",
  user_roles: "Permissões",
  system_access: "Acessos ao Sistema",
  estoque_materiais: "Materiais",
  estoque_locais_armazenamento: "Locais de Armazenamento",
  estoque_saldos: "Saldos",
  estoque_gestores: "Gestores",
  estoque_solicitacoes: "Solicitações",
  estoque_solicitacao_itens: "Itens de Solicitação",
  estoque_movimentacoes: "Movimentações",
  estoque_notificacoes: "Notificações",
};

interface AuditLogsPanelProps {
  defaultModule?: "escalas" | "vendas" | "estoque" | "ferias" | "sistema" | "all";
  defaultTab?: "admin" | "modules";
  showAdminTab?: boolean;
}

export function AuditLogsPanel({ defaultModule = "all", defaultTab = "admin", showAdminTab = true }: AuditLogsPanelProps) {
  const [adminLogs, setAdminLogs] = useState<AdminAuditLog[]>([]);
  const [moduleLogs, setModuleLogs] = useState<ModuleAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters
  const [adminActionFilter, setAdminActionFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>(defaultModule);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [adminSearchTerm, setAdminSearchTerm] = useState("");
  const [moduleSearchTerm, setModuleSearchTerm] = useState("");

  // Pagination for admin logs
  const [adminPage, setAdminPage] = useState(1);
  const [adminItemsPerPage, setAdminItemsPerPage] = useState(20);

  // Pagination for module logs
  const [modulePage, setModulePage] = useState(1);
  const [moduleItemsPerPage, setModuleItemsPerPage] = useState(20);

  // Sorting for admin logs
  const [adminSortField, setAdminSortField] = useState<keyof AdminAuditLog | null>("created_at");
  const [adminSortDirection, setAdminSortDirection] = useState<"asc" | "desc">("desc");

  // Sorting for module logs
  const [moduleSortField, setModuleSortField] = useState<keyof ModuleAuditLog | null>("created_at");
  const [moduleSortDirection, setModuleSortDirection] = useState<"asc" | "desc">("desc");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch admin audit logs
      const { data: adminData, error: adminError } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      
      if (adminError) throw adminError;
      setAdminLogs(adminData || []);

      // Fetch module audit logs
      const { data: moduleData, error: moduleError } = await supabase
        .from("module_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      
      if (moduleError) throw moduleError;
      setModuleLogs(moduleData || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered and sorted admin logs
  const filteredAdminLogs = useMemo(() => {
    let result = adminLogs.filter(log => {
      if (adminActionFilter !== "all" && log.action !== adminActionFilter) return false;
      if (adminSearchTerm) {
        const term = adminSearchTerm.toLowerCase();
        return (
          log.actor_email?.toLowerCase().includes(term) ||
          log.actor_name?.toLowerCase().includes(term) ||
          log.target_email?.toLowerCase().includes(term) ||
          log.target_name?.toLowerCase().includes(term)
        );
      }
      return true;
    });

    // Sort
    if (adminSortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[adminSortField];
        const bVal = b[adminSortField];
        
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        if (typeof aVal === "string" && typeof bVal === "string") {
          return adminSortDirection === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        return 0;
      });
    }

    return result;
  }, [adminLogs, adminActionFilter, adminSearchTerm, adminSortField, adminSortDirection]);

  // Filtered and sorted module logs
  const filteredModuleLogs = useMemo(() => {
    let result = moduleLogs.filter(log => {
      if (moduleFilter !== "all" && log.module_name !== moduleFilter) return false;
      if (tableFilter !== "all" && log.table_name !== tableFilter) return false;
      if (moduleSearchTerm) {
        const term = moduleSearchTerm.toLowerCase();
        return (
          log.changed_by_email?.toLowerCase().includes(term) ||
          log.table_name?.toLowerCase().includes(term)
        );
      }
      return true;
    });

    // Sort
    if (moduleSortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[moduleSortField];
        const bVal = b[moduleSortField];
        
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        if (typeof aVal === "string" && typeof bVal === "string") {
          return moduleSortDirection === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        return 0;
      });
    }

    return result;
  }, [moduleLogs, moduleFilter, tableFilter, moduleSearchTerm, moduleSortField, moduleSortDirection]);

  // Paginated data
  const adminTotalPages = Math.ceil(filteredAdminLogs.length / adminItemsPerPage);
  const paginatedAdminLogs = useMemo(() => {
    const start = (adminPage - 1) * adminItemsPerPage;
    return filteredAdminLogs.slice(start, start + adminItemsPerPage);
  }, [filteredAdminLogs, adminPage, adminItemsPerPage]);

  const moduleTotalPages = Math.ceil(filteredModuleLogs.length / moduleItemsPerPage);
  const paginatedModuleLogs = useMemo(() => {
    const start = (modulePage - 1) * moduleItemsPerPage;
    return filteredModuleLogs.slice(start, start + moduleItemsPerPage);
  }, [filteredModuleLogs, modulePage, moduleItemsPerPage]);

  const uniqueTables = [...new Set(moduleLogs.map(l => l.table_name))];

  const handleAdminSort = (field: keyof AdminAuditLog) => {
    if (adminSortField === field) {
      setAdminSortDirection(adminSortDirection === "asc" ? "desc" : "asc");
    } else {
      setAdminSortField(field);
      setAdminSortDirection("desc");
    }
  };

  const handleModuleSort = (field: keyof ModuleAuditLog) => {
    if (moduleSortField === field) {
      setModuleSortDirection(moduleSortDirection === "asc" ? "desc" : "asc");
    } else {
      setModuleSortField(field);
      setModuleSortDirection("desc");
    }
  };

  // Reset pagination when filters change
  const handleAdminSearchChange = (value: string) => {
    setAdminSearchTerm(value);
    setAdminPage(1);
  };

  const handleModuleSearchChange = (value: string) => {
    setModuleSearchTerm(value);
    setModulePage(1);
  };

  const handleAdminFilterChange = (value: string) => {
    setAdminActionFilter(value);
    setAdminPage(1);
  };

  const handleModuleFilterChange = (value: string) => {
    setModuleFilter(value);
    setModulePage(1);
  };

  const handleTableFilterChange = (value: string) => {
    setTableFilter(value);
    setModulePage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Logs de Auditoria
            </CardTitle>
            <CardDescription>Histórico de ações administrativas e alterações nos módulos</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAdminTab ? (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Ações Administrativas
              </TabsTrigger>
              <TabsTrigger value="modules" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Alterações nos Módulos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin" className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={adminActionFilter} onValueChange={handleAdminFilterChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    <SelectItem value="deactivate">Desativar</SelectItem>
                    <SelectItem value="reactivate">Reativar</SelectItem>
                    <SelectItem value="delete">Remover</SelectItem>
                    <SelectItem value="update_email">Alterar email</SelectItem>
                    <SelectItem value="update_password">Alterar senha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TableSearch
                value={adminSearchTerm}
                onChange={handleAdminSearchChange}
                placeholder="Buscar por nome ou email..."
              />
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Data/Hora"
                        field="created_at"
                        currentField={adminSortField}
                        direction={adminSortDirection}
                        onSort={handleAdminSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Ator"
                        field="actor_name"
                        currentField={adminSortField}
                        direction={adminSortDirection}
                        onSort={handleAdminSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Ação"
                        field="action"
                        currentField={adminSortField}
                        direction={adminSortDirection}
                        onSort={handleAdminSort}
                      />
                    </TableHead>
                    <TableHead>Alvo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAdminLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAdminLogs.map((log) => (
                      <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(log.id)}>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  {expandedRows.has(log.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{log.actor_name || "—"}</span>
                                <span className="text-xs text-muted-foreground">{log.actor_email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={actionColors[log.action] || "bg-secondary"}>
                                {actionLabels[log.action] || log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{log.target_name || "—"}</span>
                                <span className="text-xs text-muted-foreground">{log.target_email}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={5} className="py-3">
                                <div className="text-sm">
                                  <strong>Detalhes:</strong>
                                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <TablePagination
              currentPage={adminPage}
              totalPages={adminTotalPages}
              itemsPerPage={adminItemsPerPage}
              onPageChange={setAdminPage}
              onItemsPerPageChange={(n) => { setAdminItemsPerPage(n); setAdminPage(1); }}
              totalItems={filteredAdminLogs.length}
            />
          </TabsContent>

          <TabsContent value="modules" className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={moduleFilter} onValueChange={handleModuleFilterChange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="escalas">Escalas</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="ferias">Férias e Folgas</SelectItem>
                    <SelectItem value="sistema">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={tableFilter} onValueChange={handleTableFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueTables.map(t => (
                    <SelectItem key={t} value={t}>{tableLabels[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TableSearch
                value={moduleSearchTerm}
                onChange={handleModuleSearchChange}
                placeholder="Buscar..."
              />
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Data/Hora"
                        field="created_at"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Módulo"
                        field="module_name"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Tabela"
                        field="table_name"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Ação"
                        field="action"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Campos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedModuleLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedModuleLogs.map((log) => (
                      <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(log.id)}>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  {expandedRows.has(log.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{moduleLabels[log.module_name] || log.module_name}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{tableLabels[log.table_name] || log.table_name}</TableCell>
                            <TableCell>
                              <Badge className={actionColors[log.action] || "bg-secondary"}>
                                {actionLabels[log.action] || log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{log.changed_by_email || "Sistema"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                              {log.changed_fields?.join(", ") || "—"}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={7} className="py-3">
                                <div className="space-y-3 text-sm">
                                  {log.changed_fields && log.changed_fields.length > 0 && (
                                    <div>
                                      <strong className="text-foreground">Campos alterados:</strong>
                                      <div className="mt-2 space-y-2">
                                        {log.changed_fields.map((field) => {
                                          const oldVal = log.old_data ? (log.old_data as Record<string, unknown>)[field] : undefined;
                                          const newVal = log.new_data ? (log.new_data as Record<string, unknown>)[field] : undefined;
                                          return (
                                            <div key={field} className="flex items-start gap-2 p-2 bg-muted rounded">
                                              <span className="font-medium min-w-[120px]">{field}:</span>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {oldVal !== undefined && (
                                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs line-through">
                                                    {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                                                  </span>
                                                )}
                                                <span className="text-muted-foreground">→</span>
                                                {newVal !== undefined && (
                                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                                                    {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {log.action === 'INSERT' && log.new_data && (
                                    <div>
                                      <strong className="text-green-600 dark:text-green-400">Novo registro:</strong>
                                      <pre className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs overflow-x-auto max-h-40">
                                        {JSON.stringify(log.new_data, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {log.action === 'DELETE' && log.old_data && (
                                    <div>
                                      <strong className="text-red-600 dark:text-red-400">Registro removido:</strong>
                                      <pre className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs overflow-x-auto max-h-40">
                                        {JSON.stringify(log.old_data, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <TablePagination
              currentPage={modulePage}
              totalPages={moduleTotalPages}
              itemsPerPage={moduleItemsPerPage}
              onPageChange={setModulePage}
              onItemsPerPageChange={(n) => { setModuleItemsPerPage(n); setModulePage(1); }}
              totalItems={filteredModuleLogs.length}
            />
          </TabsContent>
        </Tabs>
        ) : (
          /* Renderização apenas da aba de módulos quando showAdminTab=false */
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={moduleFilter} onValueChange={handleModuleFilterChange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="escalas">Escalas</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="ferias">Férias e Folgas</SelectItem>
                    <SelectItem value="sistema">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={tableFilter} onValueChange={handleTableFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueTables.map(t => (
                    <SelectItem key={t} value={t}>{tableLabels[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TableSearch
                value={moduleSearchTerm}
                onChange={handleModuleSearchChange}
                placeholder="Buscar..."
              />
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Data/Hora"
                        field="created_at"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Módulo"
                        field="module_name"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Tabela"
                        field="table_name"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Ação"
                        field="action"
                        currentField={moduleSortField}
                        direction={moduleSortDirection}
                        onSort={handleModuleSort}
                      />
                    </TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Campos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedModuleLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedModuleLogs.map((log) => (
                      <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(log.id)}>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  {expandedRows.has(log.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{moduleLabels[log.module_name] || log.module_name}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{tableLabels[log.table_name] || log.table_name}</TableCell>
                            <TableCell>
                              <Badge className={actionColors[log.action] || "bg-secondary"}>
                                {actionLabels[log.action] || log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{log.changed_by_email || "Sistema"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                              {log.changed_fields?.join(", ") || "—"}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={7} className="py-3">
                                <div className="space-y-3 text-sm">
                                  {log.changed_fields && log.changed_fields.length > 0 && (
                                    <div>
                                      <strong className="text-foreground">Campos alterados:</strong>
                                      <div className="mt-2 space-y-2">
                                        {log.changed_fields.map((field) => {
                                          const oldVal = log.old_data ? (log.old_data as Record<string, unknown>)[field] : undefined;
                                          const newVal = log.new_data ? (log.new_data as Record<string, unknown>)[field] : undefined;
                                          return (
                                            <div key={field} className="flex items-start gap-2 p-2 bg-muted rounded">
                                              <span className="font-medium min-w-[120px]">{field}:</span>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {oldVal !== undefined && (
                                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs line-through">
                                                    {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                                                  </span>
                                                )}
                                                <span className="text-muted-foreground">→</span>
                                                {newVal !== undefined && (
                                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                                                    {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {log.action === 'INSERT' && log.new_data && (
                                    <div>
                                      <strong className="text-green-600 dark:text-green-400">Novo registro:</strong>
                                      <pre className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs overflow-x-auto max-h-40">
                                        {JSON.stringify(log.new_data, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {log.action === 'DELETE' && log.old_data && (
                                    <div>
                                      <strong className="text-red-600 dark:text-red-400">Registro removido:</strong>
                                      <pre className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs overflow-x-auto max-h-40">
                                        {JSON.stringify(log.old_data, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <TablePagination
              currentPage={modulePage}
              totalPages={moduleTotalPages}
              itemsPerPage={moduleItemsPerPage}
              onPageChange={setModulePage}
              onItemsPerPageChange={(n) => { setModuleItemsPerPage(n); setModulePage(1); }}
              totalItems={filteredModuleLogs.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
