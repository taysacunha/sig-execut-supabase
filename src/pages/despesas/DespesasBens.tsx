import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { ShieldAlert, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useBens, useDeleteBem, Bem, BemFiltros, BEM_CATEGORIAS, BEM_SITUACOES,
} from "@/hooks/useDespesasBens";
import { useDespesasLookups } from "@/hooks/useDespesasLancamentos";
import { BemDialog } from "@/components/despesas/BemDialog";
import { useDespesasValues } from "@/contexts/DespesasValuesContext";

const situacaoLabel = (v: string) => BEM_SITUACOES.find((s) => s.v === v)?.l ?? v;
const categoriaLabel = (v: string) => BEM_CATEGORIAS.find((c) => c.v === v)?.l ?? v;
const totalBem = (b: Bem) => (b.pagamentos ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);

export default function DespesasBens() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const { showValues, formatValue } = useDespesasValues();
  const money = (n: number | null | undefined) => (showValues ? formatValue(n) : "R$ ******");
  const { centros, pessoas } = useDespesasLookups();
  const [filtros, setFiltros] = useState<BemFiltros>({});
  const { data: bens = [], isLoading } = useBens(filtros);
  const delMut = useDeleteBem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Bem | null>(null);

  const kpis = useMemo(() => {
    const total = bens.length;
    const emUso = bens.filter((b) => b.situacao === "em_uso").length;
    const manutencao = bens.filter((b) => b.situacao === "em_manutencao").length;
    const baixados = bens.filter((b) => b.situacao === "baixado" || b.situacao === "doado_vendido").length;
    const investido = bens.reduce((s, b) => s + totalBem(b), 0);
    return { total, emUso, manutencao, baixados, investido };
  }, [bens]);

  if (!podeVer("bens")) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Você não tem permissão para visualizar esta aba.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (b: Bem) => { setEditing(b); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bens Permanentes</h1>
          <p className="text-muted-foreground">
            Carteira de equipamentos, móveis e demais bens, com registro de aquisições e pagamentos.
          </p>
        </div>
        {podeEditar("bens") && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo bem</Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[
          { l: "Total", v: kpis.total },
          { l: "Em uso", v: kpis.emUso },
          { l: "Em manutenção", v: kpis.manutencao },
          { l: "Baixados", v: kpis.baixados },
          { l: "Valor total investido", v: money(kpis.investido), primary: true },
        ].map((k) => (
          <Card key={k.l}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{k.l}</div>
              <div className={"text-2xl font-semibold " + (k.primary ? "text-primary" : "")}>{k.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={filtros.busca ?? ""} placeholder="Descrição"
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Situação</Label>
            <Select value={filtros.situacao ?? "todos"} onValueChange={(v: any) => setFiltros({ ...filtros, situacao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {BEM_SITUACOES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={filtros.categoria ?? "todos"} onValueChange={(v: any) => setFiltros({ ...filtros, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {BEM_CATEGORIAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Centro de custo</Label>
            <Select value={filtros.centroCustoId ?? "__none__"}
              onValueChange={(v) => setFiltros({ ...filtros, centroCustoId: v === "__none__" ? undefined : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos</SelectItem>
                {(centros.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Select value={filtros.responsavelId ?? "__none__"}
              onValueChange={(v) => setFiltros({ ...filtros, responsavelId: v === "__none__" ? undefined : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos</SelectItem>
                {(pessoas.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bens ({bens.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : bens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bem encontrado.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
                <TableHead className="text-right w-32">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bens.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.codigo ?? "—"}</TableCell>
                    <TableCell className="font-medium">{b.descricao}</TableCell>
                    <TableCell>{categoriaLabel(b.categoria)}</TableCell>
                    <TableCell>{situacaoLabel(b.situacao)}</TableCell>
                    <TableCell>{b.centro_custo?.nome ?? "—"}</TableCell>
                    <TableCell>{b.responsavel?.nome ?? "—"}</TableCell>
                    <TableCell>{b.local ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(totalBem(b))}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {podeEditar("bens") && (
                        <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {podeExcluir("bens") && (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(b)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BemDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar bem?</AlertDialogTitle>
            <AlertDialogDescription>
              O bem <b>{confirmDelete?.descricao}</b> será marcado como inativo. Aquisições e histórico permanecem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) delMut.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Bem desativado"); setConfirmDelete(null); },
                  onError: (err: any) => toast.error(err?.message ?? "Erro"),
                });
              }}
            >Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}