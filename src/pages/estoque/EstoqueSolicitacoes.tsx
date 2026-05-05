import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ClipboardList, Loader2, CheckCircle, Package, Truck, X, Eye, PackageCheck, HandHeart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { notificarGestoresUnidade, criarNotificacao } from "@/hooks/useEstoqueNotificacoes";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { useUsuarioUnidades } from "@/hooks/useUsuarioUnidades";

const fromEstoque = (table: string) => supabase.from(table as any);

interface Solicitacao {
  id: string;
  solicitante_user_id: string;
  solicitante_nome: string;
  unidade_id: string | null;
  setor_id: string | null;
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
  const { unidadesPermitidas, getSetorParaUnidade } = useUsuarioUnidades();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<Solicitacao | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Separação dialog state
  const [separarSol, setSepararSol] = useState<Solicitacao | null>(null);
  const [separarItens, setSepararItens] = useState<Array<{
    id: string;
    material_id: string;
    material_nome: string;
    material_unidade: string;
    quantidade_solicitada: number;
    quantidade_atendida: number;
    local_armazenamento_id: string;
    saldosDisponiveis: Array<{ local_id: string; local_nome: string; quantidade: number }>;
  }>>([]);

  // Cancel + receipt confirmation alert state
  const [cancelConfirm, setCancelConfirm] = useState<Solicitacao | null>(null);
  const [receiptConfirm, setReceiptConfirm] = useState<Solicitacao | null>(null);

  // Form state
  const [unidadeId, setUnidadeId] = useState("");
  const [setorId, setSetorId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<{ material_id: string; quantidade: number }[]>([{ material_id: "", quantidade: 1 }]);

  // Auto-fill unit if user has only one
  useEffect(() => {
    if (unidadesPermitidas.length === 1 && !unidadeId) {
      const uid = unidadesPermitidas[0].id;
      setUnidadeId(uid);
      const setor = getSetorParaUnidade(uid);
      if (setor.setor_id) setSetorId(setor.setor_id);
    }
  }, [unidadesPermitidas, unidadeId]);

  // Clear items when unit changes
  const handleUnidadeChange = (newUnidadeId: string) => {
    setUnidadeId(newUnidadeId);
    setItens([{ material_id: "", quantidade: 1 }]);
    // Auto-fill setor from user's vinculo
    const setor = getSetorParaUnidade(newUnidadeId);
    setSetorId(setor.setor_id || "");
  };

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

  // Fetch materials available in the selected unit (have stock > 0)
  const { data: materiaisDisponiveis = [] } = useQuery({
    queryKey: ["estoque-materiais-por-unidade", unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      // Get storage locations for this unit
      const { data: locais, error: locaisError } = await fromEstoque("estoque_locais_armazenamento")
        .select("id")
        .eq("unidade_id", unidadeId)
        .eq("is_active", true);
      if (locaisError) throw locaisError;
      if (!locais || locais.length === 0) return [];

      const localIds = (locais as any[]).map((l: any) => l.id);

      // Get materials with stock > 0 in those locations
      const { data: saldos, error: saldosError } = await fromEstoque("estoque_saldos")
        .select("material_id")
        .in("local_armazenamento_id", localIds)
        .gt("quantidade", 0);
      if (saldosError) throw saldosError;
      if (!saldos || saldos.length === 0) return [];

      const materialIds = [...new Set((saldos as any[]).map((s: any) => s.material_id))];

      // Fetch material details
      const { data: mats, error: matsError } = await fromEstoque("estoque_materiais")
        .select("id, nome, unidade_medida")
        .in("id", materialIds)
        .eq("is_active", true)
        .order("nome");
      if (matsError) throw matsError;
      return mats as unknown as Material[];
    },
    enabled: !!unidadeId,
  });

  // Also fetch all materials for the view dialog (to resolve names)
  const { data: todosMateriais = [] } = useQuery({
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

  // Fetch setores for display
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-solicitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_setores").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
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
        material_nome: todosMateriais.find((m) => m.id === item.material_id)?.nome || "—",
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
          setor_id: setorId || null,
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
      // Notify managers of the selected unit
      if (unidadeId) {
        const userName = user?.user_metadata?.name || user?.email || "Usuário";
        notificarGestoresUnidade(unidadeId, `Nova solicitação de materiais criada por ${userName}`);
      }
      toast.success("Solicitação criada com sucesso!");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar solicitação"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, solicitacao }: { id: string; newStatus: string; solicitacao: Solicitacao }) => {
      const { error } = await fromEstoque("estoque_solicitacoes")
        .update({ status: newStatus } as any)
        .eq("id", id);
      if (error) throw error;

      // Notify the requester about status change
      const statusLabel = STATUS_LABELS[newStatus] || newStatus;
      await criarNotificacao({
        user_id: solicitacao.solicitante_user_id,
        tipo: newStatus === "entregue" ? "material_entregue" : "status_atualizado",
        mensagem: `Sua solicitação foi atualizada para: ${statusLabel}`,
        referencia_id: id,
        referencia_tipo: "solicitacao",
      });
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

  // Aprovar (pendente -> aprovada)
  const aprovarMutation = useMutation({
    mutationFn: async (sol: Solicitacao) => {
      const { error } = await fromEstoque("estoque_solicitacoes")
        .update({ status: "aprovada" } as any)
        .eq("id", sol.id);
      if (error) throw error;
      await criarNotificacao({
        user_id: sol.solicitante_user_id,
        tipo: "status_atualizado",
        mensagem: "Sua solicitação foi aprovada e está aguardando separação.",
        referencia_id: sol.id,
        referencia_tipo: "solicitacao",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
      toast.success("Solicitação aprovada!");
    },
    onError: () => toast.error("Erro ao aprovar"),
  });

  // Abrir dialog de separação: carrega itens + saldos disponíveis
  const abrirSeparar = async (sol: Solicitacao) => {
    try {
      const { data: itensRaw, error: itensErr } = await fromEstoque("estoque_solicitacao_itens")
        .select("*")
        .eq("solicitacao_id", sol.id);
      if (itensErr) throw itensErr;
      const itensList = (itensRaw as any[]) || [];

      // Locais da unidade
      const { data: locaisUnidadeRaw } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome")
        .eq("unidade_id", sol.unidade_id || "")
        .eq("is_active", true);
      const locaisUnidade = (locaisUnidadeRaw as unknown as { id: string; nome: string }[]) || [];
      const localIds = locaisUnidade.map((l) => l.id);

      // Saldos
      const { data: saldosRaw } = await fromEstoque("estoque_saldos")
        .select("material_id, local_armazenamento_id, quantidade")
        .in("local_armazenamento_id", localIds.length > 0 ? localIds : ["00000000-0000-0000-0000-000000000000"])
        .gt("quantidade", 0);

      const novosItens = itensList.map((it: any) => {
        const mat = todosMateriais.find((m) => m.id === it.material_id);
        const saldosDoMat = (saldosRaw || [])
          .filter((s: any) => s.material_id === it.material_id)
          .map((s: any) => ({
            local_id: s.local_armazenamento_id,
            local_nome: locaisUnidade.find((l) => l.id === s.local_armazenamento_id)?.nome || "—",
            quantidade: s.quantidade,
          }));
        const defaultLocal = saldosDoMat[0]?.local_id || "";
        const maxDisp = saldosDoMat[0]?.quantidade || 0;
        return {
          id: it.id,
          material_id: it.material_id,
          material_nome: mat?.nome || "—",
          material_unidade: mat?.unidade_medida || "",
          quantidade_solicitada: it.quantidade_solicitada,
          quantidade_atendida: Math.min(it.quantidade_solicitada, maxDisp),
          local_armazenamento_id: defaultLocal,
          saldosDisponiveis: saldosDoMat,
        };
      });
      setSepararItens(novosItens);
      setSepararSol(sol);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar itens");
    }
  };

  // Separar (aprovada -> separada): baixa saldo + cria movimentações
  const separarMutation = useMutation({
    mutationFn: async () => {
      if (!separarSol) throw new Error("Solicitação não encontrada");
      const validos = separarItens.filter((i) => i.local_armazenamento_id && i.quantidade_atendida > 0);
      if (validos.length === 0) throw new Error("Informe ao menos um item separado");

      for (const it of validos) {
        // Re-checa saldo atual
        const { data: saldo } = await fromEstoque("estoque_saldos")
          .select("id, quantidade")
          .eq("material_id", it.material_id)
          .eq("local_armazenamento_id", it.local_armazenamento_id)
          .maybeSingle();
        const saldoAtual = (saldo as any)?.quantidade || 0;
        if (saldoAtual < it.quantidade_atendida) {
          throw new Error(`Saldo insuficiente para ${it.material_nome} (disponível: ${saldoAtual})`);
        }
        const novoSaldo = saldoAtual - it.quantidade_atendida;
        if (novoSaldo === 0) {
          await fromEstoque("estoque_saldos").delete().eq("id", (saldo as any).id);
        } else {
          await fromEstoque("estoque_saldos").update({ quantidade: novoSaldo } as any).eq("id", (saldo as any).id);
        }

        // Atualiza item da solicitação
        await fromEstoque("estoque_solicitacao_itens")
          .update({
            quantidade_atendida: it.quantidade_atendida,
            local_armazenamento_id: it.local_armazenamento_id,
          } as any)
          .eq("id", it.id);

        // Cria movimentação de saída
        await fromEstoque("estoque_movimentacoes").insert({
          material_id: it.material_id,
          tipo: "saida",
          quantidade: it.quantidade_atendida,
          local_origem_id: it.local_armazenamento_id,
          solicitacao_id: separarSol.id,
          responsavel_user_id: user?.id,
          observacoes: `Separação para solicitação de ${separarSol.solicitante_nome}`,
        } as any);
      }

      // Atualiza status da solicitação
      const { error: solErr } = await fromEstoque("estoque_solicitacoes")
        .update({ status: "separada" } as any)
        .eq("id", separarSol.id);
      if (solErr) throw solErr;

      await criarNotificacao({
        user_id: separarSol.solicitante_user_id,
        tipo: "material_separado",
        mensagem: "Sua solicitação foi separada e está pronta para entrega.",
        referencia_id: separarSol.id,
        referencia_tipo: "solicitacao",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      toast.success("Itens separados e baixa de saldo registrada!");
      setSepararSol(null);
      setSepararItens([]);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao separar itens"),
  });

  // Marcar como Entregue (separada -> entregue)
  const entregarMutation = useMutation({
    mutationFn: async (sol: Solicitacao) => {
      const { error } = await fromEstoque("estoque_solicitacoes")
        .update({ status: "entregue" } as any)
        .eq("id", sol.id);
      if (error) throw error;
      await criarNotificacao({
        user_id: sol.solicitante_user_id,
        tipo: "material_entregue",
        mensagem: "Sua solicitação foi entregue. Confirme o recebimento na lista de solicitações.",
        referencia_id: sol.id,
        referencia_tipo: "solicitacao",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
      toast.success("Marcada como entregue!");
    },
    onError: () => toast.error("Erro ao marcar como entregue"),
  });

  // Confirmar recebimento (somente solicitante): preenche recebido_por/recebido_em
  const confirmarRecebimentoMutation = useMutation({
    mutationFn: async (sol: Solicitacao) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await fromEstoque("estoque_movimentacoes")
        .update({
          recebido_por_user_id: user.id,
          recebido_em: new Date().toISOString(),
        } as any)
        .eq("solicitacao_id", sol.id)
        .is("recebido_em", null);
      if (error) throw error;

      // Notifica gestores
      if (sol.unidade_id) {
        const userName = user.user_metadata?.name || user.email || "Usuário";
        await notificarGestoresUnidade(sol.unidade_id, `${userName} confirmou o recebimento dos materiais.`, sol.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      setReceiptConfirm(null);
      toast.success("Recebimento confirmado. Obrigado!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao confirmar recebimento"),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setUnidadeId("");
    setSetorId("");
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

  const filteredByStatus = solicitacoes.filter((s) => filterStatus === "all" || s.status === filterStatus);

  const {
    searchTerm, setSearchTerm, currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage, sortField, sortDirection, setSorting,
    paginatedData, filteredData, totalPages,
  } = useTableControls({
    data: filteredByStatus,
    searchField: "solicitante_nome",
    defaultItemsPerPage: 25,
  });

  const getUnidadeNome = (id: string | null) => unidades.find((u) => u.id === id)?.nome || "—";
  const getSetorNome = (id: string | null) => {
    if (!id) return "—";
    return setores.find((s) => s.id === id)?.nome || "—";
  };

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
            <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por solicitante..." />
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
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader label="Solicitante" field="solicitante_nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                    </TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <SortableHeader label="Data" field="created_at" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((sol) => (
                    <TableRow key={sol.id}>
                      <TableCell className="font-medium">{sol.solicitante_nome}</TableCell>
                      <TableCell>{getUnidadeNome(sol.unidade_id)}</TableCell>
                      <TableCell>{getSetorNome(sol.setor_id)}</TableCell>
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
                        {canEditEstoque && sol.status === "pendente" && (
                          <Button size="sm" variant="outline" onClick={() => aprovarMutation.mutate(sol)} disabled={aprovarMutation.isPending}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                        )}
                        {canEditEstoque && sol.status === "aprovada" && (
                          <Button size="sm" variant="outline" onClick={() => abrirSeparar(sol)}>
                            <Package className="h-4 w-4 mr-1" /> Separar
                          </Button>
                        )}
                        {canEditEstoque && sol.status === "separada" && (
                          <Button size="sm" variant="outline" onClick={() => entregarMutation.mutate(sol)} disabled={entregarMutation.isPending}>
                            <Truck className="h-4 w-4 mr-1" /> Entregar
                          </Button>
                        )}
                        {sol.status === "entregue" && sol.solicitante_user_id === user?.id && (
                          <Button size="sm" variant="outline" onClick={() => setReceiptConfirm(sol)}>
                            <HandHeart className="h-4 w-4 mr-1" /> Confirmar Recebimento
                          </Button>
                        )}
                        {sol.status !== "cancelada" && sol.status !== "entregue" && (canEditEstoque || sol.solicitante_user_id === user?.id) && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelConfirm(sol)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4">
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  totalItems={filteredData.length}
                />
              </div>
            </>
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
              <Label>Unidade *</Label>
              <Select value={unidadeId} onValueChange={handleUnidadeChange}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {unidadesPermitidas.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {unidadesPermitidas.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  Você não está vinculado a nenhuma unidade. Solicite ao administrador.
                </p>
              )}
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Motivo ou detalhes..." />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Itens</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem} disabled={materiaisDisponiveis.length === 0}>
                  <Plus className="h-3 w-3 mr-1" /> Item
                </Button>
              </div>
              {unidadeId && materiaisDisponiveis.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Nenhum material com saldo disponível nesta unidade.</p>
              )}
              {!unidadeId && (
                <p className="text-sm text-muted-foreground italic">Selecione uma unidade para ver os materiais disponíveis.</p>
              )}
              {itens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={item.material_id} onValueChange={(v) => updateItem(idx, "material_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Material..." /></SelectTrigger>
                      <SelectContent>
                        {materiaisDisponiveis.map((m) => (
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
                <div><span className="text-muted-foreground">Setor:</span> {getSetorNome(viewDialog.setor_id)}</div>
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

      {/* Separar Dialog */}
      <Dialog open={!!separarSol} onOpenChange={(o) => { if (!o) { setSepararSol(null); setSepararItens([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Separar Itens</DialogTitle>
            <DialogDescription>
              Defina o local de origem e a quantidade atendida de cada item. A baixa de saldo será registrada automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {separarItens.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum item para separar.</p>
            )}
            {separarItens.map((it, idx) => {
              const localSel = it.saldosDisponiveis.find((s) => s.local_id === it.local_armazenamento_id);
              const maxDisp = localSel?.quantidade ?? 0;
              return (
                <div key={it.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <strong className="text-sm">{it.material_nome}</strong>
                    <span className="text-xs text-muted-foreground">Solicitado: {it.quantidade_solicitada} {it.material_unidade}</span>
                  </div>
                  {it.saldosDisponiveis.length === 0 ? (
                    <p className="text-sm text-destructive">Sem saldo disponível nesta unidade.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Local de origem</Label>
                        <Select
                          value={it.local_armazenamento_id}
                          onValueChange={(v) => {
                            const novos = [...separarItens];
                            novos[idx].local_armazenamento_id = v;
                            const novoMax = it.saldosDisponiveis.find((s) => s.local_id === v)?.quantidade ?? 0;
                            novos[idx].quantidade_atendida = Math.min(novos[idx].quantidade_atendida, novoMax, it.quantidade_solicitada);
                            setSepararItens(novos);
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {it.saldosDisponiveis.map((s) => (
                              <SelectItem key={s.local_id} value={s.local_id}>
                                {s.local_nome} (saldo: {s.quantidade})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Qtd. atendida (máx {Math.min(maxDisp, it.quantidade_solicitada)})</Label>
                        <Input
                          type="number"
                          min={0}
                          max={Math.min(maxDisp, it.quantidade_solicitada)}
                          value={it.quantidade_atendida}
                          onChange={(e) => {
                            const novos = [...separarItens];
                            const v = parseInt(e.target.value) || 0;
                            novos[idx].quantidade_atendida = Math.max(0, Math.min(v, maxDisp, it.quantidade_solicitada));
                            setSepararItens(novos);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSepararSol(null); setSepararItens([]); }}>Cancelar</Button>
            <Button
              onClick={() => separarMutation.mutate()}
              disabled={separarMutation.isPending || separarItens.every((i) => i.quantidade_atendida === 0)}
            >
              {separarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Separação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelConfirm} onOpenChange={(o) => !o && setCancelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca a solicitação como cancelada e não pode ser desfeita. Itens já separados precisam ser devolvidos manualmente ao estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!cancelConfirm) return;
                const { error } = await fromEstoque("estoque_solicitacoes")
                  .update({ status: "cancelada" } as any)
                  .eq("id", cancelConfirm.id);
                if (error) toast.error("Erro ao cancelar");
                else {
                  toast.success("Solicitação cancelada!");
                  queryClient.invalidateQueries({ queryKey: ["estoque-solicitacoes"] });
                }
                setCancelConfirm(null);
              }}
            >
              Cancelar solicitação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Confirmation */}
      <AlertDialog open={!!receiptConfirm} onOpenChange={(o) => !o && setReceiptConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao confirmar, você atesta que recebeu os materiais desta solicitação. Esta confirmação fica registrada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => receiptConfirm && confirmarRecebimentoMutation.mutate(receiptConfirm)}
              disabled={confirmarRecebimentoMutation.isPending}
            >
              {confirmarRecebimentoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar recebimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
