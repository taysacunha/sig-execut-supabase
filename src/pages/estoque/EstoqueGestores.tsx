import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Building2, UserPlus, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";

interface Gestor {
  id: string;
  user_id: string;
  unidade_id: string;
  nome_gestor: string;
  created_at: string;
}

interface Unidade {
  id: string;
  nome: string;
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

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_unidades").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  const { data: gestores = [], isLoading } = useQuery({
    queryKey: ["estoque-gestores"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_gestores").select("*").order("nome_gestor");
      if (error) throw error;
      return (data || []) as unknown as Gestor[];
    },
  });

  // Fetch system users via edge function (same as UserManagement)
  const { data: systemUsers = [] } = useQuery({
    queryKey: ["system-users-for-gestores"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-users");
      if (error) throw error;
      const users = data?.users || [];
      return users.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name || u.user_metadata?.name || u.email,
      })) as SystemUser[];
    },
    enabled: canManage,
  });

  // Filter out users already added as gestores
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
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setForm({ user_id: "", unidade_id: "" });
  };

  const handleSubmit = () => {
    if (!form.user_id) return toast.error("Selecione um usuário");
    if (!form.unidade_id) return toast.error("Selecione a unidade");
    saveMutation.mutate(form);
  };

  // Find user email/name for display in table
  const getUserDisplay = (userId: string) => {
    const user = systemUsers.find((u) => u.id === userId);
    return user?.email || "";
  };

  const gestoresByUnidade = unidades
    .map((u) => ({
      unidade: u,
      gestores: gestores.filter((g) => g.unidade_id === u.id),
    }))
    .filter((g) => g.gestores.length > 0);

  const unidadesSemGestor = unidades.filter((u) => !gestores.some((g) => g.unidade_id === u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestores de Estoque</h1>
          <p className="text-muted-foreground">Defina quem gerencia o estoque de cada unidade</p>
        </div>
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
          {gestoresByUnidade.map(({ unidade, gestores: gs }) => (
            <Card key={unidade.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> {unidade.nome}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      {canManage && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gs.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.nome_gestor}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {getUserDisplay(g.user_id)}
                          </span>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(g.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

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

          {gestores.length === 0 && unidadesSemGestor.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma unidade cadastrada. Cadastre unidades no módulo de Férias.
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Gestor de Estoque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuário *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Todos os usuários já são gestores
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
    </div>
  );
}
