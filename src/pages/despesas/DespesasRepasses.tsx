import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { ShieldAlert, Plus, Eye, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useRepasses, useMontarRepasse, useDeleteRepasse, Repasse, RepasseFiltros, RepasseStatus,
} from "@/hooks/useDespesasRepasses";
import { useDespesasLookups } from "@/hooks/useDespesasLancamentos";
import { RepasseDialog } from "@/components/despesas/RepasseDialog";

function money(n: number | null | undefined) {
  return `R$ ${Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
function firstDayOfMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const statusLabel: Record<RepasseStatus, string> = {
  aberto: "Aberto", fechado: "Fechado", pago: "Pago", cancelado: "Cancelado",
};

export default function DespesasRepasses() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const { centros, pessoas } = useDespesasLookups();

  const [filtros, setFiltros] = useState<RepasseFiltros>({ competencia: firstDayOfMonth() });
  const { data: repasses = [], isLoading } = useRepasses(filtros);
  const montarMut = useMontarRepasse();
  const delMut = useDeleteRepasse();

  const [detalhe, setDetalhe] = useState<Repasse | null>(null);
  const [dialogNovo, setDialogNovo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Repasse | null>(null);
  const [novo, setNovo] = useState({ proprietarioId: "", centroCustoId: "", competencia: firstDayOfMonth() });

  const kpis = useMemo(() => {
    const totalBruto = repasses.reduce((s, r) => s + Number(r.valor_bruto), 0);
    const totalTaxa = repasses.reduce((s, r) => s + Number(r.taxa_administracao_valor), 0);
    const totalLiquido = repasses.reduce((s, r) => s + Number(r.valor_liquido), 0);
    const pagos = repasses.filter((r) => r.status === "pago").length;
    return { totalBruto, totalTaxa, totalLiquido, pagos, count: repasses.length };
  }, [repasses]);

  if (!podeVer("repasses")) {
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

  async function montar() {
    if (!novo.proprietarioId || !novo.centroCustoId || !novo.competencia) {
      toast.error("Selecione proprietário, centro e competência");
      return;
    }
    try {
      await montarMut.mutateAsync({
        proprietarioId: novo.proprietarioId,
        centroCustoId: novo.centroCustoId,
        competencia: novo.competencia,
      });
      toast.success("Repasse montado com base nos lançamentos do mês");
      setDialogNovo(false);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repasses</h1>
          <p className="text-muted-foreground">Consolidação mensal de créditos e débitos por proprietário.</p>
        </div>
        {podeEditar("repasses") && (
          <Button onClick={() => setDialogNovo(true)}><Plus className="h-4 w-4 mr-2" />Montar repasse</Button>
        )}
        <Button variant="outline" onClick={() => {
          const rows = repasses.map((r) => ({
            Competência: new Date(r.competencia + "T00:00:00").toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }),
            Proprietário: r.proprietario?.nome ?? "",
            Centro: r.centro_custo?.nome ?? "",
            Status: statusLabel[r.status],
            Bruto: Number(r.valor_bruto),
            Taxa: Number(r.taxa_administracao_valor),
            Líquido: Number(r.valor_liquido),
            "Data pagamento": r.data_pagamento ?? "",
          }));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Repasses");
          XLSX.writeFile(wb, `despesas-repasses-${new Date().toISOString().slice(0, 10)}.xlsx`);
        }} disabled={!repasses.length}>
          <Download className="h-4 w-4 mr-2" />Exportar XLSX
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Repasses</div><div className="text-2xl font-semibold">{kpis.count}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Pagos</div><div className="text-2xl font-semibold text-emerald-600">{kpis.pagos}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Bruto</div><div className="text-2xl font-semibold">{money(kpis.totalBruto)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Taxa admin.</div><div className="text-2xl font-semibold text-destructive">−{money(kpis.totalTaxa)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Líquido</div><div className="text-2xl font-semibold text-primary">{money(kpis.totalLiquido)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Competência</Label>
            <Input type="month" value={(filtros.competencia ?? "").slice(0, 7)} onChange={(e) => setFiltros({ ...filtros, competencia: e.target.value ? `${e.target.value}-01` : undefined })} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={filtros.status ?? "todos"} onValueChange={(v: any) => setFiltros({ ...filtros, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Centro de custo</Label>
            <ComboboxSelect
              value={filtros.centroCustoId ?? null}
              onChange={(v) => setFiltros({ ...filtros, centroCustoId: v ?? undefined })}
              options={(centros.data ?? []).map(c => ({ value: c.id, label: c.nome }))}
              placeholder="Todos"
              searchPlaceholder="Buscar centro de custo…"
              allowClear
            />
          </div>
          <div className="space-y-1">
            <Label>Proprietário</Label>
            <ComboboxSelect
              value={filtros.proprietarioId ?? null}
              onChange={(v) => setFiltros({ ...filtros, proprietarioId: v ?? undefined })}
              options={(pessoas.data ?? []).map(p => ({ value: p.id, label: p.nome }))}
              placeholder="Todos"
              searchPlaceholder="Buscar pessoa…"
              allowClear
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Repasses ({repasses.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : repasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum repasse encontrado.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right w-32">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {repasses.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.competencia + "T00:00:00").toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</TableCell>
                    <TableCell className="font-medium">{r.proprietario?.nome ?? "—"}</TableCell>
                    <TableCell>{r.centro_custo?.nome ?? "—"}</TableCell>
                    <TableCell>{statusLabel[r.status]}</TableCell>
                    <TableCell className="text-right">{money(r.valor_bruto)}</TableCell>
                    <TableCell className="text-right text-destructive">−{money(r.taxa_administracao_valor)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{money(r.valor_liquido)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setDetalhe(r)}><Eye className="h-4 w-4" /></Button>
                      {podeExcluir("repasses") && r.status !== "pago" && (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}>
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

      <RepasseDialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)} repasse={detalhe} />

      <Dialog open={dialogNovo} onOpenChange={setDialogNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Montar repasse</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>Competência</Label>
              <Input type="month" value={novo.competencia.slice(0, 7)} onChange={(e) => setNovo({ ...novo, competencia: e.target.value ? `${e.target.value}-01` : "" })} />
            </div>
            <div className="space-y-1"><Label>Proprietário *</Label>
              <ComboboxSelect
                value={novo.proprietarioId || null}
                onChange={(v) => setNovo({ ...novo, proprietarioId: v ?? "" })}
                options={(pessoas.data ?? []).map(p => ({ value: p.id, label: p.nome }))}
                placeholder="Selecione"
                searchPlaceholder="Buscar pessoa…"
              />
            </div>
            <div className="space-y-1"><Label>Centro de custo *</Label>
              <ComboboxSelect
                value={novo.centroCustoId || null}
                onChange={(v) => setNovo({ ...novo, centroCustoId: v ?? "" })}
                options={(centros.data ?? []).map(c => ({ value: c.id, label: c.nome }))}
                placeholder="Selecione"
                searchPlaceholder="Buscar centro de custo…"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Consolida os lançamentos do mês para esse proprietário/centro em créditos e débitos, aplica a taxa de administração e calcula o líquido.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovo(false)}>Cancelar</Button>
            <Button onClick={montar} disabled={montarMut.isPending}>Montar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir repasse?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o repasse e seus itens. Não afeta os lançamentos originais no calendário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) delMut.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Repasse excluído"); setConfirmDelete(null); },
                  onError: (err: any) => toast.error(err?.message ?? "Erro"),
                });
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}