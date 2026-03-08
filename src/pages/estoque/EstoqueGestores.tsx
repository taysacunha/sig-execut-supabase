import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Building2, UserPlus, Mail, Users, AlertTriangle, Pencil, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/useUserRole";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Gestor {
  id: string;
  user_id: string;
  unidade_id: string;
  nome_gestor: string;
  created_at: string;
}

interface UsuarioUnidade {
  id: string;
  user_id: string;
  unidade_id: string;
  setor_id: string | null;
  created_at: string;
}

interface Unidade {
  id: string;
  nome: string;
}

interface Setor {
  id: string;
  nome: string;
  is_active: boolean;
  unidade_id: string | null;
}

interface SystemUser {
  id: string;
  email: string;
  name: string | null;
}

const fromEstoque = (table: string) => supabase.from(table as any);

export default function EstoqueGestores() {
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const canManage = role === "super_admin" || role === "admin";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", unidade_id: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);

  // User-unit link state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ user_id: "", unidade_id: "", setor_id: "" });
  const [deleteLinkConfirm, setDeleteLinkConfirm] = useState<{ id: string; nome: string } | null>(null);

  // Edit setor state
  const [editLinkDialog, setEditLinkDialog] = useState<{ id: string; setor_id: string; nome: string } | null>(null);
  const [editSetorId, setEditSetorId] = useState("");

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_unidades").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  // Fetch all setores (including inactive for displaying alerts)
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_setores").select("id, nome, is_active, unidade_id").order("nome");
      if (error) throw error;
      return data as Setor[];
    },
  });

  const setoresAtivos = setores.filter((s) => s.is_active);

  const { data: gestores = [], isLoading } = useQuery({
    queryKey: ["estoque-gestores"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_gestores").select("*").order("nome_gestor");
      if (error) throw error;
      return (data || []) as unknown as Gestor[];
    },
  });

  // Fetch user-unit links
  const { data: usuarioUnidades = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["estoque-usuarios-unidades"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_usuarios_unidades").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UsuarioUnidade[];
    },
    enabled: canManage,
  });

  // Fetch users who have access to estoque module
  const { data: estoqueAccessUserIds = [] } = useQuery({
    queryKey: ["estoque-access-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_access" as any)
        .select("user_id")
        .eq("system_name", "estoque");
      if (error) throw error;
      return (data || []).map((r: any) => r.user_id as string);
    },
    enabled: canManage,
  });

  // Fetch system users via edge function, then filter by estoque access
  const { data: systemUsers = [] } = useQuery({
    queryKey: ["system-users-for-gestores", estoqueAccessUserIds],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-users");
      if (error) throw error;
      const users = data?.users || [];
      const accessSet = new Set(estoqueAccessUserIds);
      return users
        .filter((u: any) => accessSet.has(u.id))
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name || u.user_metadata?.name || u.email,
        })) as SystemUser[];
    },
    enabled: canManage && estoqueAccessUserIds.length >= 0,
  });

  // ===== GESTORES =====
  const existingUserIds = new Set(gestores.map((g) => g.user_id));
  const availableUsers = systemUsers.filter((u) => !existingUserIds.has(u.id));
  const selectedUser = systemUsers.find((u) => u.id === form.user_id);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const user = systemUsers.find((u) => u.id === values.user_id);
      if (!user) throw new Error("Usuário não encontrado");
      const { error } = await fromEstoque("estoque_gestores").insert({
        user_id: values.user_id,
        unidade_id: values.unidade_id,
        nome_gestor: user.name || user.email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-gestores"] });
      toast.success("Gestor cadastrado!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromEstoque("estoque_gestores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-gestores"] });
      toast.success("Gestor removido!");
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== USUÁRIOS POR UNIDADE =====
  const saveLinkMutation = useMutation({
    mutationFn: async (values: typeof linkForm) => {
      const { error } = await fromEstoque("estoque_usuarios_unidades").insert({
        user_id: values.user_id,
        unidade_id: values.unidade_id,
        setor_id: values.setor_id || null,
      } as any);
      if (error) {
        if (error.code === "23505") throw new Error("Este usuário já está vinculado a esta unidade");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-usuarios-unidades"] });
      toast.success("Usuário vinculado à unidade!");
      closeLinkDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSetorMutation = useMutation({
    mutationFn: async ({ id, setor_id }: { id: string; setor_id: string | null }) => {
      const { error } = await fromEstoque("estoque_usuarios_unidades")
        .update({ setor_id } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-usuarios-unidades"] });
      toast.success("Setor atualizado!");
      setEditLinkDialog(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromEstoque("estoque_usuarios_unidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-usuarios-unidades"] });
      toast.success("Vínculo removido!");
      setDeleteLinkConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setForm({ user_id: "", unidade_id: "" });
  };

  const closeLinkDialog = () => {
    setLinkDialogOpen(false);
    setLinkForm({ user_id: "", unidade_id: "", setor_id: "" });
  };

  const handleSubmit = () => {
    if (!form.user_id) return toast.error("Selecione um usuário");
    if (!form.unidade_id) return toast.error("Selecione a unidade");
    saveMutation.mutate(form);
  };

  const handleLinkSubmit = () => {
    if (!linkForm.user_id) return toast.error("Selecione um usuário");
    if (!linkForm.unidade_id) return toast.error("Selecione a unidade");
    if (!linkForm.setor_id) return toast.error("Selecione o setor");
    saveLinkMutation.mutate(linkForm);
  };

  const handleEditSetorSubmit = () => {
    if (!editLinkDialog) return;
    if (!editSetorId) return toast.error("Selecione o setor");
    updateSetorMutation.mutate({ id: editLinkDialog.id, setor_id: editSetorId });
  };

  const getUserDisplay = (userId: string) => {
    const user = systemUsers.find((u) => u.id === userId);
    return user?.email || "";
  };

  const getUserName = (userId: string) => {
    const user = systemUsers.find((u) => u.id === userId);
    return user?.name || user?.email || "—";
  };

  const getSetorNome = (setorId: string | null) => {
    if (!setorId) return "—";
    return setores.find((s) => s.id === setorId)?.nome || "—";
  };

  const isSetorInativo = (setorId: string | null) => {
    if (!setorId) return false;
    const setor = setores.find((s) => s.id === setorId);
    return setor ? !setor.is_active : true; // If not found, treat as inactive
  };

  // Count users with inactive setores
  const usersComSetorInativo = usuarioUnidades.filter((l) => isSetorInativo(l.setor_id));

  // Enrich gestores with unidade nome for search
  const gestoresEnriched = gestores.map((g) => ({
    ...g,
    unidade_nome: unidades.find((u) => u.id === g.unidade_id)?.nome || "—",
    email: getUserDisplay(g.user_id),
  }));

  const gestoresControls = useTableControls({
    data: gestoresEnriched,
    searchField: ["nome_gestor", "unidade_nome", "email"],
    defaultItemsPerPage: 25,
  });

  // Enrich user-unit links
  const linksEnriched = usuarioUnidades.map((l) => ({
    ...l,
    nome_usuario: getUserName(l.user_id),
    email: getUserDisplay(l.user_id),
    unidade_nome: unidades.find((u) => u.id === l.unidade_id)?.nome || "—",
    setor_nome: getSetorNome(l.setor_id),
    setor_inativo: isSetorInativo(l.setor_id),
  }));

  const linksControls = useTableControls({
    data: linksEnriched,
    searchField: ["nome_usuario", "unidade_nome", "email", "setor_nome"],
    defaultItemsPerPage: 25,
  });

  const unidadesSemGestor = unidades.filter((u) => !gestores.some((g) => g.unidade_id === u.id));

  // Filter setores by selected unidade in link form (if the setor has unidade_id)
  const setoresFiltrados = linkForm.unidade_id
    ? setoresAtivos.filter((s) => !s.unidade_id || s.unidade_id === linkForm.unidade_id)
    : setoresAtivos;

  const setoresFiltradosEdit = editLinkDialog
    ? (() => {
        const vinculo = usuarioUnidades.find((l) => l.id === editLinkDialog.id);
        const unidadeId = vinculo?.unidade_id;
        return unidadeId
          ? setoresAtivos.filter((s) => !s.unidade_id || s.unidade_id === unidadeId)
          : setoresAtivos;
      })()
    : setoresAtivos;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestores e Usuários</h1>
        <p className="text-muted-foreground">Gerencie gestores de estoque e vínculos de usuários por unidade e setor</p>
      </div>

      <Tabs defaultValue="gestores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gestores" className="gap-2">
            <Building2 className="h-4 w-4" /> Gestores
          </TabsTrigger>
          <TabsTrigger value="vinculos" className="gap-2">
            <Users className="h-4 w-4" /> Usuários por Unidade
          </TabsTrigger>
        </TabsList>

        {/* ===== ABA GESTORES ===== */}
        <TabsContent value="gestores" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Novo Gestor
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" /> Gestores Cadastrados
                    </CardTitle>
                    <TableSearch value={gestoresControls.searchTerm} onChange={gestoresControls.setSearchTerm} placeholder="Buscar por nome, unidade ou e-mail..." />
                  </div>
                </CardHeader>
                <CardContent>
                  {gestoresControls.paginatedData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum gestor encontrado</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <SortableHeader label="Nome" field="nome_gestor" currentField={gestoresControls.sortField as string} direction={gestoresControls.sortDirection} onSort={gestoresControls.setSorting as any} />
                            </TableHead>
                            <TableHead>
                              <SortableHeader label="Unidade" field="unidade_nome" currentField={gestoresControls.sortField as string} direction={gestoresControls.sortDirection} onSort={gestoresControls.setSorting as any} />
                            </TableHead>
                            <TableHead>E-mail</TableHead>
                            {canManage && <TableHead className="text-right">Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gestoresControls.paginatedData.map((g) => (
                            <TableRow key={g.id}>
                              <TableCell className="font-medium">{g.nome_gestor}</TableCell>
                              <TableCell>{g.unidade_nome}</TableCell>
                              <TableCell className="text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {g.email}
                                </span>
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteConfirm({ id: g.id, nome: g.nome_gestor })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination
                        currentPage={gestoresControls.currentPage}
                        totalPages={gestoresControls.totalPages}
                        itemsPerPage={gestoresControls.itemsPerPage}
                        onPageChange={gestoresControls.setCurrentPage}
                        onItemsPerPageChange={gestoresControls.setItemsPerPage}
                        totalItems={gestoresControls.filteredData.length}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              {unidadesSemGestor.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-muted-foreground">Unidades sem gestor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {unidadesSemGestor.map((u) => (
                        <Badge key={u.id} variant="outline">{u.nome}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== ABA VÍNCULOS USUÁRIO-UNIDADE ===== */}
        <TabsContent value="vinculos" className="space-y-4">
          {usersComSetorInativo.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{usersComSetorInativo.length}</strong> usuário(s) com setor desativado ou sem setor definido. Realoque-os para evitar problemas nas solicitações.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-start">
            <p className="text-sm text-muted-foreground max-w-lg">
              Vincule usuários às unidades e setores para controlar quais materiais podem solicitar e para que o gestor saiba onde entregar. 
              Gestores já têm acesso automático às unidades que gerenciam. Admins acessam todas.
            </p>
            {canManage && (
              <Button onClick={() => setLinkDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Vincular Usuário
              </Button>
            )}
          </div>

          {loadingLinks ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" /> Vínculos Cadastrados
                  </CardTitle>
                  <TableSearch value={linksControls.searchTerm} onChange={linksControls.setSearchTerm} placeholder="Buscar por nome, unidade, setor ou e-mail..." />
                </div>
              </CardHeader>
              <CardContent>
                {linksControls.paginatedData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum vínculo encontrado</p>
                ) : (
                  <TooltipProvider>
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <SortableHeader label="Usuário" field="nome_usuario" currentField={linksControls.sortField as string} direction={linksControls.sortDirection} onSort={linksControls.setSorting as any} />
                            </TableHead>
                            <TableHead>
                              <SortableHeader label="Unidade" field="unidade_nome" currentField={linksControls.sortField as string} direction={linksControls.sortDirection} onSort={linksControls.setSorting as any} />
                            </TableHead>
                            <TableHead>
                              <SortableHeader label="Setor" field="setor_nome" currentField={linksControls.sortField as string} direction={linksControls.sortDirection} onSort={linksControls.setSorting as any} />
                            </TableHead>
                            <TableHead>E-mail</TableHead>
                            {canManage && <TableHead className="text-right">Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linksControls.paginatedData.map((l) => (
                            <TableRow key={l.id}>
                              <TableCell className="font-medium">{l.nome_usuario}</TableCell>
                              <TableCell>{l.unidade_nome}</TableCell>
                              <TableCell>
                                <span className="flex items-center gap-1.5">
                                  {l.setor_nome}
                                  {l.setor_inativo && l.setor_id && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                                          Inativo
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Setor desativado — realoque este usuário para outro setor
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {!l.setor_id && (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">Sem setor</Badge>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {l.email}
                                </span>
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditLinkDialog({ id: l.id, setor_id: l.setor_id || "", nome: `${l.nome_usuario} → ${l.unidade_nome}` });
                                      setEditSetorId(l.setor_id || "");
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteLinkConfirm({ id: l.id, nome: `${l.nome_usuario} → ${l.unidade_nome}` })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination
                        currentPage={linksControls.currentPage}
                        totalPages={linksControls.totalPages}
                        itemsPerPage={linksControls.itemsPerPage}
                        onPageChange={linksControls.setCurrentPage}
                        onItemsPerPageChange={linksControls.setItemsPerPage}
                        totalItems={linksControls.filteredData.length}
                      />
                    </>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de novo gestor */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Gestor de Estoque
            </DialogTitle>
            <DialogDescription>
              Apenas usuários com acesso ao módulo de estoque são listados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuário *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum usuário disponível com acesso ao módulo de estoque
                    </div>
                  ) : (
                    availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-muted-foreground text-xs">({u.email})</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedUser && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedUser.email}
                </p>
              )}
            </div>
            <div>
              <Label>Unidade *</Label>
              <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de vincular usuário */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { if (!open) closeLinkDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vincular Usuário a Unidade
            </DialogTitle>
            <DialogDescription>
              O usuário poderá solicitar materiais apenas das unidades vinculadas. O setor identifica onde entregar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuário *</Label>
              <Select value={linkForm.user_id} onValueChange={(v) => setLinkForm({ ...linkForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                <SelectContent>
                  {systemUsers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum usuário com acesso ao estoque
                    </div>
                  ) : (
                    systemUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-muted-foreground text-xs">({u.email})</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade *</Label>
              <Select value={linkForm.unidade_id} onValueChange={(v) => setLinkForm({ ...linkForm, unidade_id: v, setor_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Setor *</Label>
              <Select value={linkForm.setor_id} onValueChange={(v) => setLinkForm({ ...linkForm, setor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {setoresFiltrados.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum setor ativo cadastrado
                    </div>
                  ) : (
                    setoresFiltrados.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Setores são cadastrados no módulo de Férias. Apenas setores ativos aparecem aqui.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeLinkDialog}>Cancelar</Button>
            <Button onClick={handleLinkSubmit} disabled={saveLinkMutation.isPending}>
              {saveLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de editar setor */}
      <Dialog open={!!editLinkDialog} onOpenChange={(open) => { if (!open) setEditLinkDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Setor</DialogTitle>
            <DialogDescription>
              Alterar o setor do vínculo: <strong>{editLinkDialog?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Novo Setor *</Label>
              <Select value={editSetorId} onValueChange={setEditSetorId}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {setoresFiltradosEdit.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLinkDialog(null)}>Cancelar</Button>
            <Button onClick={handleEditSetorSubmit} disabled={updateSetorMutation.isPending}>
              {updateSetorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de gestor */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteConfirm?.nome}</strong> como gestor? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão de vínculo */}
      <AlertDialog open={!!deleteLinkConfirm} onOpenChange={(open) => { if (!open) setDeleteLinkConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o vínculo <strong>{deleteLinkConfirm?.nome}</strong>? O usuário perderá acesso a esta unidade no estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLinkConfirm && deleteLinkMutation.mutate(deleteLinkConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
