import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ShieldAlert, Info, RefreshCw, Users, Check, X, Wand2 } from "lucide-react";
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

const NIVEL_ORDEM: Record<DespesasNivel, number> = { sem_acesso: 0, view: 1, edit: 2, delete: 3 };

const PERFIS_RAPIDOS: Record<string, { label: string; niveis: Record<DespesasAba, DespesasNivel> }> = {
  visualizador: {
    label: "Visualizador financeiro (view em tudo)",
    niveis: { calendario: "view", imoveis: "view", repasses: "view", cadastros: "view" },
  },
  operador: {
    label: "Operador de contas (edit no operacional)",
    niveis: { calendario: "edit", imoveis: "edit", repasses: "edit", cadastros: "view" },
  },
  administrador: {
    label: "Administrador de despesas (excluir em tudo)",
    niveis: { calendario: "delete", imoveis: "delete", repasses: "delete", cadastros: "delete" },
  },
  revogar: {
    label: "Revogar acesso (sem acesso em tudo)",
    niveis: { calendario: "sem_acesso", imoveis: "sem_acesso", repasses: "sem_acesso", cadastros: "sem_acesso" },
  },
};

interface UserRow { user_id: string; email: string; name: string | null; }

type FiltroAcesso = "todos" | "com" | "sem";

export default function DespesasPermissoes() {
  const { role, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || role === "super_admin";

  const [busca, setBusca] = useState("");
  const [filtroAcesso, setFiltroAcesso] = useState<FiltroAcesso>("todos");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
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
        .select("id, nome").eq("is_active", true).order("nome");
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

  const { data: acessoModulo = new Set<string>() } = useQuery({
    queryKey: ["despesas-system-access"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_access")
        .select("user_id")
        .eq("system_name", "despesas");
      return new Set<string>((data ?? []).map((r: any) => r.user_id));
    },
    enabled: isAdmin,
  });

  const { data: rolesMap = {} } = useQuery({
    queryKey: ["despesas-user-roles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((r: any) => { (map[r.user_id] = map[r.user_id] ?? []).push(r.role); });
      return map;
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

  function temAcessoModulo(uid: string) {
    const rs = rolesMap[uid] ?? [];
    if (rs.includes("super_admin") || rs.includes("admin")) return true;
    return acessoModulo.has(uid);
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (busca) {
        const q = busca.toLowerCase();
        if (!u.email.toLowerCase().includes(q) && !(u.name ?? "").toLowerCase().includes(q)) return false;
      }
      if (filtroAcesso === "com" && !temAcessoModulo(u.user_id)) return false;
      if (filtroAcesso === "sem" && temAcessoModulo(u.user_id)) return false;
      return true;
    });
  }, [users, busca, filtroAcesso, rolesMap, acessoModulo]);

  const comAcessoCount = users.filter((u) => temAcessoModulo(u.user_id)).length;

  // ------- Mutations -------

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
        const { error } = await supabase.from("despesas_centros_custo_permissoes" as any)
          .insert({ user_id, centro_custo_id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas_centros_custo_permissoes" as any)
          .delete().eq("user_id", user_id).eq("centro_custo_id", centro_custo_id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["despesas-cc-perms-all"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar centro"),
  });

  const lote = useMutation({
    mutationFn: async ({ userIds, abas, nivel }: { userIds: string[]; abas: DespesasAba[]; nivel: DespesasNivel }) => {
      const rows = userIds.flatMap((uid) => abas.map((aba) => ({ user_id: uid, aba, nivel })));
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("despesas_aba_permissoes" as any)
        .upsert(rows, { onConflict: "user_id,aba" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count ?? 0} permissão(ões) atualizada(s)`);
      qc.invalidateQueries({ queryKey: ["despesas-aba-permissoes-all"] });
      qc.invalidateQueries({ queryKey: ["despesas-aba-permissoes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro no lote"),
  });

  const loteCentros = useMutation({
    mutationFn: async ({ userIds, centroId, acao }: { userIds: string[]; centroId: string; acao: "add" | "remove" }) => {
      if (acao === "add") {
        const rows = userIds.map((uid) => ({ user_id: uid, centro_custo_id: centroId }));
        const { error } = await supabase
          .from("despesas_centros_custo_permissoes" as any)
          .upsert(rows, { onConflict: "user_id,centro_custo_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas_centros_custo_permissoes" as any)
          .delete()
          .in("user_id", userIds)
          .eq("centro_custo_id", centroId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Centros atualizados");
      qc.invalidateQueries({ queryKey: ["despesas-cc-perms-all"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro no lote de centros"),
  });

  // ------- Selection helpers -------

  function toggleSel(uid: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }
  function toggleSelAll(target: UserRow[]) {
    const ids = target.map((u) => u.user_id);
    setSelecionados((prev) => {
      const allIn = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  // ------- Batch controls state -------

  const [batchAba, setBatchAba] = useState<"todas" | DespesasAba>("todas");
  const [batchNivel, setBatchNivel] = useState<DespesasNivel>("view");
  const [batchCentro, setBatchCentro] = useState<string>("");
  const [batchCentroAcao, setBatchCentroAcao] = useState<"add" | "remove">("add");

  // Assistente
  const [assistUsers, setAssistUsers] = useState<Set<string>>(new Set());
  const [assistPerfil, setAssistPerfil] = useState<string>("visualizador");
  const [assistCentro, setAssistCentro] = useState<string>("__none__");
  const [assistBusca, setAssistBusca] = useState("");

  const filteredAssist = users.filter((u) =>
    !assistBusca ||
    u.email.toLowerCase().includes(assistBusca.toLowerCase()) ||
    (u.name ?? "").toLowerCase().includes(assistBusca.toLowerCase())
  );

  async function aplicarAssistente() {
    if (assistUsers.size === 0) { toast.error("Selecione ao menos um usuário"); return; }
    const perfil = PERFIS_RAPIDOS[assistPerfil];
    const abas = Object.keys(perfil.niveis) as DespesasAba[];
    const rows = Array.from(assistUsers).flatMap((uid) =>
      abas.map((aba) => ({ user_id: uid, aba, nivel: perfil.niveis[aba] }))
    );
    const { error } = await supabase
      .from("despesas_aba_permissoes" as any)
      .upsert(rows, { onConflict: "user_id,aba" });
    if (error) { toast.error(error.message); return; }

    if (assistCentro !== "__none__") {
      const ccRows = Array.from(assistUsers).map((uid) => ({ user_id: uid, centro_custo_id: assistCentro }));
      await supabase
        .from("despesas_centros_custo_permissoes" as any)
        .upsert(ccRows, { onConflict: "user_id,centro_custo_id" });
    }

    toast.success(`Perfil aplicado a ${assistUsers.size} usuário(s)`);
    qc.invalidateQueries({ queryKey: ["despesas-aba-permissoes-all"] });
    qc.invalidateQueries({ queryKey: ["despesas-cc-perms-all"] });
    setAssistUsers(new Set());
  }

  // ------- Render guards -------

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

  const loading = usersLoading || permsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Permissões — Despesas</h1>
        <p className="text-muted-foreground">Controle por usuário o que pode ser visto e editado dentro do módulo.</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription>
          O acesso ao módulo é definido em <b>Usuários → Sistemas</b>. Aqui você define o que cada
          usuário faz <b>dentro</b> do módulo (por aba e centro de custo). Se o acesso ao módulo for removido,
          as permissões ficam guardadas e voltam a valer ao reconceder.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <Input placeholder="Nome ou email…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Acesso ao módulo</label>
            <Select value={filtroAcesso} onValueChange={(v: FiltroAcesso) => setFiltroAcesso(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com acesso</SelectItem>
                <SelectItem value="sem">Sem acesso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            {filtered.length} exibido(s) · {comAcessoCount}/{users.length} com acesso
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchUsers()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="niveis">
        <TabsList>
          <TabsTrigger value="niveis">Níveis por aba</TabsTrigger>
          <TabsTrigger value="centros">Centros de custo</TabsTrigger>
          <TabsTrigger value="assistente"><Wand2 className="h-3 w-3 mr-1" /> Assistente</TabsTrigger>
        </TabsList>

        {/* -------- Aba 1: Níveis -------- */}
        <TabsContent value="niveis" className="space-y-3">
          {selecionados.size > 0 && (
            <Card className="border-primary">
              <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
                <Badge>{selecionados.size} selecionado(s)</Badge>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Aplicar em</label>
                  <Select value={batchAba} onValueChange={(v: any) => setBatchAba(v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as abas</SelectItem>
                      {ABAS.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Nível</label>
                  <Select value={batchNivel} onValueChange={(v: DespesasNivel) => setBatchNivel(v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NIVEIS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => lote.mutate({
                    userIds: Array.from(selecionados),
                    abas: batchAba === "todas" ? ABAS.map((a) => a.key) : [batchAba],
                    nivel: batchNivel,
                  })}
                  disabled={lote.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />Aplicar
                </Button>
                <Button variant="ghost" onClick={() => setSelecionados(new Set())}>
                  <X className="h-4 w-4 mr-2" />Limpar seleção
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox
                            checked={filtered.length > 0 && filtered.every((u) => selecionados.has(u.user_id))}
                            onCheckedChange={() => toggleSelAll(filtered)}
                          />
                        </TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Acesso ao módulo</TableHead>
                        {ABAS.map((a) => <TableHead key={a.key}>{a.label}</TableHead>)}
                        <TableHead>Resumo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((u) => {
                        const perfis = ABAS.map((a) => permMap[u.user_id]?.[a.key] ?? "sem_acesso");
                        const max = perfis.reduce<DespesasNivel>((acc, p) => NIVEL_ORDEM[p] > NIVEL_ORDEM[acc] ? p : acc, "sem_acesso");
                        const totalAtivas = perfis.filter((p) => p !== "sem_acesso").length;
                        const acesso = temAcessoModulo(u.user_id);
                        return (
                          <TableRow key={u.user_id}>
                            <TableCell>
                              <Checkbox
                                checked={selecionados.has(u.user_id)}
                                onCheckedChange={() => toggleSel(u.user_id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{u.name ?? u.email}</div>
                              {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                            </TableCell>
                            <TableCell>
                              {acesso ? (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                  Ativo
                                </Badge>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="cursor-help">Sem acesso</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Conceda acesso em /usuarios para o usuário entrar no módulo.</TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            {ABAS.map((a) => {
                              const nivel = permMap[u.user_id]?.[a.key] ?? "sem_acesso";
                              return (
                                <TableCell key={a.key}>
                                  <Select
                                    value={nivel}
                                    onValueChange={(v) => upsertNivel.mutate({ user_id: u.user_id, aba: a.key, nivel: v as DespesasNivel })}
                                  >
                                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {NIVEIS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              );
                            })}
                            <TableCell>
                              {totalAtivas === 0
                                ? <Badge variant="outline">Nenhuma</Badge>
                                : <Badge>{NIVEIS.find((n) => n.value === max)?.label} em {totalAtivas} aba(s)</Badge>}
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
        </TabsContent>

        {/* -------- Aba 2: Centros -------- */}
        <TabsContent value="centros" className="space-y-3">
          {centros.length === 0 ? (
            <Card><CardContent className="pt-6 text-sm text-muted-foreground">
              Cadastre centros de custo na aba Cadastros para poder atribuí-los aqui.
            </CardContent></Card>
          ) : (
            <>
              {selecionados.size > 0 && (
                <Card className="border-primary">
                  <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
                    <Badge>{selecionados.size} selecionado(s)</Badge>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Ação</label>
                      <Select value={batchCentroAcao} onValueChange={(v: any) => setBatchCentroAcao(v)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="add">Adicionar centro</SelectItem>
                          <SelectItem value="remove">Remover centro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Centro</label>
                      <Select value={batchCentro} onValueChange={setBatchCentro}>
                        <SelectTrigger className="w-60"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                        <SelectContent>
                          {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      disabled={!batchCentro || loteCentros.isPending}
                      onClick={() => loteCentros.mutate({
                        userIds: Array.from(selecionados), centroId: batchCentro, acao: batchCentroAcao,
                      })}
                    >
                      <Check className="h-4 w-4 mr-2" />Aplicar
                    </Button>
                    <Button variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">
                            <Checkbox
                              checked={filtered.length > 0 && filtered.every((u) => selecionados.has(u.user_id))}
                              onCheckedChange={() => toggleSelAll(filtered)}
                            />
                          </TableHead>
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
                              <TableCell>
                                <Checkbox
                                  checked={selecionados.has(u.user_id)}
                                  onCheckedChange={() => toggleSel(u.user_id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{u.name ?? u.email}</TableCell>
                              {centros.map((c) => (
                                <TableCell key={c.id}>
                                  <Checkbox
                                    checked={set.has(c.id)}
                                    onCheckedChange={(v) => toggleCentro.mutate({
                                      user_id: u.user_id, centro_custo_id: c.id, ativo: !!v,
                                    })}
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
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* -------- Aba 3: Assistente -------- */}
        <TabsContent value="assistente" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Assistente de perfis</CardTitle>
              <CardDescription>Selecione usuários, escolha um perfil e aplique em lote.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Perfil</label>
                  <Select value={assistPerfil} onValueChange={setAssistPerfil}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERFIS_RAPIDOS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                    {Object.entries(PERFIS_RAPIDOS[assistPerfil].niveis).map(([aba, nivel]) => (
                      <div key={aba}>
                        <b>{ABAS.find((a) => a.key === aba)?.label}:</b> {NIVEIS.find((n) => n.value === nivel)?.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Centro de custo (opcional)</label>
                  <Select value={assistCentro} onValueChange={setAssistCentro}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não alterar centros</SelectItem>
                      {centros.map((c) => <SelectItem key={c.id} value={c.id}>Adicionar “{c.nome}”</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Usuários ({assistUsers.size} selecionado{assistUsers.size === 1 ? "" : "s"})</label>
                <Input placeholder="Buscar…" value={assistBusca} onChange={(e) => setAssistBusca(e.target.value)} />
                <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                  {filteredAssist.map((u) => {
                    const checked = assistUsers.has(u.user_id);
                    return (
                      <label key={u.user_id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => {
                            setAssistUsers((prev) => {
                              const next = new Set(prev);
                              next.has(u.user_id) ? next.delete(u.user_id) : next.add(u.user_id);
                              return next;
                            });
                          }}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{u.name ?? u.email}</div>
                          {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                        </div>
                        {!temAcessoModulo(u.user_id) && (
                          <Badge variant="outline" className="text-xs">Sem acesso ao módulo</Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssistUsers(new Set())}>Limpar</Button>
                <Button onClick={aplicarAssistente} disabled={assistUsers.size === 0}>
                  <Wand2 className="h-4 w-4 mr-2" />Aplicar perfil
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}