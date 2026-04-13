import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { RoleGuard } from "@/components/RoleGuard";
import { toast } from "sonner";
import { Loader2, Shield, Crown, Briefcase, UserPlus, Mail, Ban, Trash2, RefreshCw, Calendar, TrendingUp, User, Eye, Edit, Pencil, History, Users, Package } from "lucide-react";
import { AuditLogsPanel } from "@/components/AuditLogsPanel";
import { useTableControls } from "@/hooks/useTableControls";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SystemRole = "super_admin" | "admin" | "manager" | "supervisor" | "collaborator";
type SystemName = "escalas" | "vendas" | "ferias" | "estoque";
type PermissionType = "view_only" | "view_edit";

interface SystemAccess {
  system_name: SystemName;
  permission_type: PermissionType;
}

interface UserWithRole {
  id: string;
  email: string;
  name: string | null;
  role: SystemRole | null;
  created_at: string;
  banned_until?: string | null;
  confirmed?: boolean;
  systems: SystemAccess[];
}

const roleLabels: Record<SystemRole, string> = {
  super_admin: "Super Administrador",
  admin: "Administrador",
  manager: "Gerente",
  supervisor: "Supervisor",
  collaborator: "Colaborador",
};

const roleIcons: Record<SystemRole, React.ReactNode> = {
  super_admin: <Crown className="h-4 w-4" />,
  admin: <Crown className="h-4 w-4" />,
  manager: <Briefcase className="h-4 w-4" />,
  supervisor: <Briefcase className="h-4 w-4" />,
  collaborator: <User className="h-4 w-4" />,
};

const roleColors: Record<SystemRole, string> = {
  super_admin: "bg-purple-600 text-white",
  admin: "bg-destructive text-destructive-foreground",
  manager: "bg-primary text-primary-foreground",
  supervisor: "bg-blue-600 text-white",
  collaborator: "bg-secondary text-secondary-foreground",
};

const systemLabels: Record<SystemName, string> = {
  escalas: "Escalas",
  vendas: "Vendas",
  ferias: "Férias e Folgas",
  estoque: "Estoques",
};

const systemIcons: Record<SystemName, React.ReactNode> = {
  escalas: <Calendar className="h-3 w-3" />,
  vendas: <TrendingUp className="h-3 w-3" />,
  ferias: <Calendar className="h-3 w-3" />,
  estoque: <Package className="h-3 w-3" />,
};

const permissionLabels: Record<PermissionType, string> = {
  view_only: "Visualização",
  view_edit: "Edição",
};

const permissionIcons: Record<PermissionType, React.ReactNode> = {
  view_only: <Eye className="h-3 w-3" />,
  view_edit: <Edit className="h-3 w-3" />,
};

const roleHierarchy: Record<SystemRole, number> = {
  super_admin: 1,
  admin: 2,
  manager: 3,
  supervisor: 4,
  collaborator: 5,
};

function UserManagementContent() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updatingSystems, setUpdatingSystems] = useState<string | null>(null);
  const { user: currentUser, role: currentRole, isSuperAdmin, canManageRole } = useUserRole();
  
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SystemRole>("collaborator");
  const [inviteSystems, setInviteSystems] = useState<SystemAccess[]>([
    { system_name: "escalas", permission_type: "view_edit" }
  ]);
  const [inviting, setInviting] = useState(false);

  const [deactivateUser, setDeactivateUser] = useState<UserWithRole | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit user state
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [editRole, setEditRole] = useState<SystemRole>("collaborator");
  const [editSystems, setEditSystems] = useState<SystemAccess[]>([]);
  const [editingUser, setEditingUser] = useState(false);

  const availableRoles: SystemRole[] = isSuperAdmin 
    ? ["super_admin", "admin", "manager", "supervisor", "collaborator"]
    : ["admin", "manager", "supervisor", "collaborator"];

  // Table controls for users
  const {
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortField,
    sortDirection,
    setSorting,
    paginatedData: paginatedUsers,
    filteredData: filteredUsers,
    totalPages,
  } = useTableControls({
    data: users,
    searchField: ["name", "email"],
    defaultItemsPerPage: 20,
  });

  const fetchUsers = async () => {
    try {
      const { data: authData, error: authError } = await supabase.functions.invoke("list-users");
      if (authError) console.error("Error fetching auth users:", authError);
      
      const authUsers = authData?.users || [];

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at");
      if (rolesError) throw rolesError;

      const { data: systemsData, error: systemsError } = await supabase
        .from("system_access")
        .select("user_id, system_name, permission_type");
      if (systemsError) throw systemsError;

      // Index roles and systems by user_id
      const rolesByUserId: Record<string, { role: string; created_at: string }> = {};
      (rolesData || []).forEach((ur: any) => {
        rolesByUserId[ur.user_id] = { role: ur.role, created_at: ur.created_at };
      });

      const systemsByUser: Record<string, SystemAccess[]> = {};
      (systemsData || []).forEach((sa: any) => {
        if (!systemsByUser[sa.user_id]) systemsByUser[sa.user_id] = [];
        systemsByUser[sa.user_id].push({
          system_name: sa.system_name as SystemName,
          permission_type: (sa.permission_type || 'view_edit') as PermissionType,
        });
      });

      // Use authUsers as the source of truth - this shows ALL users including pending ones
      const usersWithRoles: UserWithRole[] = authUsers.map((au: any) => {
        const roleInfo = rolesByUserId[au.id];
        return {
          id: au.id,
          email: au.email || `Usuário ${au.id.slice(0, 8)}...`,
          name: au.name || null,
          role: (roleInfo?.role as SystemRole) || null,
          created_at: roleInfo?.created_at || au.created_at || new Date().toISOString(),
          confirmed: au.confirmed ?? false,
          systems: systemsByUser[au.id] || [],
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [currentUser]);

  const handleRoleChange = async (userId: string, newRole: SystemRole) => {
    if (userId === currentUser?.id) {
      toast.error("Você não pode alterar seu próprio perfil");
      return;
    }
    setUpdating(userId);
    try {
      const { error } = await supabase.rpc("set_user_role", {
        _target_user_id: userId,
        _new_role: newRole,
      });
      if (error) throw error;
      toast.success(`Perfil atualizado para ${roleLabels[newRole]}`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar perfil");
    } finally {
      setUpdating(null);
    }
  };

  const handleSystemAccessChange = async (userId: string, system: SystemName, hasAccess: boolean, permissionType: PermissionType = 'view_edit') => {
    setUpdatingSystems(userId);
    try {
      if (hasAccess) {
        const { error } = await supabase
          .from("system_access")
          .upsert({ user_id: userId, system_name: system, permission_type: permissionType }, { onConflict: 'user_id,system_name' });
        if (error) throw error;
        toast.success(`Acesso ao ${systemLabels[system]} atualizado`);
      } else {
        const { error } = await supabase
          .from("system_access")
          .delete()
          .eq("user_id", userId)
          .eq("system_name", system);
        if (error) throw error;
        toast.success(`Acesso ao ${systemLabels[system]} removido`);
      }
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar acesso");
    } finally {
      setUpdatingSystems(null);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteName.trim()) { toast.error("Informe o nome do usuário"); return; }
    if (!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) { toast.error("Email inválido"); return; }
    if (inviteSystems.length === 0) { toast.error("Selecione ao menos um sistema"); return; }

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim(),
          role: inviteRole,
          systems: inviteSystems,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(data.message || `Usuário ${inviteEmail} convidado!`);
      setInviteName(""); setInviteEmail(""); setInviteRole("collaborator");
      setInviteSystems([{ system_name: "escalas", permission_type: "view_edit" }]);
      setInviteOpen(false);
      fetchUsers();
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("rate limit") || msg.includes("Limite de envio") || msg.includes("limite")) {
        toast.error("Limite de emails atingido. Aguarde alguns minutos e tente novamente.");
      } else {
        toast.error(msg || "Erro ao convidar usuário");
      }
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (user: UserWithRole) => {
    if (user.confirmed) { toast.error("Usuário já está ativo"); return; }
    setResendingInvite(user.id);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { user_id: user.id, role: user.role, resend: true },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Convite reenviado!");
      fetchUsers();
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("rate limit") || msg.includes("Limite de envio") || msg.includes("limite")) {
        toast.error("Limite de emails atingido. Aguarde alguns minutos e tente novamente.");
      } else {
        toast.error(msg || "Erro ao reenviar convite");
      }
    } finally {
      setResendingInvite(null);
    }
  };

  const handleDeactivateUser = async () => {
    if (!deactivateUser) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { userId: deactivateUser.id, action: "deactivate" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Usuário desativado");
      setDeactivateUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao desativar usuário");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { userId: deleteUser.id, action: "delete" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Usuário removido");
      setDeleteUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover usuário");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleInviteSystem = (system: SystemName, permission: PermissionType) => {
    setInviteSystems(prev => {
      const existing = prev.find(s => s.system_name === system);
      if (existing) {
        if (existing.permission_type === permission) {
          return prev.filter(s => s.system_name !== system);
        }
        return prev.map(s => s.system_name === system ? { ...s, permission_type: permission } : s);
      }
      return [...prev, { system_name: system, permission_type: permission }];
    });
  };

  const toggleEditSystem = (system: SystemName, permission: PermissionType) => {
    setEditSystems(prev => {
      const existing = prev.find(s => s.system_name === system);
      if (existing) {
        if (existing.permission_type === permission) {
          return prev.filter(s => s.system_name !== system);
        }
        return prev.map(s => s.system_name === system ? { ...s, permission_type: permission } : s);
      }
      return [...prev, { system_name: system, permission_type: permission }];
    });
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditUser(user);
    setEditName(user.name || "");
    setEditEmail(user.email);
    setEditPassword("");
    setEditPasswordConfirm("");
    setEditRole(user.role || "collaborator");
    setEditSystems(user.systems || []);
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    if (!editName.trim()) { toast.error("Informe o nome do usuário"); return; }
    if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) { toast.error("Email inválido"); return; }

    const isSelfEdit = editUser.id === currentUser?.id;

    // Validar senha se preenchida
    if (editPassword) {
      if (editPassword.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }
      if (editPassword !== editPasswordConfirm) {
        toast.error("As senhas não coincidem");
        return;
      }
    }

    setEditingUser(true);
    try {
      // 1. Update email if changed (via edge function)
      if (editEmail.trim().toLowerCase() !== editUser.email.toLowerCase()) {
        const { data, error: emailError } = await supabase.functions.invoke("manage-user", {
          body: { userId: editUser.id, action: "update_email", email: editEmail.trim().toLowerCase() },
        });
        if (emailError) throw emailError;
        if (data?.error) throw new Error(data.error);
      }

      // 2. Update password if provided - APENAS para o próprio usuário
      if (isSelfEdit && editPassword) {
        // Usar supabase.auth.updateUser para o próprio usuário (mais seguro)
        const { error: pwdError } = await supabase.auth.updateUser({
          password: editPassword,
        });
        if (pwdError) throw pwdError;
      }

      // 3. Update name in user_profiles
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({ user_id: editUser.id, name: editName.trim() }, { onConflict: 'user_id' });
      if (profileError) throw profileError;

      // 4. Update role if changed (não permitir auto-edição de role)
      if (!isSelfEdit && editRole !== editUser.role) {
        const { error: roleError } = await supabase.rpc("set_user_role", {
          _target_user_id: editUser.id,
          _new_role: editRole,
        });
        if (roleError) throw roleError;
      }

      // 5. Update systems - delete all and insert new (não permitir auto-edição de sistemas)
      if (!isSelfEdit) {
        const { error: deleteError } = await supabase
          .from("system_access")
          .delete()
          .eq("user_id", editUser.id);
        if (deleteError) throw deleteError;

        if (editSystems.length > 0) {
          const { error: insertError } = await supabase
            .from("system_access")
            .insert(editSystems.map(sys => ({
              user_id: editUser.id,
              system_name: sys.system_name,
              permission_type: sys.permission_type,
            })));
          if (insertError) throw insertError;
        }
      }

      toast.success(isSelfEdit ? "Seu perfil foi atualizado!" : "Usuário atualizado com sucesso!");
      setEditUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar usuário");
    } finally {
      setEditingUser(false);
    }
  };

  const canManageUser = (user: UserWithRole): boolean => {
    if (!user.role) return true;
    return canManageRole(user.role as AppRole);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground">Gerencie perfis e acessos dos usuários.</p>
          </div>
          
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-2" />Adicionar Usuário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                <DialogDescription>O usuário receberá um email para definir sua senha.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" placeholder="Nome completo" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="usuario@empresa.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="pl-10" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as SystemRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableRoles.map(r => (
                        <SelectItem key={r} value={r}>
                          <span className="flex items-center gap-2">{roleIcons[r]}{roleLabels[r]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sistemas e Permissões</Label>
                  {(["escalas", "vendas", "ferias", "estoque"] as SystemName[]).map(sys => {
                    const access = inviteSystems.find(s => s.system_name === sys);
                    return (
                      <div key={sys} className="flex items-center gap-3 p-2 border rounded">
                        <Checkbox checked={!!access} onCheckedChange={(checked) => {
                          if (checked) toggleInviteSystem(sys, 'view_edit');
                          else setInviteSystems(prev => prev.filter(s => s.system_name !== sys));
                        }} />
                        <span className="flex items-center gap-1 text-sm">{systemIcons[sys]}{systemLabels[sys]}</span>
                        {access && (
                          <Select value={access.permission_type} onValueChange={(v) => toggleInviteSystem(sys, v as PermissionType)}>
                            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view_only"><span className="flex items-center gap-1">{permissionIcons.view_only}Visualização</span></SelectItem>
                              <SelectItem value="view_edit"><span className="flex items-center gap-1">{permissionIcons.view_edit}Edição</span></SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancelar</Button>
                <Button onClick={handleInviteUser} disabled={inviting}>
                  {inviting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adicionando...</> : <><UserPlus className="h-4 w-4 mr-2" />Adicionar</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Logs de Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Usuários</CardTitle>
                    <CardDescription>Gerencie perfis e permissões de acesso.</CardDescription>
                  </div>
                  <TableSearch 
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Buscar por nome ou email..."
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortableHeader
                          label="Nome"
                          field="name"
                          currentField={sortField}
                          direction={sortDirection}
                          onSort={setSorting}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHeader
                          label="Email"
                          field="email"
                          currentField={sortField}
                          direction={sortDirection}
                          onSort={setSorting}
                        />
                      </TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Sistemas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedUsers.map((user) => {
                        const isSelf = user.id === currentUser?.id;
                        const canManage = canManageUser(user);
                        const canFullEdit = canManage && !isSelf;
                        const canSelfEdit = isSelf;
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.name || <span className="text-muted-foreground italic">Sem nome</span>}
                              {user.id === currentUser?.id && <Badge variant="outline" className="ml-2">Você</Badge>}
                              {!user.confirmed && user.id !== currentUser?.id && <Badge variant="outline" className="ml-2 text-orange-500 border-orange-500">Pendente</Badge>}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              {canManage ? (
                                <Select value={user.role || ""} onValueChange={(v) => handleRoleChange(user.id, v as SystemRole)} disabled={updating === user.id}>
                                  <SelectTrigger className="w-[180px]">
                                    {updating === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableRoles.filter(r => canManageRole(r as AppRole)).map(r => (
                                      <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : user.role ? (
                                <Badge className={roleColors[user.role]}><span className="flex items-center gap-1">{roleIcons[user.role]}{roleLabels[user.role]}</span></Badge>
                              ) : <Badge variant="outline">Sem perfil</Badge>}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.systems.map(sys => (
                                  <Badge key={sys.system_name} variant="secondary" className="text-xs">
                                    <span className="flex items-center gap-1">
                                      {systemIcons[sys.system_name]}
                                      {systemLabels[sys.system_name]}
                                      <span className="ml-1 opacity-70">({sys.permission_type === 'view_only' ? 'Ver' : 'Editar'})</span>
                                    </span>
                                  </Badge>
                                ))}
                                {user.systems.length === 0 && <span className="text-xs text-muted-foreground">Nenhum</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {(canFullEdit || canSelfEdit) ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)}><Pencil className="h-4 w-4" /></Button>
                                  </TooltipTrigger><TooltipContent>{canSelfEdit && !canFullEdit ? "Editar meu perfil" : "Editar"}</TooltipContent></Tooltip>
                                  {canFullEdit && !user.confirmed && (
                                    <Tooltip><TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleResendInvite(user)} disabled={resendingInvite === user.id}>
                                        {resendingInvite === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                      </Button>
                                    </TooltipTrigger><TooltipContent>Reenviar convite</TooltipContent></Tooltip>
                                  )}
                                  {canFullEdit && (
                                    <>
                                      <Tooltip><TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => setDeactivateUser(user)}><Ban className="h-4 w-4" /></Button>
                                      </TooltipTrigger><TooltipContent>Desativar</TooltipContent></Tooltip>
                                      <Tooltip><TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteUser(user)}><Trash2 className="h-4 w-4" /></Button>
                                      </TooltipTrigger><TooltipContent>Remover</TooltipContent></Tooltip>
                                    </>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  totalItems={filteredUsers.length}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <AuditLogsPanel defaultModule="sistema" defaultTab="admin" />
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!deactivateUser} onOpenChange={(open) => !open && setDeactivateUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar Usuário</AlertDialogTitle>
              <AlertDialogDescription>Desativar <strong>{deactivateUser?.name || deactivateUser?.email}</strong>? Ele não poderá mais acessar o sistema.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivateUser} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700">
                {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Remover Usuário</AlertDialogTitle>
              <AlertDialogDescription>Remover permanentemente <strong>{deleteUser?.name || deleteUser?.email}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90">
                {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit User Dialog */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editUser?.id === currentUser?.id ? "Editar Meu Perfil" : "Editar Usuário"}</DialogTitle>
              <DialogDescription>
                {editUser?.id === currentUser?.id 
                  ? "Atualize seu nome, email e senha. Você não pode alterar sua própria role ou acessos."
                  : `Atualize as informações de ${editUser?.email}`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Nome *</Label>
                <Input id="editName" placeholder="Nome completo" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmail">E-mail *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="editEmail" type="email" placeholder="usuario@empresa.com" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="pl-10" />
                </div>
                </div>

              {/* Campos de senha - APENAS para edição do próprio usuário */}
              {editUser?.id === currentUser?.id && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="editPassword">Nova Senha (deixe em branco para manter)</Label>
                    <Input 
                      id="editPassword" 
                      type="password"
                      placeholder="••••••••" 
                      value={editPassword} 
                      onChange={(e) => setEditPassword(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPasswordConfirm">Confirmar Nova Senha</Label>
                    <Input 
                      id="editPasswordConfirm" 
                      type="password"
                      placeholder="••••••••" 
                      value={editPasswordConfirm} 
                      onChange={(e) => setEditPasswordConfirm(e.target.value)} 
                    />
                  </div>
                </>
              )}
              
              {/* Perfil e Sistemas - desabilitados para auto-edição */}
              {editUser?.id !== currentUser?.id && (
                <>
                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    <Select value={editRole} onValueChange={(v) => setEditRole(v as SystemRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableRoles.filter(r => canManageRole(r as AppRole)).map(r => (
                          <SelectItem key={r} value={r}>
                            <span className="flex items-center gap-2">{roleIcons[r]}{roleLabels[r]}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Sistemas e Permissões</Label>
                    {(["escalas", "vendas", "ferias", "estoque"] as SystemName[]).map(sys => {
                      const access = editSystems.find(s => s.system_name === sys);
                      return (
                        <div key={sys} className="flex items-center gap-3 p-2 border rounded">
                          <Checkbox checked={!!access} onCheckedChange={(checked) => {
                            if (checked) toggleEditSystem(sys, 'view_edit');
                            else setEditSystems(prev => prev.filter(s => s.system_name !== sys));
                          }} />
                          <span className="flex items-center gap-1 text-sm">{systemIcons[sys]}{systemLabels[sys]}</span>
                          {access && (
                            <Select value={access.permission_type} onValueChange={(v) => toggleEditSystem(sys, v as PermissionType)}>
                              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="view_only"><span className="flex items-center gap-1">{permissionIcons.view_only}Visualização</span></SelectItem>
                                <SelectItem value="view_edit"><span className="flex items-center gap-1">{permissionIcons.view_edit}Edição</span></SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              
              {editUser?.id === currentUser?.id && (
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <p>Por segurança, você não pode alterar sua própria role ou acessos ao sistema.</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)} disabled={editingUser}>Cancelar</Button>
              <Button onClick={handleEditUser} disabled={editingUser}>
                {editingUser ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default function UserManagement() {
  return (
    <RoleGuard allowedRoles={["super_admin", "admin"]}>
      <UserManagementContent />
    </RoleGuard>
  );
}
