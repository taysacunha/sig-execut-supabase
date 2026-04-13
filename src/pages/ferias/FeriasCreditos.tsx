import { useState, useMemo } from "react";
import { normalizeText } from "@/lib/textUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, Search, Loader2, CheckCircle, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystemAccess } from "@/hooks/useSystemAccess";

const FeriasCreditos = () => {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditFerias = canEdit("ferias");
  
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog state for using/paying credit
  const [actionDialog, setActionDialog] = useState<{ credit: any; action: "utilizado" | "pago" } | null>(null);
  const [actionRef, setActionRef] = useState("");

  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ["ferias-creditos", filterTipo, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("ferias_folgas_creditos")
        .select("*, colaborador:ferias_colaboradores!ferias_folgas_creditos_colaborador_id_fkey(nome, nome_exibicao)")
        .order("created_at", { ascending: false });

      if (filterTipo !== "all") query = query.eq("tipo", filterTipo);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredCreditos = useMemo(() => {
    if (!searchTerm.trim()) return creditos;
    const term = normalizeText(searchTerm);
    return creditos.filter((c: any) =>
      normalizeText(c.colaborador?.nome || "").includes(term) ||
      normalizeText(c.colaborador?.nome_exibicao || "").includes(term)
    );
  }, [creditos, searchTerm]);

  const stats = useMemo(() => {
    const disponiveis = creditos.filter((c: any) => c.status === "disponivel");
    return {
      total: creditos.length,
      disponiveis: disponiveis.length,
      diasDisponiveis: disponiveis.reduce((sum: number, c: any) => sum + c.dias, 0),
      utilizados: creditos.filter((c: any) => c.status === "utilizado").length,
      pagos: creditos.filter((c: any) => c.status === "pago").length,
    };
  }, [creditos]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, referencia }: { id: string; status: string; referencia: string }) => {
      const { error } = await supabase
        .from("ferias_folgas_creditos")
        .update({
          status,
          utilizado_em: new Date().toISOString().split("T")[0],
          utilizado_referencia: referencia,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Crédito atualizado!");
      queryClient.invalidateQueries({ queryKey: ["ferias-creditos"] });
      setActionDialog(null);
      setActionRef("");
    },
    onError: () => toast.error("Erro ao atualizar crédito"),
  });

  const getDisplayName = (colab: any) => {
    if (!colab) return "—";
    return colab.nome_exibicao || colab.nome;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "disponivel":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300"><Clock className="h-3 w-3 mr-1" />Disponível</Badge>;
      case "utilizado":
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Utilizado</Badge>;
      case "pago":
        return <Badge variant="outline"><DollarSign className="h-3 w-3 mr-1" />Pago</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Créditos de Folga e Férias
        </h1>
        <p className="text-muted-foreground">
          Controle interno de créditos gerados por remoção de folgas ou redução de férias
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Créditos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
            <Clock className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.disponiveis}</div>
            <p className="text-xs text-muted-foreground">{stats.diasDisponiveis} dia(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilizados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.utilizados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pagos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="folga">Folga</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="utilizado">Utilizado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Créditos Registrados</CardTitle>
          <CardDescription>Lista completa de créditos de folga e férias</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCreditos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum crédito encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Colaborador</TableHead>
                  <TableHead className="font-semibold">Tipo</TableHead>
                  <TableHead className="font-semibold">Data Origem</TableHead>
                  <TableHead className="font-semibold">Dias</TableHead>
                  <TableHead className="font-semibold">Justificativa</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Utilizado em</TableHead>
                  {canEditFerias && <TableHead className="text-right font-semibold">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCreditos.map((credito: any, idx: number) => (
                  <TableRow key={credito.id} className={cn(idx % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                    <TableCell className="font-medium">{getDisplayName(credito.colaborador)}</TableCell>
                    <TableCell>
                      <Badge variant={credito.tipo === "folga" ? "secondary" : "outline"}>
                        {credito.tipo === "folga" ? "Folga" : "Férias"}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(credito.origem_data + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{credito.dias}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={credito.justificativa}>
                      {credito.justificativa}
                    </TableCell>
                    <TableCell>{statusBadge(credito.status)}</TableCell>
                    <TableCell>
                      {credito.utilizado_em ? (
                        <div>
                          <div>{format(new Date(credito.utilizado_em + "T12:00:00"), "dd/MM/yyyy")}</div>
                          {credito.utilizado_referencia && (
                            <div className="text-xs text-muted-foreground">{credito.utilizado_referencia}</div>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    {canEditFerias && (
                      <TableCell className="text-right space-x-1">
                        {credito.status === "disponivel" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActionDialog({ credit: credito, action: "utilizado" })}
                            >
                              Usar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActionDialog({ credit: credito, action: "pago" })}
                            >
                              Pagar
                            </Button>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionRef(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "utilizado" ? "Marcar como Utilizado" : "Marcar como Pago"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "utilizado"
                ? "Informe onde este crédito foi utilizado (ex: Folga 07/03/2026, Férias Q1 2026)"
                : "Confirme o pagamento deste crédito"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Referência</Label>
              <Textarea
                value={actionRef}
                onChange={(e) => setActionRef(e.target.value)}
                placeholder={actionDialog?.action === "utilizado" ? "Ex: Folga extra em 07/03/2026" : "Ex: Pago na folha de fevereiro/2026"}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setActionRef(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => actionDialog && updateMutation.mutate({
                id: actionDialog.credit.id,
                status: actionDialog.action,
                referencia: actionRef,
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeriasCreditos;
