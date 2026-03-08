import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Package, Loader2, Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";

interface Material {
  id: string;
  nome: string;
  descricao: string | null;
  unidade_medida: string;
  categoria: string | null;
  estoque_minimo: number;
  is_active: boolean;
}

const UNIDADES_MEDIDA = [
  { value: "un", label: "Unidade" },
  { value: "cx", label: "Caixa" },
  { value: "pct", label: "Pacote" },
  { value: "kg", label: "Quilograma" },
  { value: "lt", label: "Litro" },
  { value: "mt", label: "Metro" },
  { value: "rl", label: "Rolo" },
  { value: "fl", label: "Folha" },
  { value: "rs", label: "Resma" },
];

const fromEstoque = (table: string) => supabase.from(table as any);

export default function EstoqueMateriais() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [activeTab, setActiveTab] = useState("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<{ id: string; nome: string; newActive: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    unidade_medida: "un",
    categoria: "",
    estoque_minimo: 0,
  });

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["estoque-materiais"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais").select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as Material[];
    },
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["estoque-saldos-check"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_saldos").select("material_id, quantidade");
      if (error) throw error;
      return (data || []) as unknown as { material_id: string; quantidade: number }[];
    },
  });

  const materiaisAtivos = useMemo(() => materiais.filter((m) => m.is_active), [materiais]);
  const materiaisInativos = useMemo(() => materiais.filter((m) => !m.is_active), [materiais]);

  const activeControls = useTableControls({
    data: materiaisAtivos,
    searchField: ["nome", "categoria"],
    defaultItemsPerPage: 25,
  });

  const inactiveControls = useTableControls({
    data: materiaisInativos,
    searchField: ["nome", "categoria"],
    defaultItemsPerPage: 25,
  });

  const materialHasBalance = (materialId: string) => {
    return saldos.some((s) => s.material_id === materialId && s.quantidade > 0);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload = {
        nome: values.nome,
        descricao: values.descricao || null,
        unidade_medida: values.unidade_medida,
        categoria: values.categoria || null,
        estoque_minimo: values.estoque_minimo,
      };
      if (values.id) {
        const { error } = await fromEstoque("estoque_materiais").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_materiais").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      toast.success(editingMaterial ? "Material atualizado!" : "Material cadastrado!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // If deactivating, check for balance
      if (!is_active && materialHasBalance(id)) {
        throw new Error("Zere o saldo deste material em todos os locais antes de desativar");
      }
      const { error } = await fromEstoque("estoque_materiais").update({ is_active }).eq("id", id);
      if (error) throw error;
      // Clean up zero-balance records when deactivating
      if (!is_active) {
        await fromEstoque("estoque_saldos").delete().eq("material_id", id).eq("quantidade", 0);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-check"] });
      toast.success("Status alterado!");
      setToggleConfirm(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setToggleConfirm(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Remove zero-balance records first
      await fromEstoque("estoque_saldos").delete().eq("material_id", id);
      const { error } = await fromEstoque("estoque_materiais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-check"] });
      toast.success("Material excluído definitivamente!");
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMaterial(null);
    setForm({ nome: "", descricao: "", unidade_medida: "un", categoria: "", estoque_minimo: 0 });
  };

  const openEdit = (m: Material) => {
    setEditingMaterial(m);
    setForm({
      nome: m.nome,
      descricao: m.descricao || "",
      unidade_medida: m.unidade_medida,
      categoria: m.categoria || "",
      estoque_minimo: m.estoque_minimo,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    saveMutation.mutate({ ...form, id: editingMaterial?.id });
  };

  const handleDeactivate = (id: string, nome: string) => {
    if (materialHasBalance(id)) {
      return toast.error("Zere o saldo deste material em todos os locais antes de desativar");
    }
    setToggleConfirm({ id, nome, newActive: false });
  };

  const unidadeLabel = (val: string) => UNIDADES_MEDIDA.find((u) => u.value === val)?.label || val;

  const renderTable = (controls: ReturnType<typeof useTableControls<Material>>, isInactiveTab: boolean) => {
    const { paginatedData, filteredData, currentPage, totalPages, itemsPerPage, setCurrentPage, setItemsPerPage, sortField, sortDirection, setSorting } = controls;

    if (paginatedData.length === 0) {
      return <p className="text-center text-muted-foreground py-8">{isInactiveTab ? "Nenhum material inativo" : "Nenhum material encontrado"}</p>;
    }

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader label="Nome" field="nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Categoria" field="categoria" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
              </TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">
                <SortableHeader label="Estoque Mín." field="estoque_minimo" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
              </TableHead>
              {canEditEstoque && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nome}</TableCell>
                <TableCell>{m.categoria || "—"}</TableCell>
                <TableCell>{unidadeLabel(m.unidade_medida)}</TableCell>
                <TableCell className="text-center">{m.estoque_minimo}</TableCell>
                {canEditEstoque && (
                  <TableCell className="text-right space-x-1">
                    {isInactiveTab ? (
                      <>
                        <Button variant="ghost" size="icon" title="Reativar" onClick={() => setToggleConfirm({ id: m.id, nome: m.nome, newActive: true })}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Excluir definitivamente" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ id: m.id, nome: m.nome })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Desativar" onClick={() => handleDeactivate(m.id, m.nome)}>
                          <span className="text-xs">⏸</span>
                        </Button>
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={filteredData.length}
        />
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Materiais</h1>
          <p className="text-muted-foreground">Cadastro de materiais do estoque</p>
        </div>
        {canEditEstoque && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Material
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Materiais Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="ativos">
                    Ativos <Badge variant="secondary" className="ml-2">{materiaisAtivos.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="inativos">
                    Inativos <Badge variant="secondary" className="ml-2">{materiaisInativos.length}</Badge>
                  </TabsTrigger>
                </TabsList>
                <TableSearch
                  value={activeTab === "ativos" ? activeControls.searchTerm : inactiveControls.searchTerm}
                  onChange={activeTab === "ativos" ? activeControls.setSearchTerm : inactiveControls.setSearchTerm}
                  placeholder="Buscar por nome ou categoria..."
                />
              </div>
              <TabsContent value="ativos">
                {renderTable(activeControls, false)}
              </TabsContent>
              <TabsContent value="inativos">
                {renderTable(inactiveControls, true)}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMaterial ? "Editar Material" : "Novo Material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unidade de Medida</Label>
                <Select value={form.unidade_medida} onValueChange={(v) => setForm({ ...form, unidade_medida: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MEDIDA.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estoque Mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estoque_minimo}
                  onChange={(e) => setForm({ ...form, estoque_minimo: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Papelaria, Limpeza, Informática..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingMaterial ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação ativação/desativação */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => { if (!open) setToggleConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar {toggleConfirm?.newActive ? "ativação" : "desativação"}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {toggleConfirm?.newActive ? "reativar" : "desativar"} o material <strong>{toggleConfirm?.nome}</strong>?
              {!toggleConfirm?.newActive && " Saldos zerados vinculados serão removidos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleConfirm && toggleMutation.mutate({ id: toggleConfirm.id, is_active: toggleConfirm.newActive })}>
              {toggleConfirm?.newActive ? "Reativar" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação exclusão definitiva */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o material <strong>{deleteConfirm?.nome}</strong>?
              <br /><br />
              <span className="font-semibold text-destructive">Esta ação é irreversível.</span> O registro será removido do sistema e ficará apenas no histórico de auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
