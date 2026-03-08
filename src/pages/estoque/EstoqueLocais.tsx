import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, MapPin, Loader2, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { normalizeText } from "@/lib/textUtils";

interface Local {
  id: string;
  unidade_id: string;
  nome: string;
  tipo: string;
  parent_id: string | null;
  is_active: boolean;
}

interface Unidade {
  id: string;
  nome: string;
  is_active: boolean;
}

const TIPOS = [
  { value: "deposito", label: "Depósito" },
  { value: "armario", label: "Armário" },
  { value: "prateleira", label: "Prateleira" },
];

const fromEstoque = (table: string) => supabase.from(table as any);

export default function EstoqueLocais() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [activeTab, setActiveTab] = useState("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Local | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "deposito", unidade_id: "" });
  const [toggleConfirm, setToggleConfirm] = useState<{ id: string; nome: string; newActive: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-estoque-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_unidades").select("id, nome, is_active").order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  const unidadesAtivas = useMemo(() => unidades.filter((u) => u.is_active), [unidades]);

  const { data: locais = [], isLoading } = useQuery({
    queryKey: ["estoque-locais"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento").select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as Local[];
    },
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["estoque-saldos-locais-check"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_saldos").select("local_armazenamento_id, quantidade");
      if (error) throw error;
      return (data || []) as unknown as { local_armazenamento_id: string; quantidade: number }[];
    },
  });

  const enrichLocal = (l: Local) => {
    const unidade = unidades.find((u) => u.id === l.unidade_id);
    return {
      ...l,
      unidade_nome: unidade?.nome || "—",
      unidade_inativa: unidade ? !unidade.is_active : false,
      tipo_label: TIPOS.find((t) => t.value === l.tipo)?.label || l.tipo,
    };
  };

  const locaisAtivos = useMemo(() => locais.filter((l) => l.is_active).map(enrichLocal), [locais, unidades]);
  const locaisInativos = useMemo(() => locais.filter((l) => !l.is_active).map(enrichLocal), [locais, unidades]);

  const activeControls = useTableControls({
    data: locaisAtivos,
    searchField: ["nome", "unidade_nome", "tipo_label"],
    defaultItemsPerPage: 25,
  });

  const inactiveControls = useTableControls({
    data: locaisInativos,
    searchField: ["nome", "unidade_nome", "tipo_label"],
    defaultItemsPerPage: 25,
  });

  const localHasBalance = (localId: string) => {
    return saldos.some((s) => s.local_armazenamento_id === localId && s.quantidade > 0);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const duplicate = locais.find((l) => {
        if (values.id && l.id === values.id) return false;
        if (!l.is_active) return false;
        return l.unidade_id === values.unidade_id && normalizeText(l.nome) === normalizeText(values.nome);
      });
      if (duplicate) throw new Error("Já existe um local com este nome nesta unidade");

      const payload = { nome: values.nome, tipo: values.tipo, unidade_id: values.unidade_id, parent_id: null };
      if (values.id) {
        const { error } = await fromEstoque("estoque_locais_armazenamento").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_locais_armazenamento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-locais"] });
      toast.success(editing ? "Local atualizado!" : "Local cadastrado!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!is_active && localHasBalance(id)) {
        throw new Error("Transfira ou zere o estoque deste local antes de desativar");
      }
      const { error } = await fromEstoque("estoque_locais_armazenamento").update({ is_active }).eq("id", id);
      if (error) throw error;
      if (!is_active) {
        await fromEstoque("estoque_saldos").delete().eq("local_armazenamento_id", id).eq("quantidade", 0);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-locais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-locais-check"] });
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
      await fromEstoque("estoque_saldos").delete().eq("local_armazenamento_id", id);
      const { error } = await fromEstoque("estoque_locais_armazenamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-locais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-locais-check"] });
      toast.success("Local excluído definitivamente!");
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ nome: "", tipo: "deposito", unidade_id: "" });
  };

  const openEdit = (l: Local) => {
    setEditing(l);
    setForm({ nome: l.nome, tipo: l.tipo, unidade_id: l.unidade_id });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!form.unidade_id) return toast.error("Selecione uma unidade");
    saveMutation.mutate({ ...form, id: editing?.id });
  };

  const handleDeactivate = (id: string, nome: string) => {
    if (localHasBalance(id)) {
      return toast.error("Transfira ou zere o estoque deste local antes de desativar");
    }
    setToggleConfirm({ id, nome, newActive: false });
  };

  type EnrichedLocal = ReturnType<typeof enrichLocal>;

  const renderTable = (controls: ReturnType<typeof useTableControls<EnrichedLocal>>, isInactiveTab: boolean) => {
    const { paginatedData, filteredData, currentPage, totalPages, itemsPerPage, setCurrentPage, setItemsPerPage, sortField, sortDirection, setSorting } = controls;

    if (paginatedData.length === 0) {
      return <p className="text-center text-muted-foreground py-8">{isInactiveTab ? "Nenhum local inativo" : "Nenhum local encontrado"}</p>;
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
                <SortableHeader label="Tipo" field="tipo_label" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Unidade" field="unidade_nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
              </TableHead>
              {canEditEstoque && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell>{l.tipo_label}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    {l.unidade_nome}
                    {l.unidade_inativa && (
                      <span title="Unidade inativa" className="text-amber-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </span>
                </TableCell>
                {canEditEstoque && (
                  <TableCell className="text-right space-x-1">
                    {isInactiveTab ? (
                      <>
                        <Button variant="ghost" size="icon" title="Reativar" onClick={() => setToggleConfirm({ id: l.id, nome: l.nome, newActive: true })}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Excluir definitivamente" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ id: l.id, nome: l.nome })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Desativar" onClick={() => handleDeactivate(l.id, l.nome)}>
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
          <h1 className="text-3xl font-bold tracking-tight">Locais de Armazenamento</h1>
          <p className="text-muted-foreground">Depósitos, armários e prateleiras por unidade</p>
        </div>
        {canEditEstoque && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Local
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Locais Cadastrados
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
                    Ativos <Badge variant="secondary" className="ml-2">{locaisAtivos.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="inativos">
                    Inativos <Badge variant="secondary" className="ml-2">{locaisInativos.length}</Badge>
                  </TabsTrigger>
                </TabsList>
                <TableSearch
                  value={activeTab === "ativos" ? activeControls.searchTerm : inactiveControls.searchTerm}
                  onChange={activeTab === "ativos" ? activeControls.setSearchTerm : inactiveControls.setSearchTerm}
                  placeholder="Buscar por nome, unidade ou tipo..."
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
            <DialogTitle>{editing ? "Editar Local" : "Novo Local de Armazenamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Unidade *</Label>
              <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {unidadesAtivas.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Depósito 1, Armário A..." />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

      {/* Confirmação ativação/desativação */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => { if (!open) setToggleConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar {toggleConfirm?.newActive ? "ativação" : "desativação"}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {toggleConfirm?.newActive ? "reativar" : "desativar"} o local <strong>{toggleConfirm?.nome}</strong>?
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
            <AlertDialogTitle>Excluir local definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o local <strong>{deleteConfirm?.nome}</strong>?
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
