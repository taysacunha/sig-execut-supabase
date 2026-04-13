import { useState, useMemo } from "react";
import { getYearOptions } from "@/lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Search, FileText, Loader2, Edit, Eye, CheckCircle2, 
  XCircle, Clock, AlertTriangle, Filter, Download
} from "lucide-react";
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
import { toast } from "sonner";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { FormularioAnualDialog } from "@/components/ferias/formulario/FormularioAnualDialog";
import { FormularioAnualViewDialog } from "@/components/ferias/formulario/FormularioAnualViewDialog";

interface FormularioAnual {
  id: string;
  colaborador_id: string;
  ano_referencia: number;
  periodo1_mes: number | null;
  periodo1_quinzena: string | null;
  periodo2_mes: number | null;
  periodo2_quinzena: string | null;
  periodo3_mes: number | null;
  periodo3_quinzena: string | null;
  periodo_preferencia: number | null;
  vender_dias: boolean | null;
  dias_vender: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  colaborador?: {
    id: string;
    nome: string;
    setor_titular?: {
      id: string;
      nome: string;
    } | null;
  } | null;
}

interface Setor {
  id: string;
  nome: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { 
    label: "Pendente", 
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: <Clock className="h-3 w-3" />
  },
  aprovado: { 
    label: "Aprovado", 
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />
  },
  rejeitado: { 
    label: "Rejeitado", 
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: <XCircle className="h-3 w-3" />
  },
  em_analise: { 
    label: "Em Análise", 
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: <AlertTriangle className="h-3 w-3" />
  },
};

export default function FeriasFormularioAnual() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const { hasAccess: hasRoleAccess } = useUserRole();
  const canEditFerias = canEdit("ferias");
  const isAdmin = hasRoleAccess(["super_admin", "admin", "manager"]);

  const currentYear = new Date().getFullYear();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [setorFilter, setSetorFilter] = useState<string>("all");
  const [anoFilter, setAnoFilter] = useState<string>((currentYear + 1).toString());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedFormulario, setSelectedFormulario] = useState<FormularioAnual | null>(null);

  // Fetch formulários
  const { data: formularios = [], isLoading } = useQuery({
    queryKey: ["ferias-formularios", anoFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_formulario_anual")
        .select(`
          *,
          colaborador:ferias_colaboradores!colaborador_id (
            id, nome,
            setor_titular:ferias_setores!setor_titular_id (id, nome)
          )
        `)
        .eq("ano_referencia", parseInt(anoFilter))
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FormularioAnual[];
    },
  });

  // Fetch setores
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-formulario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");

      if (error) throw error;
      return data as Setor[];
    },
  });

  // Mutation para aprovar/rejeitar
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("ferias_formulario_anual")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["ferias-formularios"] });
      toast.success(`Formulário ${status === "aprovado" ? "aprovado" : "rejeitado"} com sucesso!`);
    },
    onError: () => {
      toast.error("Erro ao atualizar status do formulário");
    },
  });

  // Filtered data
  const filteredFormularios = useMemo(() => {
    return formularios.filter((f) => {
      const matchesSearch = normalizeText(f.colaborador?.nome || "").includes(normalizeText(searchTerm));
      const matchesStatus = statusFilter === "all" || f.status === statusFilter;
      const matchesSetor = setorFilter === "all" || f.colaborador?.setor_titular?.id === setorFilter;
      return matchesSearch && matchesStatus && matchesSetor;
    });
  }, [formularios, searchTerm, statusFilter, setorFilter]);

  const handleNew = () => {
    setSelectedFormulario(null);
    setDialogOpen(true);
  };

  const handleEdit = (formulario: FormularioAnual) => {
    setSelectedFormulario(formulario);
    setDialogOpen(true);
  };

  const handleView = (formulario: FormularioAnual) => {
    setSelectedFormulario(formulario);
    setViewDialogOpen(true);
  };

  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({ id, status: "aprovado" });
  };

  const handleReject = (id: string) => {
    updateStatusMutation.mutate({ id, status: "rejeitado" });
  };

  const formatPeriodo = (mes: number | null, quinzena: string | null) => {
    if (mes === null || !quinzena) return "—";
    return `${quinzena === "1" ? "1ª" : "2ª"} quinz. ${MONTHS[mes - 1]}`;
  };

  // Stats
  const stats = useMemo(() => ({
    total: filteredFormularios.length,
    pendentes: filteredFormularios.filter(f => f.status === "pendente").length,
    aprovados: filteredFormularios.filter(f => f.status === "aprovado").length,
    rejeitados: filteredFormularios.filter(f => f.status === "rejeitado").length,
  }), [filteredFormularios]);

  // Year options
  const years = getYearOptions(1, 3).map(String);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Formulário Anual
          </h1>
          <p className="text-muted-foreground">
            Preferências de férias para o ano de {anoFilter}
          </p>
        </div>
        {canEditFerias && (
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Formulário
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Aprovados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.aprovados}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejeitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.rejeitados}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={anoFilter} onValueChange={setAnoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(statusConfig).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.id}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredFormularios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum formulário encontrado</p>
              <p className="text-sm">Clique em "Novo Formulário" para criar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>1ª Opção</TableHead>
                    <TableHead>2ª Opção</TableHead>
                    <TableHead>3ª Opção</TableHead>
                    <TableHead>Preferido</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFormularios.map((f) => {
                    const status = statusConfig[f.status || "pendente"];
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          {f.colaborador?.nome || "—"}
                        </TableCell>
                        <TableCell>
                          {f.colaborador?.setor_titular?.nome || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatPeriodo(f.periodo1_mes, f.periodo1_quinzena)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatPeriodo(f.periodo2_mes, f.periodo2_quinzena)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatPeriodo(f.periodo3_mes, f.periodo3_quinzena)}
                        </TableCell>
                        <TableCell>
                          {f.periodo_preferencia ? (
                            <Badge variant="secondary" className="text-xs">
                              {f.periodo_preferencia}ª opção
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {f.vender_dias && f.dias_vender ? (
                            <Badge variant="outline" className="text-xs">
                              {f.dias_vender} dias
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${status.color} gap-1`}>
                            {status.icon}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleView(f)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEditFerias && f.status === "pendente" && (
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(f)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && f.status === "pendente" && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleApprove(f.id)}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleReject(f.id)}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <FormularioAnualDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        formulario={selectedFormulario}
        anoReferencia={parseInt(anoFilter)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["ferias-formularios"] });
          setDialogOpen(false);
        }}
      />

      <FormularioAnualViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        formulario={selectedFormulario}
      />
    </div>
  );
}
