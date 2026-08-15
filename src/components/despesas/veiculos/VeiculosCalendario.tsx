import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, CheckCircle2, Undo2, CalendarDays } from "lucide-react";
import {
  useLancamentos, useEstornarLancamento, Lancamento, LancamentoStatus,
} from "@/hooks/useDespesasLancamentos";
import { PagamentoDialog } from "@/components/despesas/PagamentoDialog";
import { useDespesasValues } from "@/contexts/DespesasValuesContext";
import type { Veiculo } from "@/hooks/useDespesasVeiculos";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_LABEL: Record<LancamentoStatus, string> = {
  a_vencer: "A vencer",
  vencido: "Vencido",
  pago_parcial: "Pago parcial",
  pago: "Pago",
  cancelado: "Cancelado",
  quitado: "Quitado",
  gimob: "GIMOB",
};

function statusVariant(s: LancamentoStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "pago" || s === "quitado") return "default";
  if (s === "vencido") return "destructive";
  if (s === "cancelado") return "outline";
  return "secondary";
}

const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

/** Tipo do encargo inferido do prefixo da descrição gerada (IPVA, SEGURO…). */
function tipoEncargo(l: Lancamento): string {
  const m = /^([A-ZÁÉÍÓÚÃÕÇ]+)\s/.exec(l.descricao.trim());
  return m ? m[1] : "OUTRO";
}

interface Props {
  veiculos: Veiculo[];
  canEdit: boolean;
}

export function VeiculosCalendario({ veiculos, canEdit }: Props) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-11
  const [veiculoId, setVeiculoId] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [pagar, setPagar] = useState<Lancamento | null>(null);
  const [estornar, setEstornar] = useState<Lancamento | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const { formatValue } = useDespesasValues();
  const estornoMut = useEstornarLancamento();

  const inicio = new Date(ano, mes, 1);
  const fim = new Date(ano, mes + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { data: lancamentos = [], isLoading } = useLancamentos({
    somenteVeiculos: true,
    veiculoId: veiculoId === "todos" ? undefined : veiculoId,
    dataInicio: iso(inicio),
    dataFim: iso(fim),
  });

  const tipos = useMemo(
    () => Array.from(new Set(lancamentos.map(tipoEncargo))).sort(),
    [lancamentos],
  );

  const filtrados = useMemo(
    () => (tipo === "todos" ? lancamentos : lancamentos.filter((l) => tipoEncargo(l) === tipo)),
    [lancamentos, tipo],
  );

  const nomeVeiculo = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of veiculos) map[v.id] = v.modelo + (v.placa ? ` (${v.placa})` : "");
    return map;
  }, [veiculos]);

  const porDia = useMemo(() => {
    const map = new Map<string, Lancamento[]>();
    for (const l of filtrados) {
      const arr = map.get(l.data_vencimento) ?? [];
      arr.push(l);
      map.set(l.data_vencimento, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const totalMes = filtrados
    .filter((l) => l.status !== "cancelado")
    .reduce((s, l) => s + Number(l.valor_total ?? 0), 0);
  const totalPago = filtrados.reduce((s, l) => s + Number(l.valor_pago ?? 0), 0);

  function navegar(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  function confirmarEstorno() {
    if (!estornar) return;
    estornoMut.mutate(
      { id: estornar.id, justificativa },
      {
        onSuccess: () => {
          toast.success("Pagamento desfeito");
          setEstornar(null);
          setJustificativa("");
        },
        onError: (e: any) => toast.error(e?.message ?? "Erro ao desfazer"),
      },
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => navegar(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-44 text-center font-semibold">
                {MESES[mes]} / {ano}
              </div>
              <Button size="icon" variant="outline" onClick={() => navegar(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Veículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os veículos</SelectItem>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.modelo}{v.placa ? ` (${v.placa})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os encargos</SelectItem>
                {tipos.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">
              Previsto <b className="text-foreground">{formatValue(totalMes)}</b> · Pago{" "}
              <b className="text-foreground">{formatValue(totalPago)}</b>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : porDia.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <CalendarDays className="h-10 w-10 opacity-50" />
            <p>Nenhuma despesa de veículo neste mês.</p>
          </CardContent>
        </Card>
      ) : (
        porDia.map(([dia, itens]) => (
          <Card key={dia}>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{fmtData(dia)}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="text-right w-32">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((l) => {
                    const quitado = l.status === "pago" || l.status === "quitado";
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.descricao}</TableCell>
                        <TableCell>{l.veiculo_id ? (nomeVeiculo[l.veiculo_id] ?? "—") : "—"}</TableCell>
                        <TableCell className="text-right">{formatValue(Number(l.valor_total ?? 0))}</TableCell>
                        <TableCell className="text-right">{formatValue(Number(l.valor_pago ?? 0))}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(l.status)}>{STATUS_LABEL[l.status]}</Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right space-x-1">
                            {l.status !== "cancelado" && !quitado && (
                              <Button size="icon" variant="ghost" title="Marcar como pago" onClick={() => setPagar(l)}>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </Button>
                            )}
                            {(quitado || l.status === "pago_parcial" || Number(l.valor_pago ?? 0) > 0) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Desfazer pagamento"
                                onClick={() => { setEstornar(l); setJustificativa(""); }}
                              >
                                <Undo2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <PagamentoDialog
        open={!!pagar}
        onOpenChange={(o) => !o && setPagar(null)}
        lancamento={pagar}
      />

      <AlertDialog open={!!estornar} onOpenChange={(o) => { if (!o) { setEstornar(null); setJustificativa(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Os pagamentos de <b>{estornar?.descricao}</b> serão removidos e o lançamento voltará
              para "A vencer". A ação fica registrada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Justificativa (mínimo 10 caracteres)</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique o motivo do estorno…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={justificativa.trim().length < 10 || estornoMut.isPending}
              onClick={confirmarEstorno}
            >
              {estornoMut.isPending ? "Desfazendo…" : "Desfazer pagamento"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
