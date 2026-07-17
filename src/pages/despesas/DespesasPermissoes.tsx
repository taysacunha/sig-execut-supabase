import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldAlert } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import type { DespesasAba, DespesasNivel } from "@/hooks/useDespesasPermissions";

const ABAS: { key: DespesasAba; label: string }[] = [
  { key: "calendario", label: "Calendário" },
  { key: "imoveis", label: "Imóveis" },
  { key: "repasses", label: "Repasses" },
  { key: "cadastros", label: "Cadastros" },
];

const NIVEIS: { value: DespesasNivel; label: string }[] = [
  { value: "sem_acesso", label: "Sem acesso" },
  { value: "view", label: "Visualizar" },
  { value: "edit", label: "Editar" },
  { value: "delete", label: "Excluir" },
];

interface UserRow { user_id: string; email: string; name: string | null; }

export default function DespesasPermissoes() {
  const { role, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const isAdmin = role === "admin" || role === "super_admin";

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["despesas-permissoes-users"],
    queryFn: async (): Promise<UserRow[]> => {
      const { data: authData } = await supabase.functions.invoke("list-users");
      const authUsers: any[] = authData?.users ?? [];
      const { data: profiles } = await supabase.from("user_profiles").select("id, name");
      const nameById: Record<string, string | null> = {};
      (profiles ?? []).forEach((p: any) => { nameById[p.id] = p.name; });
      return authUsers.map((u) => ({
        user_id: u.id,
        email: u.email ?? "",
        name: nameById[u.id] ?? null,
      }));
    },
    enabled: isAdmin,
  });

  const { data: perms = [], isLoading: permsLoading } = useQuery({
    queryKey: ["despesas-aba-permissoes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_aba_permissoes" as any)
        .select("user_id, aba, nivel");
      if (error) throw error;
      return (data ?? []) as unknown as { user_id: string; aba: DespesasAba; nivel: DespesasNivel }[];
    },
    enabled: isAdmin,
  });

  const { data: centros = [] } = useQuery({
    queryKey: ["despesas-centros-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_centros_custo" as any)
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string }[];
    },
    enabled: isAdmin,
  });

  const { data: ccPerms = [] } = useQuery({
    queryKey: ["despesas-cc-perms-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_centros_custo_permissoes" as any)
        .select("user_id, centro_custo_id");
      if (error) throw error;
      return (data ?? []) as unknown as { user_id: string; centro_custo_id: string }[];
    },
    enabled: isAdmin,
  });

  const permMap = useMemo(() => {
    const m: Record<string, Partial<Record<DespesasAba, DespesasNivel>>> = {};
    perms.forEach((p) => { m[p.user_id] = { ...(m[p.user_id] ?? {}), [p.aba]: p.nivel }; });
    return m;
  }, [perms]);

  const ccMap = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    ccPerms.forEach((p) => { (m[p.user_id] = m[p.user_id] ?? new Set()).add(p.centro_custo_id); });
    return m;
  }, [ccPerms]);

  const upsertNivel = useMutation({
    mutationFn: async ({ user_id, aba, nivel }: { user_id: string; aba: DespesasAba; nivel: DespesasNivel }) => {
      const { error } = await supabase
        .from("despesas_aba_permissoes" as any)
        .upsert({ user_id, aba, nivel }, { onConflict: "user_id,aba" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissão atualizada");
      qc.invalidateQueries({ queryKey: ["despesas-aba-permissoes-all"] });
      qc.invalidateQueries({ queryKey: ["despesas-aba-permissoes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const toggleCentro = useMutation({
    mutationFn: async ({ user_id, centro_custo_id, ativo }: { user_id: string; centro_custo_id: string; ativo: boolean }) => {
      if (ativo) {
        const { error } = await supabase
          .from("despesas_centros_custo_permissoes" as any)
          .insert({ user_id, centro_custo_id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas_centros_custo_permissoes" as any)
          .delete()
          .eq("user_id", user_id)
          .eq("centro_custo_id", centro_custo_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas-cc-perms-all"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar centro de custo"),
  });

  if (roleLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Apenas administradores podem gerenciar permissões.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const filtered = users.filter((u) =>
    !busca ||
    u.email.toLowerCase().includes(busca.toLowerCase()) ||
    (u.name ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Permissões — Despesas</h1>
        <p className="text-muted-foreground">
          Defina o nível de cada usuário por aba. Ocultar uma aba = "Sem acesso". Restrinja centros de custo abaixo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Níveis por aba</CardTitle>
          <CardDescription>Sem acesso, Visualizar, Editar (inclui criar) ou Excluir (nível máximo).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por nome ou email…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-sm"
          />
          {usersLoading || permsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    {ABAS.map((a) => <TableHead key={a.key}>{a.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="font-medium">{u.name ?? u.email}</div>
                        {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                      </TableCell>
                      {ABAS.map((a) => {
                        const nivel = permMap[u.user_id]?.[a.key] ?? "sem_acesso";
                        return (
                          <TableCell key={a.key}>
                            <Select
                              value={nivel}
                              onValueChange={(v) =>
                                upsertNivel.mutate({ user_id: u.user_id, aba: a.key, nivel: v as DespesasNivel })
                              }
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {NIVEIS.map((n) => (
                                  <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Centros de custo permitidos por usuário</CardTitle>
          <CardDescription>
            Se um usuário não marcar nenhum, ele enxerga <b>todos</b> os centros ativos. Marcar restringe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {centros.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre centros de custo na aba Cadastros para poder atribuí-los aqui.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    {centros.map((c) => <TableHead key={c.id}>{c.nome}</TableHead>)}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const set = ccMap[u.user_id] ?? new Set<string>();
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.name ?? u.email}</TableCell>
                        {centros.map((c) => (
                          <TableCell key={c.id}>
                            <Checkbox
                              checked={set.has(c.id)}
                              onCheckedChange={(v) =>
                                toggleCentro.mutate({ user_id: u.user_id, centro_custo_id: c.id, ativo: !!v })
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          {set.size === 0
                            ? <Badge variant="outline">Todos</Badge>
                            : <Badge>{set.size} centro(s)</Badge>}
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
    </div>
  );
}