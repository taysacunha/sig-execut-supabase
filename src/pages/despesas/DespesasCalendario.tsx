import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, ShieldAlert, DollarSign, AlertTriangle,
  CheckCircle2, XCircle, Download, Ban, Repeat,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import {
  Lancamento, LancamentoFiltros, LancamentoStatus, LancamentoTipo,
  useCancelLancamento, useDeleteLancamento, useDespesasLookups, useLancamentos,
} from "@/hooks/useDespesasLancamentos";
import { LancamentoDialog } from "@/components/despesas/LancamentoDialog";
import { PagamentoDialog } from "@/components/despesas/PagamentoDialog";

const STATUS_META: Record<LancamentoStatus, { label: string; variant: any; icon: any }> = {
  a_vencer: { label: "A vencer", variant: "secondary", icon: DollarSign },
  vencido: { label: "Vencido", variant: "destructive", icon: AlertTriangle },
  pago_parcial: { label: "Pago parcial", variant: "outline", icon: DollarSign },
  pago: { label: "Pago", variant: "default", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", variant: "outline", icon: XCircle },
};

function fmtBRL(v: number | string) {
  const n = typeof v === "string" ? Number(v) : v;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function exportarCsv(rows: Lancamento[]) {
  const header = [
    "Tipo", "Descrição", "Documento", "Pessoa", "Centro de custo", "Categoria",
    "Competência", "Vencimento", "Valor total", "Valor pago", "Status",
  ];
  const linhas = rows.map((r) => [
    r.tipo === "a_pagar" ? "A pagar" : "A receber",
    r.descricao,
    r.documento_numero ?? "",
    r.pessoa?.nome ?? "",
    r.centro_custo?.nome ?? "",
    r.categoria?.nome ?? "",
    fmtDate(r.data_competencia),
    fmtDate(r.data_vencimento),
    Number(r.valor_total).toFixed(2).replace(".", ","),
    Number(r.valor_pago).toFixed(2).replace(".", ","),
    STATUS_META[r.status].label,
  ]);
  const csv = [header, ...linhas]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `despesas-calendario-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DespesasCalendario() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const canEdit = podeEditar("calendario");
  const canDelete = podeExcluir("calendario");

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString().slice(0, 10);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    .toISOString().slice(0, 10);

  const [filtros, setFiltros] = useState<LancamentoFiltros>({
    tipo: "todos",
    status: "todos",
    dataInicio: primeiroDia,
    dataFim: ultimoDia,
  });

  const { data: rows = [], isLoading } = useLancamentos(filtros);
  const lookups = useDespesasLookups();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [pagando, setPagando] = useState<Lancamento | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lancamento | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Lancamento | null>(null);

  const deleteMut = useDeleteLancamento();
  const cancelMut = useCancelLancamento();

  const kpis = useMemo(() => {
    let aPagar = 0, aReceber = 0, pago = 0, vencido = 0;
    for (const r of rows) {
      const restante = Number(r.valor_total) - Number(r.valor_pago);
      if (r.status === "cancelado") continue;
      if (r.status === "pago") pago += Number(r.valor_total);
      if (r.status === "vencido") vencido += restante;
      if (r.tipo === "a_pagar" && r.status !== "pago") aPagar += restante;
      if (r.tipo === "a_receber" && r.status !== "pago") aReceber += restante;
    }
    return { aPagar, aReceber, pago, vencido };
  }, [rows]);

  // Duplicidade ±3 dias (mesmo valor, mesmo tipo, mesma pessoa) — client only.
  const duplicados = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        if (a.tipo !== b.tipo) continue;
        if (Number(a.valor_total) !== Number(b.valor_total)) continue;
        if ((a.pessoa_id ?? "") !== (b.pessoa_id ?? "")) continue;
        const diff = Math.abs(
          (new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())
            / (1000 * 60 * 60 * 24)
        );
        if (diff <= 3) { set.add(a.id); set.add(b.id); }
      }
    }
    return set;
  }, [rows]);

  if (!podeVer("calendario")) {
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

  function openNew(tipo: LancamentoTipo) {
    setEditing(null);
    setDialogOpen(true);
    // repasse tipo default via state auxiliar
    setTipoDefault(tipo);
  }
  const [tipoDefault, setTipoDefault] = useState<LancamentoTipo>("a_pagar");

  function openEdit(r: Lancamento) {
    setEditing(r);
    setTipoDefault(r.tipo);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendário de Despesas</h1>
          <p className="text-muted-foreground">
            Contas a pagar e receber, com múltiplas formas de pagamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCsv(rows)} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-2" />Exportar CSV
          </Button>
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => openNew("a_receber")}>
                <Plus className="h-4 w-4 mr-2" />A receber
              </Button>
              <Button size="sm" onClick={() => openNew("a_pagar")}>
                <Plus className="h-4 w-4 mr-2" />A pagar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A pagar (aberto)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtBRL(kpis.aPagar)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A receber (aberto)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtBRL(kpis.aReceber)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencido</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{fmtBRL(kpis.vencido)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pago no período</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtBRL(kpis.pago)}</p></CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={filtros.tipo ?? "todos"}
              onValueChange={(v) => setFiltros({ ...filtros, tipo: v as any })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="a_pagar">A pagar</SelectItem>
                <SelectItem value="a_receber">A receber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={filtros.status ?? "todos"}
              onValueChange={(v) => setFiltros({ ...filtros, status: v as any })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="a_vencer">A vencer</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="pago_parcial">Pago parcial</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Centro de custo</Label>
            <Select
              value={filtros.centroCustoId ?? "__todos__"}
              onValueChange={(v) =>
                setFiltros({ ...filtros, centroCustoId: v === "__todos__" ? undefined : v })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {(lookups.centros.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pessoa</Label>
            <Select
              value={filtros.pessoaId ?? "__todos__"}
              onValueChange={(v) =>
                setFiltros({ ...filtros, pessoaId: v === "__todos__" ? undefined : v })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todas</SelectItem>
                {(lookups.pessoas.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Vencimento — de</Label>
            <Input
              type="date"
              value={filtros.dataInicio ?? ""}
              onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1">
            <Label>Vencimento — até</Label>
            <Input
              type="date"
              value={filtros.dataFim ?? ""}
              onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Buscar por descrição</Label>
            <Input
              placeholder="Digite para filtrar…"
              value={filtros.busca ?? ""}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Lançamentos {isLoading ? "" : `(${rows.length})`}
          </CardTitle>
          {duplicados.size > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {duplicados.size / 2} possíveis duplicidades
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento no filtro atual.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Centro de custo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-48">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const meta = STATUS_META[r.status];
                    const Icon = meta.icon;
                    const dup = duplicados.has(r.id);
                    const restante = Number(r.valor_total) - Number(r.valor_pago);
                    const podeRegistrar = canEdit && r.status !== "cancelado" && r.status !== "pago" && restante > 0;
                    return (
                      <TableRow key={r.id} className={dup ? "bg-destructive/5" : ""}>
                        <TableCell className="whitespace-nowrap">{fmtDate(r.data_vencimento)}</TableCell>
                        <TableCell>
                          <Badge variant={r.tipo === "a_pagar" ? "outline" : "secondary"}>
                            {r.tipo === "a_pagar" ? "A pagar" : "A receber"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <div className="font-medium truncate">{r.descricao}</div>
                          {r.serie_recorrencia_id && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  to="/despesas/recorrencias"
                                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                                >
                                  <Repeat className="h-3 w-3" />
                                  {r.is_manual ? "Série (editado)" : "Gerado por série"}
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>
                                {r.is_manual
                                  ? "Este lançamento veio de uma série, mas foi editado manualmente."
                                  : "Lançamento gerado automaticamente por uma recorrência."}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {r.documento_numero && (
                            <div className="text-xs text-muted-foreground">Doc: {r.documento_numero}</div>
                          )}
                          {dup && (
                            <div className="text-xs text-destructive flex items-center gap-1 mt-1">
                              <AlertTriangle className="h-3 w-3" /> possível duplicidade
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{r.pessoa?.nome ?? "—"}</TableCell>
                        <TableCell>{r.centro_custo?.nome ?? "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtBRL(r.valor_total)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtBRL(r.valor_pago)}</TableCell>
                        <TableCell>
                          <Badge variant={meta.variant} className="gap-1">
                            <Icon className="h-3 w-3" />{meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {podeRegistrar && (
                            <Button size="sm" variant="outline" onClick={() => setPagando(r)}>
                              <DollarSign className="h-3 w-3 mr-1" />Pagar
                            </Button>
                          )}
                          {canEdit && r.status !== "cancelado" && (
                            <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && r.status !== "cancelado" && r.status !== "pago" && (
                            <Button size="icon" variant="ghost" onClick={() => setConfirmCancel(r)} title="Cancelar">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      <LancamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        tipoDefault={tipoDefault}
      />
      <PagamentoDialog
        open={!!pagando}
        onOpenChange={(o) => !o && setPagando(null)}
        lancamento={pagando}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento <b>{confirmDelete?.descricao}</b> e todos os pagamentos vinculados
              serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!confirmDelete) return;
                deleteMut.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Lançamento excluído"); setConfirmDelete(null); },
                  onError: (err: any) => toast.error(err?.message ?? "Erro ao excluir"),
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento <b>{confirmCancel?.descricao}</b> será marcado como cancelado e deixa
              de compor os totais. O registro fica preservado no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirmCancel) return;
                cancelMut.mutate(confirmCancel.id, {
                  onSuccess: () => { toast.success("Lançamento cancelado"); setConfirmCancel(null); },
                  onError: (err: any) => toast.error(err?.message ?? "Erro ao cancelar"),
                });
              }}
            >
              Cancelar lançamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}