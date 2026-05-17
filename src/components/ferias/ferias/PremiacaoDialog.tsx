import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Award, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { calcularPremiacao, formatBRL, type CenarioVenda } from "@/lib/premiacaoCalc";
import { gerarPremiacaoPDF } from "@/lib/premiacaoPdf";
import { useUpsertPremiacao, type FeriasPremiacao } from "@/hooks/ferias/useFeriasPremiacoes";

interface GozoPeriodo {
  id: string; ferias_id: string; numero: number; dias: number;
  data_inicio: string; data_fim: string; referencia_periodo: number | null;
}

interface FeriasLite {
  id: string;
  colaborador?: { nome: string } | null;
  quinzena1_inicio: string; quinzena1_fim: string;
  quinzena2_inicio: string | null; quinzena2_fim: string | null;
  gozo_diferente: boolean;
  gozo_quinzena1_inicio: string | null; gozo_quinzena1_fim: string | null;
  gozo_quinzena2_inicio: string | null; gozo_quinzena2_fim: string | null;
  vender_dias: boolean;
  dias_vendidos: number | null;
  quinzena_venda: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ferias: FeriasLite;
  gozoPeriodos: GozoPeriodo[];
  existingPremiacoes: FeriasPremiacao[];
  editing?: FeriasPremiacao | null;
}

function periodoGozoReal(f: FeriasLite, gozoPeriodos: GozoPeriodo[], periodo: 1 | 2): { inicio: string; fim: string } | null {
  const flex = gozoPeriodos.filter(p => p.referencia_periodo === periodo);
  if (flex.length) {
    const ini = flex.reduce((a, b) => a.data_inicio < b.data_inicio ? a : b).data_inicio;
    const fim = flex.reduce((a, b) => a.data_fim > b.data_fim ? a : b).data_fim;
    return { inicio: ini, fim };
  }
  if (f.gozo_diferente) {
    if (periodo === 1 && f.gozo_quinzena1_inicio) return { inicio: f.gozo_quinzena1_inicio, fim: f.gozo_quinzena1_fim! };
    if (periodo === 2 && f.gozo_quinzena2_inicio) return { inicio: f.gozo_quinzena2_inicio, fim: f.gozo_quinzena2_fim! };
  }
  if (periodo === 1) return { inicio: f.quinzena1_inicio, fim: f.quinzena1_fim };
  if (periodo === 2 && f.quinzena2_inicio) return { inicio: f.quinzena2_inicio, fim: f.quinzena2_fim! };
  return null;
}

function diasVendidosPorPeriodo(f: FeriasLite, periodo: 1 | 2): CenarioVenda {
  if (!f.vender_dias || !f.dias_vendidos) return 0;
  const totalVend = f.dias_vendidos;
  // Por padrão, a venda fica na quinzena indicada (quinzena_venda, default 2 quando não há)
  const quinzenaVenda = f.quinzena_venda ?? 2;
  // Cada quinzena tem no máx 10 dias de venda; o que passar vai para a outra.
  let vendidosQ: number;
  if (totalVend <= 10) {
    vendidosQ = periodo === quinzenaVenda ? totalVend : 0;
  } else {
    // Excedente vai para a outra quinzena
    if (periodo === quinzenaVenda) vendidosQ = 10;
    else vendidosQ = totalVend - 10;
  }
  if (vendidosQ <= 0) return 0;
  if (vendidosQ >= 15) return 15;
  if (vendidosQ >= 10) return 10;
  if (vendidosQ >= 5) return 5;
  return 0;
}

function fmtDate(s: string) {
  try { return format(parseISO(s), "dd/MM/yyyy", { locale: ptBR }); } catch { return s; }
}

export function PremiacaoDialog({ open, onOpenChange, ferias, gozoPeriodos, existingPremiacoes, editing }: Props) {
  const hasP1 = existingPremiacoes.some(p => p.periodo === 1);
  const hasP2 = existingPremiacoes.some(p => p.periodo === 2);

  const [periodo, setPeriodo] = useState<1 | 2>(editing?.periodo ?? (hasP1 ? 2 : 1));
  const [valor, setValor] = useState<string>(editing ? String(editing.valor_premiacao) : "");
  const [dataRecebimento, setDataRecebimento] = useState<string>(editing?.data_recebimento ?? new Date().toISOString().slice(0, 10));
  const [dataInicio, setDataInicio] = useState<string>(editing?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState<string>(editing?.data_fim ?? "");

  const upsert = useUpsertPremiacao();

  // Reset ao abrir/trocar registro
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPeriodo(editing.periodo);
      setValor(String(editing.valor_premiacao));
      setDataRecebimento(editing.data_recebimento);
      setDataInicio(editing.data_inicio);
      setDataFim(editing.data_fim);
    } else {
      const initialPeriodo = hasP1 ? (hasP2 ? 1 : 2) : 1;
      setPeriodo(initialPeriodo);
      setValor("");
      setDataRecebimento(new Date().toISOString().slice(0, 10));
      const real = periodoGozoReal(ferias, gozoPeriodos, initialPeriodo);
      setDataInicio(real?.inicio || "");
      setDataFim(real?.fim || "");
    }
  }, [open, editing?.id]);

  // Ao trocar período, preencher datas do gozo de fato (se não estiver editando)
  useEffect(() => {
    if (editing) return;
    const real = periodoGozoReal(ferias, gozoPeriodos, periodo);
    if (real) { setDataInicio(real.inicio); setDataFim(real.fim); }
  }, [periodo, editing]);

  const diasVendidos = useMemo(() => diasVendidosPorPeriodo(ferias, periodo), [ferias, periodo]);
  const valorNum = Number((valor || "0").replace(",", "."));
  const calc = useMemo(() => valorNum > 0 ? calcularPremiacao(valorNum, diasVendidos) : null, [valorNum, diasVendidos]);

  const podeSelecionarP2 = hasP1 || !!editing;
  const periodoP2Disponivel = !!periodoGozoReal(ferias, gozoPeriodos, 2);

  async function handleSalvar(gerar: boolean) {
    if (!valorNum || valorNum <= 0) { toast.error("Informe o valor da premiação"); return; }
    if (!dataInicio || !dataFim) { toast.error("Informe as datas do período"); return; }
    if (!dataRecebimento) { toast.error("Informe a data de recebimento"); return; }

    try {
      await upsert.mutateAsync({
        id: editing?.id,
        ferias_id: ferias.id,
        periodo: (editing ? editing.periodo : periodo) as 1 | 2,
        data_inicio: dataInicio,
        data_fim: dataFim,
        dias_gozados: (15 - diasVendidos) as 0 | 5 | 10 | 15,
        dias_vendidos: diasVendidos,
        valor_premiacao: valorNum,
        data_recebimento: dataRecebimento,
        ultima_exportacao_pdf: gerar ? dataRecebimento : (editing?.ultima_exportacao_pdf ?? null),
      } as any);

      if (gerar) {
        await gerarPremiacaoPDF({
          colaborador: ferias.colaborador?.nome || "—",
          periodo,
          dataInicio,
          dataFim,
          dataRecebimento,
          valorPremiacao: valorNum,
          diasVendidos,
        });
      }
      onOpenChange(false);
    } catch {}
  }

  async function handleApenasPdf() {
    if (!valorNum || valorNum <= 0) { toast.error("Informe o valor para gerar o preview"); return; }
    await gerarPremiacaoPDF({
      colaborador: ferias.colaborador?.nome || "—",
      periodo, dataInicio, dataFim, dataRecebimento,
      valorPremiacao: valorNum, diasVendidos,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />{editing ? "Editar" : "Lançar"} Premiação — {ferias.colaborador?.nome}</DialogTitle>
          <DialogDescription>Preencha o período, o valor mensal da premiação e gere o recibo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Período */}
          <div>
            <Label className="mb-2 block">Período</Label>
            <RadioGroup
              value={String(periodo)}
              onValueChange={(v) => setPeriodo(Number(v) as 1 | 2)}
              className="flex gap-4"
            >
              <label className={`flex items-center gap-2 border rounded-md p-3 flex-1 ${editing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${(!editing && hasP1) ? "opacity-60" : ""}`}>
                <RadioGroupItem value="1" disabled={!!editing || (!editing && hasP1)} />
                <div>
                  <div className="font-medium">1ª Quinzena</div>
                  {hasP1 && !editing && <Badge variant="outline" className="text-xs mt-1">Já lançada</Badge>}
                  {editing && editing.periodo === 1 && <Badge variant="outline" className="text-xs mt-1">Editando</Badge>}
                </div>
              </label>
              <label className={`flex items-center gap-2 border rounded-md p-3 flex-1 ${editing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${(!podeSelecionarP2 || !periodoP2Disponivel || (!editing && hasP2)) ? "opacity-60" : ""}`}>
                <RadioGroupItem value="2" disabled={!!editing || !podeSelecionarP2 || !periodoP2Disponivel || (!editing && hasP2)} />
                <div>
                  <div className="font-medium">2ª Quinzena</div>
                  {!periodoP2Disponivel && <Badge variant="outline" className="text-xs mt-1">Sem 2º período</Badge>}
                  {periodoP2Disponivel && !hasP1 && !editing && <Badge variant="outline" className="text-xs mt-1">Lance o 1º primeiro</Badge>}
                  {hasP2 && !editing && <Badge variant="outline" className="text-xs mt-1">Já lançada</Badge>}
                  {editing && editing.periodo === 2 && <Badge variant="outline" className="text-xs mt-1">Editando</Badge>}
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de início (gozo)</Label>
              <Input type="date" value={dataInicio} readOnly disabled className="bg-muted/30" />
            </div>
            <div>
              <Label>Data de fim (gozo)</Label>
              <Input type="date" value={dataFim} readOnly disabled className="bg-muted/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dias vendidos nesta quinzena</Label>
              <div className="h-10 flex items-center px-3 border rounded-md bg-muted/30 text-sm">
                {diasVendidos} dias vendidos · {15 - diasVendidos} dias usufruídos
              </div>
            </div>
            <div>
              <Label>Data de recebimento</Label>
              <Input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} />
            </div>
          </div>

          {/* Valor */}
          <div>
            <Label>Valor da premiação (B4) R$</Label>
            <Input
              inputMode="decimal"
              placeholder="Ex: 1600.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Valor base da quinzena (B4) — equivale a "PREMIAÇÃO" da planilha.
            </p>
          </div>

          {/* Preview */}
          {calc && (
            <div className="border rounded-md p-4 bg-muted/20">
              <div className="text-center text-sm font-semibold mb-2">Preview do Recibo</div>
              <div className="text-xs text-muted-foreground mb-3 text-center">
                Período: {dataInicio ? fmtDate(dataInicio) : "—"} a {dataFim ? fmtDate(dataFim) : "—"}
              </div>
              <table className="w-full text-sm border-collapse">
                <tbody className="[&>tr>td]:border [&>tr>td]:px-2 [&>tr>td]:py-1.5">
                  {calc.cenario === 0 ? (
                    <>
                      <tr><td>PREMIAÇÃO</td><td className="text-right">{formatBRL(calc.valorPremiacao)}</td></tr>
                      <tr><td>COMISSÃO 15 DIAS DE FÉRIAS</td><td className="text-right">{formatBRL(calc.comissao15)}</td></tr>
                      <tr><td>1/3 SOBRE A COMISSÃO</td><td className="text-right">{formatBRL(calc.umTercoComissao)}</td></tr>
                      <tr className="font-bold"><td>RECEBIDO DIA {fmtDate(dataRecebimento)}</td><td className="text-right">{formatBRL(calc.recebe)}</td></tr>
                    </>
                  ) : (
                    <>
                      <tr><td>PREMIAÇÃO</td><td className="text-right">{formatBRL(calc.valorPremiacao)}</td></tr>
                      <tr><td>Mais Acréscimo 1/3</td><td className="text-right">{formatBRL(calc.acrescimoUmTerco)}</td></tr>
                      <tr className="font-semibold"><td>TOTAL</td><td className="text-right">{formatBRL(calc.total)}</td></tr>
                      <tr><td>VENDA DE {calc.cenario} DIAS DE FÉRIAS ({periodo === 1 ? "1ª" : "2ª"} QUINZENA) + 1/3</td><td className="text-right">{formatBRL(calc.vendaParcela)}</td></tr>
                      {calc.cenario !== 15 && (
                        <tr><td>1/3 DE FÉRIAS - REFERENTE A {calc.diasGozados} DIAS USUFRUÍDO</td><td className="text-right">{formatBRL(calc.umTercoGozados)}</td></tr>
                      )}
                      <tr className="font-bold"><td>RECEBIDO DIA {fmtDate(dataRecebimento)}</td><td className="text-right">{formatBRL(calc.recebe)}</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={handleApenasPdf} disabled={!calc}>
            <Download className="h-4 w-4 mr-2" />Gerar PDF (sem salvar)
          </Button>
          <Button onClick={() => handleSalvar(false)} disabled={!calc || upsert.isPending}>
            <Save className="h-4 w-4 mr-2" />Salvar
          </Button>
          <Button onClick={() => handleSalvar(true)} disabled={!calc || upsert.isPending}>
            <Save className="h-4 w-4 mr-2" />Salvar e gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
