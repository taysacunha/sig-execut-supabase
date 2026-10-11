import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UserRow { user_id: string; name: string | null; email: string }
interface Props { users: UserRow[]; selected: Set<string>; toggleUser: (id: string) => void; toggleAll: (users: UserRow[]) => void; clearSelection: () => void }

export function ContasPermissoesTab({ users, selected, toggleUser, toggleAll, clearSelection }: Props) {
  const qc = useQueryClient();
  const [contaId, setContaId] = useState("");
  const [acao, setAcao] = useState("add");
  const contas = useQuery({ queryKey: ["despesas-contas-matriz"], queryFn: async () => {
    const { data, error } = await supabase.from("despesas_contas_bancarias").select("id,nome,banco").eq("is_active", true).order("nome");
    if (error) throw error;
    return data;
  }});
  const permissoes = useQuery({ queryKey: ["despesas-contas-permissoes"], queryFn: async () => {
    const { data, error } = await supabase.from("despesas_contas_bancarias_permissoes" as any).select("user_id,conta_bancaria_id");
    if (error) throw error;
    return (data ?? []) as unknown as { user_id: string; conta_bancaria_id: string }[];
  }});
  const salvar = useMutation({ mutationFn: async ({ ids, conta, marcar }: { ids: string[]; conta: string; marcar: boolean }) => {
    const tabela = supabase.from("despesas_contas_bancarias_permissoes" as any);
    const { error } = marcar
      ? await tabela.upsert(ids.map(user_id => ({ user_id, conta_bancaria_id: conta })), { onConflict: "user_id,conta_bancaria_id" })
      : await tabela.delete().in("user_id", ids).eq("conta_bancaria_id", conta);
    if (error) throw error;
  }, onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["despesas-contas-permissoes"] });
    qc.invalidateQueries({ queryKey: ["desp-lookup"] });
    toast.success("Permissões de contas atualizadas");
  }, onError: (e: Error) => toast.error(e.message) });
  if (contas.error || permissoes.error) return <p className="text-destructive">Não foi possível carregar as contas: {(contas.error ?? permissoes.error)?.message}</p>;
  if (contas.isLoading || permissoes.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  const rows = contas.data ?? [];
  return <div className="space-y-4">
    {selected.size > 0 && <div className="flex flex-wrap items-center gap-3">
      <Badge>{selected.size} selecionado(s)</Badge>
      <Select value={acao} onValueChange={setAcao}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="add">Adicionar conta</SelectItem><SelectItem value="remove">Remover conta</SelectItem></SelectContent></Select>
      <Select value={contaId} onValueChange={setContaId}><SelectTrigger className="w-60"><SelectValue placeholder="Conta bancária" /></SelectTrigger><SelectContent>{rows.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
      <Button disabled={!contaId || salvar.isPending} onClick={() => salvar.mutate({ ids: [...selected], conta: contaId, marcar: acao === "add" })}>Aplicar</Button>
      <Button variant="ghost" onClick={clearSelection}>Limpar seleção</Button>
    </div>}
    {rows.length === 0 ? <p className="text-muted-foreground">Nenhuma conta bancária ativa cadastrada.</p> : <Table>
      <TableHeader><TableRow><TableHead><Checkbox aria-label="Selecionar todos os usuários" checked={users.length > 0 && users.every(u => selected.has(u.user_id))} onCheckedChange={() => toggleAll(users)} /></TableHead><TableHead>Usuário</TableHead>{rows.map(c => <TableHead key={c.id} className="min-w-40"><div>{c.nome}</div><div className="text-xs text-muted-foreground">{c.banco}</div></TableHead>)}<TableHead>Contas disponíveis</TableHead></TableRow></TableHeader>
      <TableBody>{users.map(u => {
        const permitidas = new Set((permissoes.data ?? []).filter(p => p.user_id === u.user_id).map(p => p.conta_bancaria_id));
        const total = rows.filter(c => permitidas.has(c.id)).length;
        return <TableRow key={u.user_id}><TableCell><Checkbox aria-label={`Selecionar ${u.name ?? u.email}`} checked={selected.has(u.user_id)} onCheckedChange={() => toggleUser(u.user_id)} /></TableCell><TableCell className="min-w-48"><div className="font-medium">{u.name ?? u.email}</div>{u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}</TableCell>{rows.map(c => <TableCell key={c.id}><Checkbox aria-label={`${c.nome} para ${u.name ?? u.email}`} disabled={salvar.isPending} checked={permitidas.has(c.id)} onCheckedChange={v => salvar.mutate({ ids: [u.user_id], conta: c.id, marcar: v === true })} /></TableCell>)}<TableCell><Badge variant={total ? "secondary" : "outline"}>{total ? `${total} conta(s)` : "Nenhuma conta"}</Badge></TableCell></TableRow>;
      })}</TableBody>
    </Table>}
  </div>;
}