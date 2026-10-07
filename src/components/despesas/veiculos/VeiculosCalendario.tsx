import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, CheckCircle2, Undo2, CalendarDays, Trash2, Search } from "lucide-react";
import {
  useLancamentos, useEstornarLancamento, Lancamento, LancamentoStatus,
} from "@/hooks/useDespesasLancamentos";
import { useExcluirEncargoVeiculo, type Veiculo } from "@/hooks/useDespesasVeiculos";
import { BaixaEncargoDialog } from "./BaixaEncargoDialog";
import { traduzirErroDespesas } from "@/lib/despesasErros";
import { normalizeText } from "@/lib/textUtils";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_LABEL: Record<LancamentoStatus, string> = {
  a_vencer: "A vencer", vencido: "Vencido", pago_parcial: "Pago parcial",
  pago: "Pago", cancelado: "Cancelado", quitado: "Quitado", gimob: "GIMOB",
};

function statusVariant(s: LancamentoStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "pago" || s === "quitado") return "default";
  if (s === "vencido") return "destructive";
  if (s === "cancelado") return "outline";
  return "secondary";
}

const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function tipoEncargo(l: Lancamento): string {
  const m = /^([A-ZÁÉÍÓÚÃÕÇ]+)\s/.exec(l.descricao.trim());
  return m ? m[1] : "OUTRO";
}
function parcela(l: Lancamento): string {
  const any = l as any;
  if (any.parcela_num && any.parcela_total) return `${any.parcela_num}/${any.parcela_total}`;
  const m = /parcela (\d+\/\d+)/.exec(l.descricao);
  return m ? m[1] : "—";
}

interface Props {
  veiculos: Veiculo[];
  canEdit: boolean;
  canDelete?: boolean;
}

export function VeiculosCalendario({ veiculos, canEdit, canDelete = false }: Props) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [escopo, setEscopo] = useState<"mes" | "ano">("mes");
  const [veiculoId, setVeiculoId] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [situacao, setSituacao] = useState<"todos" | "ativos" | "vendidos">("ativos");
  const [busca, setBusca] = useState("");
  const [pagar, setPagar] = useState<Lancamento | null>(null);
  const [estornar, setEstornar] = useState<Lancamento | null>(null);
  const [excluir, setExcluir] = useState<Lancamento | null>(null);
  const [modoExc, setModoExc] = useState<"esta" | "seguintes">("esta");
  const [justificativa, setJustificativa] = useState("");

  const estornoMut = useEstornarLancamento();
  const excluirMut = useExcluirEncargoVeiculo();

  const anual = escopo === "ano";
  const inicio = anual ? new Date(ano, 0, 1) : new Date(ano, mes, 1);
  const fim = anual ? new Date(ano, 11, 31) : new Date(ano, mes + 1, 0);

  const { data: lancamentos = [], isLoading } = useLancamentos({
    somenteVeiculos: true,
    veiculoId: veiculoId === "todos" ? undefined : veiculoId,
    dataInicio: iso(inicio),
    dataFim: iso(fim),
  });

  const veicMap = useMemo(() => {
    const m: Record<string, Veiculo> = {};
    for (const v of veiculos) m[v.id] = v;
    return m;
  }, [veiculos]);
  const nome = (id?: string | null) => {
    const v = id ? veicMap[id] : undefined;
    return v ? v.modelo + (v.placa ? ` (${v.placa})` : "") : "—";
  };

  const tipos = useMemo(() => Array.from(new Set(lancamentos.map(tipoEncargo))).sort(), [lancamentos]);

  const filtrados = useMemo(() => {
    const q = normalizeText(busca.trim());
    return lancamentos.filter((l) => {
      if (tipo !== "todos" && tipoEncargo(l) !== tipo) return false;
      if (status !== "todos" && l.status !== status) return false;
      const v = l.veiculo_id ? veicMap[l.veiculo_id] : undefined;
      if (situacao === "ativos" && v?.data_venda) return false;
      if (situacao === "vendidos" && !v?.data_venda) return false;
      if (q && !normalizeText(`${l.descricao} ${nome(l.veiculo_id)}`).includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancamentos, tipo, status, situacao, busca, veicMap]);

  const grupos = useMemo(() => {
    const map = new Map<string, Lancamento[]>();
    for (const l of filtrados) {
      const k = anual ? l.data_vencimento.slice(0, 7) : l.data_vencimento;
      map.set(k, [...(map.get(k) ?? []), l]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados, anual]);

  const tituloGrupo = (k: string) =>
    anual ? `${MESES[Number(k.slice(5, 7)) - 1]} / ${k.slice(0, 4)}` : fmtData(k);

  function navegar(delta: number) {
    if (anual) return setAno((a) => a + delta);
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  function fecharJust() { setEstornar(null); setExcluir(null); setJustificativa(""); setModoExc("esta"); }

  function confirmarEstorno() {
    if (!estornar) return;
    estornoMut.mutate({ id: estornar.id, justificativa }, {
      onSuccess: () => { toast.success("Baixa desfeita"); fecharJust(); },
      onError: (e: any) => toast.error(traduzirErroDespesas(e)),
    });
  }
  function confirmarExclusao() {
    if (!excluir) return;
    excluirMut.mutate({ id: excluir.id, modo: modoExc, justificativa }, {
      onSuccess: (n) => { toast.success(`${n} parcela(s) excluída(s)`); fecharJust(); },
      onError: (e: any) => toast.error(traduzirErroDespesas(e)),
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => navegar(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="min-w-44 text-center font-semibold">{anual ? `Ano ${ano}` : `${MESES[mes]} / ${ano}`}</div>
              <Button size="icon" variant="outline" onClick={() => navegar(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Select value={escopo} onValueChange={(v) => setEscopo(v as "mes" | "ano")}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="ano">Ano inteiro</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-56">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar veículo ou placa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Veículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os veículos</SelectItem>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.modelo}{v.placa ? ` (${v.placa})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os encargos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="a_vencer">A vencer</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Veículos ativos</SelectItem>
                <SelectItem value="vendidos">Veículos vendidos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground">{filtrados.length} encargo(s)</span>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <CalendarDays className="h-10 w-10 opacity-50" />
            <p>Nenhum encargo de veículo {anual ? "neste ano" : "neste mês"}.</p>
          </CardContent>
        </Card>
      ) : (
        grupos.map(([k, itens]) => (
          <Card key={k}>
            <CardHeader className="py-3"><CardTitle className="text-base">{tituloGrupo(k)}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Status</TableHead>
                    {(canEdit || canDelete) && <TableHead className="text-right w-36">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((l) => {
                    const quitado = l.status === "pago" || l.status === "quitado";
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">{fmtData(l.data_vencimento)}</TableCell>
                        <TableCell className="font-medium">{l.descricao}</TableCell>
                        <TableCell>{nome(l.veiculo_id)}</TableCell>
                        <TableCell>{parcela(l)}</TableCell>
                        <TableCell><Badge variant={statusVariant(l.status)}>{STATUS_LABEL[l.status]}</Badge></TableCell>
                        {(canEdit || canDelete) && (
                          <TableCell className="text-right space-x-1">
                            {canEdit && l.status !== "cancelado" && !quitado && (
                              <Button size="icon" variant="ghost" title="Dar baixa" onClick={() => setPagar(l)}>
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {canEdit && (quitado || l.status === "pago_parcial") && (
                              <Button size="icon" variant="ghost" title="Desfazer baixa" onClick={() => setEstornar(l)}>
                                <Undo2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            {canDelete && !quitado && l.status !== "pago_parcial" && (
                              <Button size="icon" variant="ghost" title="Excluir encargo" onClick={() => setExcluir(l)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
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

      <BaixaEncargoDialog lancamento={pagar} onClose={() => setPagar(null)} />

      <AlertDialog open={!!estornar || !!excluir} onOpenChange={(o) => !o && fecharJust()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{excluir ? "Excluir encargo?" : "Desfazer baixa?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir
                ? <>O encargo <b>{excluir.descricao}</b> será removido do calendário. A ação fica registrada na auditoria.</>
                : <>A baixa de <b>{estornar?.descricao}</b> será desfeita e o encargo voltará para "A vencer".</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {excluir && (
            <RadioGroup value={modoExc} onValueChange={(v) => setModoExc(v as any)} className="py-1">
              <div className="flex items-center gap-2"><RadioGroupItem value="esta" id="m1" /><Label htmlFor="m1">Só esta parcela</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="seguintes" id="m2" /><Label htmlFor="m2">Esta e as seguintes do mesmo documento</Label></div>
            </RadioGroup>
          )}
          <div className="space-y-2 py-2">
            <Label>Justificativa (mínimo 10 caracteres)</Label>
            <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Explique o motivo…" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={justificativa.trim().length < 10 || estornoMut.isPending || excluirMut.isPending}
              onClick={excluir ? confirmarExclusao : confirmarEstorno}
            >
              {excluir ? "Excluir" : "Desfazer baixa"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
