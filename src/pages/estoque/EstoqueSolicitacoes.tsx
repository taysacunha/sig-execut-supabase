import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ClipboardList, Loader2, CheckCircle, Package, Truck, X, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { notificarGestoresUnidade, criarNotificacao } from "@/hooks/useEstoqueNotificacoes";

const fromEstoque = (table: string) => supabase.from(table as any);

interface Solicitacao {
  id: string;
  solicitante_user_id: string;
  solicitante_nome: string;
  unidade_id: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

interface SolicitacaoItem {
  id: string;
  solicitacao_id: string;
  material_id: string;
  quantidade_solicitada: number;
  quantidade_atendida: number;
  local_armazenamento_id: string | null;
  material_nome?: string;
}

interface Material {
  id: string;
  nome: string;
  unidade_medida: string;
}

interface Unidade {
  id: string;
  nome: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  separada: "Separada",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  aprovada: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  separada: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  entregue: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelada: "bg-red-500/20 text-red-400 border-red-500/30",
};

const NEXT_STATUS: Record<string, string> = {
  pendente: "aprovada",
  aprovada: "separada",
  separada: "entregue",
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  pendente: "Aprovar",
  aprovada: "Separar",
  separada: "Entregar",
};

export default function EstoqueSolicitacoes() {
  const queryClient = useQueryClient();
  const { canEdit, user } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<Solicitacao | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [unidadeId, setUnidadeId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<{ material_id: string; quantidade: number }[]>([{ material_id: "", quantidade: 1 }]);

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["estoque-solicitacoes"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_solicitacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Solicitacao[];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["estoque-materiais-ativos"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("id, nome, unidade_medida")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as unknown as Material[];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_unidades")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  const { data: viewItens = [] } = useQuery({
    queryKey: ["estoque-solicitacao-itens", viewDialog?.id],
    queryFn: async () => {
      if (!viewDialog?.id) return [];
      const { data, error } = await fromEstoque("estoque_solicitacao_itens")
        .select("*")
        .eq("solicitacao_id", viewDialog.id);
      if (error) throw error;
      return (data as unknown as SolicitacaoItem[]).map((item) => ({
        ...item,
        material_nome: materiais.find((m) => m.id === item.material_id)?.nome || "—",
      }));
    },
    enabled: !!viewDialog?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const validItens = itens.filter((i) => i.material_id && i.quantidade > 0);
      if (validItens.length === 0) throw new Error("Adicione ao menos um item");

      const userName = user.user_metadata?.name || user.email || "Usuário";

      const { data: sol, error: solError } = await fromEstoque("estoque_solicitacoes")
        .insert({
          solicitante_user_id: user.id,
          solicitante_nome: userName,
          unidade_id: unidadeId || null,
          observacoes: observacoes || null,
        } as any)
        .select("id")
        .single();
      if (solError) throw solError;

      const solId = (sol as any).id;
      const itensData = validItens.map((i) => ({
        solicitacao_id: solId,
        material_id: i.material_id,
        quantidade_solicitada: i.quantidade,
      }));

      const { error: itensError } = await fromEstoque("estoque_solicitacao_itens").insert(itensData as any);
      if (itensError) throw itensError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
      toast.success("Solicitação criada com sucesso!");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar solicitação"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await fromEstoque("estoque_solicitacoes")
        .update({ status: newStatus } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromEstoque("estoque_solicitacoes")
        .update({ status: "cancelada" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
      toast.success("Solicitação cancelada!");
    },
    onError: () => toast.error("Erro ao cancelar"),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setUnidadeId("");
    setObservacoes("");
    setItens([{ material_id: "", quantidade: 1 }]);
  };

  const addItem = () => setItens([...itens, { material_id: "", quantidade: 1 }]);
  const removeItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...itens];
    (updated[idx] as any)[field] = value;
    setItens(updated);
  };

  const filtered = solicitacoes.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (searchTerm && !s.solicitante_nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getUnidadeNome = (id: string | null) => unidades.find((u) => u.id === id)?.nome || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações</h1>
          <p className="text-muted-foreground">Gerencie solicitações de materiais</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Solicitação
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Buscar por solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="sm:max-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
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
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sol) => (
                  <TableRow key={sol.id}>
                    <TableCell className="font-medium">{sol.solicitante_nome}</TableCell>
                    <TableCell>{getUnidadeNome(sol.unidade_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[sol.status] || ""}>
                        {STATUS_LABELS[sol.status] || sol.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(sol.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewDialog(sol)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditEstoque && NEXT_STATUS[sol.status] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: sol.id, newStatus: NEXT_STATUS[sol.status] })}
                        >
                          {sol.status === "pendente" && <CheckCircle className="h-4 w-4 mr-1" />}
                          {sol.status === "aprovada" && <Package className="h-4 w-4 mr-1" />}
                          {sol.status === "separada" && <Truck className="h-4 w-4 mr-1" />}
                          {NEXT_STATUS_LABEL[sol.status]}
                        </Button>
                      )}
                      {sol.status !== "cancelada" && sol.status !== "entregue" && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelMutation.mutate(sol.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação</DialogTitle>
            <DialogDescription>Solicite materiais do estoque</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Unidade</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Motivo ou detalhes..." />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Itens</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Item
                </Button>
              </div>
              {itens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={item.material_id} onValueChange={(v) => updateItem(idx, "material_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Material..." /></SelectTrigger>
                      <SelectContent>
                        {materiais.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => updateItem(idx, "quantidade", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  {itens.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={(o) => !o && setViewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>Informações e itens da solicitação</DialogDescription>
          </DialogHeader>
          {viewDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Solicitante:</span> <strong>{viewDialog.solicitante_nome}</strong></div>
                <div><span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant="outline" className={STATUS_COLORS[viewDialog.status]}>{STATUS_LABELS[viewDialog.status]}</Badge>
                </div>
                <div><span className="text-muted-foreground">Unidade:</span> {getUnidadeNome(viewDialog.unidade_id)}</div>
                <div><span className="text-muted-foreground">Data:</span> {new Date(viewDialog.created_at).toLocaleDateString("pt-BR")}</div>
              </div>
              {viewDialog.observacoes && (
                <div className="text-sm"><span className="text-muted-foreground">Obs:</span> {viewDialog.observacoes}</div>
              )}
              <div>
                <Label className="text-sm">Itens</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qtd Solicitada</TableHead>
                      <TableHead className="text-right">Qtd Atendida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewItens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.material_nome}</TableCell>
                        <TableCell className="text-right">{item.quantidade_solicitada}</TableCell>
                        <TableCell className="text-right">{item.quantidade_atendida}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
