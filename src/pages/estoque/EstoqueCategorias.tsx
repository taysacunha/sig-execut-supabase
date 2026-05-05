import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Tag, Loader2, Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { normalizeText } from "@/lib/textUtils";

interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  is_active: boolean;
}

const fromEstoque = (table: string) => supabase.from(table as any);

export default function EstoqueCategorias() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [activeTab, setActiveTab] = useState("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [toggleConfirm, setToggleConfirm] = useState<{ id: string; nome: string; newActive: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["estoque-categorias"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_categorias").select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as Categoria[];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["estoque-materiais-categoria-check"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais").select("id, categoria_id");
      if (error) throw error;
      return (data || []) as unknown as { id: string; categoria_id: string | null }[];
    },
  });

  const ativos = useMemo(() => categorias.filter((c) => c.is_active), [categorias]);
  const inativos = useMemo(() => categorias.filter((c) => !c.is_active), [categorias]);

  const activeControls = useTableControls({ data: ativos, searchField: ["nome", "descricao"], defaultItemsPerPage: 25 });
  const inactiveControls = useTableControls({ data: inativos, searchField: ["nome", "descricao"], defaultItemsPerPage: 25 });

  const hasMateriais = (id: string) => materiais.some((m) => m.categoria_id === id);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const dup = categorias.find((c) => c.is_active && (!values.id || c.id !== values.id) && normalizeText(c.nome) === normalizeText(values.nome));
      if (dup) throw new Error("Já existe uma categoria ativa com esse nome");
      const payload = { nome: values.nome.trim(), descricao: values.descricao.trim() || null };
      if (values.id) {
        const { error } = await fromEstoque("estoque_categorias").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_categorias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-categorias"] });
      toast.success(editing ? "Categoria atualizada!" : "Categoria cadastrada!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!is_active && hasMateriais(id)) {
        throw new Error("Existem materiais vinculados a esta categoria. Reatribua antes de desativar.");
      }
      const { error } = await fromEstoque("estoque_categorias").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-categorias"] });
      toast.success("Status alterado!");
      setToggleConfirm(null);
    },
    onError: (err: Error) => { toast.error(err.message); setToggleConfirm(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (hasMateriais(id)) throw new Error("Existem materiais vinculados. Não é possível excluir.");
      const { error } = await fromEstoque("estoque_categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-categorias"] });
      toast.success("Categoria excluída!");
      setDeleteConfirm(null);
    },
    onError: (err: Error) => { toast.error(err.message); setDeleteConfirm(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ nome: "", descricao: "" }); };
  const openEdit = (c: Categoria) => { setEditing(c); setForm({ nome: c.nome, descricao: c.descricao || "" }); setDialogOpen(true); };
  const handleSubmit = () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    saveMutation.mutate({ ...form, id: editing?.id });
  };

  const renderTable = (controls: ReturnType<typeof useTableControls<Categoria>>, isInactive: boolean) => {
    const { paginatedData, filteredData, currentPage, totalPages, itemsPerPage, setCurrentPage, setItemsPerPage, sortField, sortDirection, setSorting } = controls;
    if (paginatedData.length === 0) return <p className="text-center text-muted-foreground py-8">{isInactive ? "Nenhuma categoria inativa" : "Nenhuma categoria encontrada"}</p>;
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortableHeader label="Nome" field="nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} /></TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center">Materiais</TableHead>
              {canEditEstoque && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((c) => {
              const count = materiais.filter((m) => m.categoria_id === c.id).length;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.descricao || "—"}</TableCell>
                  <TableCell className="text-center">{count}</TableCell>
                  {canEditEstoque && (
                    <TableCell className="text-right space-x-1">
                      {isInactive ? (
                        <>
                          <Button variant="ghost" size="icon" title="Reativar" onClick={() => setToggleConfirm({ id: c.id, nome: c.nome, newActive: true })}><RotateCcw className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Excluir" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ id: c.id, nome: c.nome })}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Desativar" onClick={() => setToggleConfirm({ id: c.id, nome: c.nome, newActive: false })}><span className="text-xs">⏸</span></Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination currentPage={currentPage} totalPages={totalPages} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} totalItems={filteredData.length} />
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">Categorias para classificar materiais do estoque</p>
        </div>
        {canEditEstoque && (
          <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova Categoria</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Categorias Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="ativos">Ativas <Badge variant="secondary" className="ml-2">{ativos.length}</Badge></TabsTrigger>
                  <TabsTrigger value="inativos">Inativas <Badge variant="secondary" className="ml-2">{inativos.length}</Badge></TabsTrigger>
                </TabsList>
                <TableSearch
                  value={activeTab === "ativos" ? activeControls.searchTerm : inactiveControls.searchTerm}
                  onChange={activeTab === "ativos" ? activeControls.setSearchTerm : inactiveControls.setSearchTerm}
                  placeholder="Buscar..."
                />
              </div>
              <TabsContent value="ativos">{renderTable(activeControls, false)}</TabsContent>
              <TabsContent value="inativos">{renderTable(inactiveControls, true)}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toggleConfirm} onOpenChange={(o) => { if (!o) setToggleConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar {toggleConfirm?.newActive ? "ativação" : "desativação"}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {toggleConfirm?.newActive ? "reativar" : "desativar"} a categoria <strong>{toggleConfirm?.nome}</strong>?
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

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente a categoria <strong>{deleteConfirm?.nome}</strong>?
              <br /><br /><span className="font-semibold text-destructive">Esta ação é irreversível.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}>
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
