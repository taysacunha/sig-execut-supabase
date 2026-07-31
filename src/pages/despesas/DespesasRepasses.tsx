import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { ShieldAlert, Plus, Eye, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ComboboxSelect } from "@/components/ui/combobox-select";
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
  useRepasseContas, useCriarConta, useDeleteConta, RepasseConta, ContaFiltros, RepasseStatus,
} from "@/hooks/useDespesasRepasses";
import { useDespesasLookups } from "@/hooks/useDespesasLancamentos";
import { RepasseDialog } from "@/components/despesas/RepasseDialog";
import { useDespesasValues } from "@/contexts/DespesasValuesContext";

const statusLabel: Record<RepasseStatus, string> = {
  aberto: "Aberto", fechado: "Fechado", pago: "Pago", cancelado: "Cancelado",
};

function mesLabel(competencia: string) {
  return new Date(competencia + "T00:00:00")
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "");
}

export default function DespesasRepasses() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const { showValues, formatValue } = useDespesasValues();
  const money = (n: number | null | undefined) =>
    showValues ? formatValue(n) : "R$ ******";
  const { centros, pessoas } = useDespesasLookups();

  const [filtros, setFiltros] = useState<ContaFiltros>({});
  const { data: contas = [], isLoading } = useRepasseContas(filtros);
  const criarMut = useCriarConta();
  const delMut = useDeleteConta();

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const detalhe = detalheId ? contas.find((c) => c.id === detalheId) ?? null : null;
  const [dialogNovo, setDialogNovo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RepasseConta | null>(null);
  const [novo, setNovo] = useState({ proprietarioId: "", centroCustoId: "" });

  const totais = (c: RepasseConta) => {
    const comps = c.competencias ?? [];
    return {
      bruto: comps.reduce((s, r) => s + Number(r.valor_bruto || 0), 0),
      taxa: comps.reduce((s, r) => s + Number(r.taxa_administracao_valor || 0), 0),
      liquido: comps.reduce((s, r) => s + Number(r.valor_liquido || 0), 0),
      count: comps.length,
      pagas: comps.filter((r) => r.status === "pago").length,
    };
  };

  const kpis = useMemo(() => {
    const all = contas.flatMap((c) => c.competencias ?? []);
    return {
      contas: contas.length,
      competencias: all.length,
      pagas: all.filter((r) => r.status === "pago").length,
      bruto: all.reduce((s, r) => s + Number(r.valor_bruto || 0), 0),
      liquido: all.reduce((s, r) => s + Number(r.valor_liquido || 0), 0),
    };
  }, [contas]);

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

  async function criar() {
    if (!novo.proprietarioId || !novo.centroCustoId) {
      toast.error("Selecione proprietário e centro de custo");
      return;
    }
    try {
      const id = await criarMut.mutateAsync({
        proprietarioId: novo.proprietarioId,
        centroCustoId: novo.centroCustoId,
      });
      toast.success("Conta de repasse criada — adicione as competências no detalhe");
      setDialogNovo(false);
      setDetalheId(id as string);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repasses</h1>
          <p className="text-muted-foreground">
            Uma conta por proprietário e centro de custo, com histórico de competências.
          </p>
        </div>
        <div className="flex gap-2">
          {podeEditar("repasses") && (
            <Button onClick={() => setDialogNovo(true)}>
              <Plus className="h-4 w-4 mr-2" />Nova conta de repasse
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            const rows = contas.flatMap((c) => (c.competencias ?? []).map((r) => ({
              Proprietário: c.proprietario?.nome ?? "",
              Centro: c.centro_custo?.nome ?? "",
              Competência: mesLabel(r.competencia),
              Status: statusLabel[r.status],
              Bruto: Number(r.valor_bruto),
              Taxa: Number(r.taxa_administracao_valor),
              Líquido: Number(r.valor_liquido),
              "Data pagamento": r.data_pagamento ?? "",
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Repasses");
            XLSX.writeFile(wb, `despesas-repasses-${new Date().toISOString().slice(0, 10)}.xlsx`);
          }} disabled={!contas.length}>
            <Download className="h-4 w-4 mr-2" />Exportar XLSX
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Contas</div><div className="text-2xl font-semibold">{kpis.contas}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Competências</div><div className="text-2xl font-semibold">{kpis.competencias}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Pagas</div><div className="text-2xl font-semibold text-emerald-600">{kpis.pagas}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Bruto</div><div className="text-2xl font-semibold">{money(kpis.bruto)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Líquido</div><div className="text-2xl font-semibold text-primary">{money(kpis.liquido)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
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
        <CardHeader><CardTitle>Contas de repasse ({contas.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta de repasse cadastrada.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Proprietário</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Competências</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right w-32">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {contas.map((c) => {
                  const t = totais(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.proprietario?.nome ?? "—"}</TableCell>
                      <TableCell>{c.centro_custo?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.count === 0 ? (
                            <span className="text-sm text-muted-foreground">Nenhuma</span>
                          ) : resumoPorAno(c).map((a) => (
                            <Badge
                              key={a.ano}
                              variant={a.pagas === a.total ? "default" : "secondary"}
                              className="cursor-pointer"
                              title={a.meses}
                              onClick={() => setDetalheId(c.id)}
                            >
                              {a.ano} · {a.total} comp. · {a.pagas} pagas
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{money(t.bruto)}</TableCell>
                      <TableCell className="text-right text-destructive">−{money(t.taxa)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{money(t.liquido)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => setDetalheId(c.id)}><Eye className="h-4 w-4" /></Button>
                        {podeExcluir("repasses") && t.pagas === 0 && (
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(c)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RepasseDialog open={!!detalhe} onOpenChange={(o) => !o && setDetalheId(null)} conta={detalhe} />

      <Dialog open={dialogNovo} onOpenChange={setDialogNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova conta de repasse</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
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
              A competência é adicionada dentro da conta, no botão do olho: cada mês consolida os
              lançamentos do calendário e copia os beneficiários do mês anterior (sem as datas).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovo(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={criarMut.isPending}>Criar conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta de repasse?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a conta, suas competências, itens e beneficiários. Não afeta os
              lançamentos originais no calendário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) delMut.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Conta excluída"); setConfirmDelete(null); },
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
