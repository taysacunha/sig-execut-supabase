import { useEffect, useMemo } from "react";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, FileCheck, Info, AlertTriangle, CalendarClock } from "lucide-react";

export interface PeriodoState {
  contador_inicio: string;
  contador_fim: string;
  tipo: "gozar" | "vender";
  dias_vendidos: number; // 0–15; só usado quando tipo=vender
  gozo_inicio: string;   // datas reais de gozo interno
  gozo_fim: string;      // automático
}

interface Props {
  p1: PeriodoState;
  p2: PeriodoState;
  onP1Change: (p: PeriodoState) => void;
  onP2Change: (p: PeriodoState) => void;
  enviadoQ1: boolean;
  enviadoQ2: boolean;
  enviadoEm?: string | null;
}

const formatBR = (s: string) => {
  try { return format(parseISO(s), "dd/MM/yyyy", { locale: ptBR }); } catch { return s; }
};

function PeriodoCard({
  index, periodo, onChange, enviado, enviadoEm,
}: {
  index: 1 | 2;
  periodo: PeriodoState;
  onChange: (p: PeriodoState) => void;
  enviado: boolean;
  enviadoEm?: string | null;
}) {
  const diasGozoInterno = Math.max(0, 15 - (periodo.tipo === "vender" ? periodo.dias_vendidos : 0));

  // Auto-calc contador_fim (15 dias)
  useEffect(() => {
    if (!periodo.contador_inicio) return;
    try {
      const fim = format(addDays(parseISO(periodo.contador_inicio), 14), "yyyy-MM-dd");
      if (fim !== periodo.contador_fim) onChange({ ...periodo, contador_fim: fim });
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.contador_inicio]);

  // Auto-calc gozo_fim a partir de gozo_inicio + diasGozoInterno
  useEffect(() => {
    if (!periodo.gozo_inicio || diasGozoInterno <= 0) return;
    try {
      const fim = format(addDays(parseISO(periodo.gozo_inicio), diasGozoInterno - 1), "yyyy-MM-dd");
      if (fim !== periodo.gozo_fim) onChange({ ...periodo, gozo_fim: fim });
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.gozo_inicio, diasGozoInterno]);

  // Quando vira "vender" sem dias, default 15
  useEffect(() => {
    if (periodo.tipo === "vender" && (periodo.dias_vendidos ?? 0) === 0) {
      onChange({ ...periodo, dias_vendidos: 15 });
    }
    if (periodo.tipo === "gozar" && periodo.dias_vendidos !== 0) {
      onChange({ ...periodo, dias_vendidos: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.tipo]);

  const gozoMesmoMes = useMemo(() => {
    if (!periodo.gozo_inicio || !periodo.contador_inicio) return true;
    try {
      const a = parseISO(periodo.gozo_inicio);
      const b = parseISO(periodo.contador_inicio);
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    } catch { return true; }
  }, [periodo.gozo_inicio, periodo.contador_inicio]);

  // Erro: gozo interno deve ser estritamente posterior ao contador (quando datas diferem)
  const gozoError = useMemo(() => {
    if (diasGozoInterno === 0) return null;
    if (!periodo.gozo_inicio || !periodo.contador_fim) return null;
    if (periodo.gozo_inicio === periodo.contador_inicio) return null; // gozo coincide com contador
    try {
      const gi = parseISO(periodo.gozo_inicio);
      const cf = parseISO(periodo.contador_fim);
      if (gi <= cf) {
        return `Quando o gozo é diferente do período do contador, a data de início do gozo deve ser posterior a ${formatBR(periodo.contador_fim)}.`;
      }
    } catch { /* ignore */ }
    return null;
  }, [periodo.gozo_inicio, periodo.contador_inicio, periodo.contador_fim, diasGozoInterno]);

  return (
    <Card className={enviado ? "border-emerald-500/40" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {index}º Período (15 dias)
          {enviado && (
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400 gap-1">
              <FileCheck className="h-3 w-3" /> Enviado ao contador{enviadoEm ? ` em ${formatBR(enviadoEm)}` : ""}
            </Badge>
          )}
        </CardTitle>
        {enviado && (
          <p className="text-xs text-muted-foreground">
            Datas do contador e tipo do período estão travados. Apenas as datas reais de gozo interno podem ser ajustadas.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Datas para o contador */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Início (contador)</Label>
            <Input
              type="date"
              value={periodo.contador_inicio}
              onChange={(e) => onChange({ ...periodo, contador_inicio: e.target.value })}
              disabled={enviado}
              className={enviado ? "bg-muted cursor-not-allowed" : ""}
            />
          </div>
          <div>
            <Label className="text-xs">Fim (contador, automático)</Label>
            <Input type="date" value={periodo.contador_fim} readOnly className="bg-muted cursor-not-allowed" />
          </div>
        </div>

        {/* Tipo do período */}
        <div>
          <Label className="text-xs">Tipo do {index}º período</Label>
          <RadioGroup
            value={periodo.tipo}
            onValueChange={(v) => onChange({ ...periodo, tipo: v as "gozar" | "vender" })}
            className="flex gap-4 mt-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="gozar" id={`p${index}-gozar`} disabled={enviado} />
              <Label htmlFor={`p${index}-gozar`} className={enviado ? "text-muted-foreground" : ""}>Gozar 15 dias</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="vender" id={`p${index}-vender`} disabled={enviado} />
              <Label htmlFor={`p${index}-vender`} className={enviado ? "text-muted-foreground" : ""}>Vender</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Dias vendidos (1–15) */}
        {periodo.tipo === "vender" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Dias vendidos (1–15)</Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={periodo.dias_vendidos || 0}
                disabled={enviado}
                className={enviado ? "bg-muted cursor-not-allowed" : ""}
                onChange={(e) => onChange({ ...periodo, dias_vendidos: Math.min(15, Math.max(1, parseInt(e.target.value) || 1)) })}
              />
            </div>
            <div className="text-xs text-muted-foreground self-end pb-2">
              Gozo interno restante: <strong>{diasGozoInterno} dia{diasGozoInterno !== 1 ? "s" : ""}</strong>
            </div>
          </div>
        )}

        {/* Datas reais de gozo interno */}
        {diasGozoInterno > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
            <div className="text-xs font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <CalendarClock className="h-3 w-3" />
              Gozo interno real ({diasGozoInterno} dia{diasGozoInterno !== 1 ? "s" : ""})
            </div>
            <p className="text-xs text-muted-foreground">
              Datas em que o colaborador efetivamente vai gozar. Se forem iguais às do contador, deixe como está.
              Para gozar em outro mês, ajuste o início abaixo (deve ser posterior ao fim do contador).
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Início do gozo</Label>
                <Input
                  type="date"
                  value={periodo.gozo_inicio}
                  onChange={(e) => onChange({ ...periodo, gozo_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Fim do gozo (automático)</Label>
                <Input type="date" value={periodo.gozo_fim} readOnly className="bg-muted cursor-not-allowed" />
              </div>
            </div>
            {!gozoMesmoMes && periodo.gozo_inicio && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Gozo em mês diferente do contador ({formatBR(periodo.contador_inicio)} → {formatBR(periodo.gozo_inicio)}).
              </p>
            )}
            {gozoError && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{gozoError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PerPeriodoSection({ p1, p2, onP1Change, onP2Change, enviadoQ1, enviadoQ2, enviadoEm }: Props) {
  return (
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm">Edição por período</AlertTitle>
        <AlertDescription className="text-xs">
          Cada período (1º e 2º) é editado de forma independente: tipo (Gozar/Vender), dias vendidos
          e datas reais de gozo interno. Períodos já enviados ao contador ficam travados — apenas as
          datas internas de gozo continuam editáveis.
        </AlertDescription>
      </Alert>
      <PeriodoCard index={1} periodo={p1} onChange={onP1Change} enviado={enviadoQ1} enviadoEm={enviadoEm} />
      <PeriodoCard index={2} periodo={p2} onChange={onP2Change} enviado={enviadoQ2} enviadoEm={enviadoEm} />
    </div>
  );
}

// Helpers usados pelo FeriasDialog para inicializar/serializar estado
export function buildInitialPeriodos(ferias: any | null | undefined): { p1: PeriodoState; p2: PeriodoState } {
  if (!ferias) {
    return {
      p1: { contador_inicio: "", contador_fim: "", tipo: "gozar", dias_vendidos: 0, gozo_inicio: "", gozo_fim: "" },
      p2: { contador_inicio: "", contador_fim: "", tipo: "gozar", dias_vendidos: 0, gozo_inicio: "", gozo_fim: "" },
    };
  }
  const venderQ1 = !!ferias.vender_q1 || (!!ferias.vender_dias && (ferias.quinzena_venda === 1 || ((ferias.dias_vendidos || 0) >= 16)));
  const venderQ2 = !!ferias.vender_q2 || (!!ferias.vender_dias && (ferias.quinzena_venda === 2 || ((ferias.dias_vendidos || 0) >= 16) || (ferias.quinzena_venda == null && (ferias.dias_vendidos || 0) > 0 && (ferias.dias_vendidos || 0) < 16 && !ferias.vender_q1)));
  let diasQ1 = ferias.dias_vendidos_q1 ?? null;
  let diasQ2 = ferias.dias_vendidos_q2 ?? null;
  if (diasQ1 == null && venderQ1) {
    diasQ1 = ferias.quinzena_venda === 1 ? Math.min(ferias.dias_vendidos || 0, 15)
            : ((ferias.dias_vendidos || 0) >= 16 ? 15 : 0);
  }
  if (diasQ2 == null && venderQ2) {
    diasQ2 = ferias.quinzena_venda === 2 ? Math.min(ferias.dias_vendidos || 0, 15)
            : ((ferias.dias_vendidos || 0) >= 16 ? Math.max(0, (ferias.dias_vendidos || 0) - 15) : (ferias.dias_vendidos || 0));
  }
  diasQ1 = Math.min(15, Math.max(0, diasQ1 || 0));
  diasQ2 = Math.min(15, Math.max(0, diasQ2 || 0));

  return {
    p1: {
      contador_inicio: ferias.quinzena1_inicio || "",
      contador_fim: ferias.quinzena1_fim || "",
      tipo: venderQ1 ? "vender" : "gozar",
      dias_vendidos: venderQ1 ? (diasQ1 || 15) : 0,
      gozo_inicio: ferias.gozo_quinzena1_inicio || ferias.quinzena1_inicio || "",
      gozo_fim: ferias.gozo_quinzena1_fim || ferias.quinzena1_fim || "",
    },
    p2: {
      contador_inicio: ferias.quinzena2_inicio || "",
      contador_fim: ferias.quinzena2_fim || "",
      tipo: venderQ2 ? "vender" : "gozar",
      dias_vendidos: venderQ2 ? (diasQ2 || 15) : 0,
      gozo_inicio: ferias.gozo_quinzena2_inicio || ferias.quinzena2_inicio || "",
      gozo_fim: ferias.gozo_quinzena2_fim || ferias.quinzena2_fim || "",
    },
  };
}

export interface PerPeriodoPayload {
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio: string | null;
  quinzena2_fim: string | null;
  gozo_quinzena1_inicio: string | null;
  gozo_quinzena1_fim: string | null;
  gozo_quinzena2_inicio: string | null;
  gozo_quinzena2_fim: string | null;
  vender_q1: boolean;
  vender_q2: boolean;
  dias_vendidos_q1: number | null;
  dias_vendidos_q2: number | null;
  // legados derivados
  vender_dias: boolean;
  dias_vendidos: number | null;
  quinzena_venda: number | null;
  gozo_diferente: boolean;
}

export function serializePerPeriodo(p1: PeriodoState, p2: PeriodoState): PerPeriodoPayload {
  const venderQ1 = p1.tipo === "vender" && p1.dias_vendidos > 0;
  const venderQ2 = p2.tipo === "vender" && p2.dias_vendidos > 0;
  const dq1 = venderQ1 ? p1.dias_vendidos : null;
  const dq2 = venderQ2 ? p2.dias_vendidos : null;
  const totalVend = (dq1 || 0) + (dq2 || 0);
  let quinzenaVenda: number | null = null;
  if (venderQ1 && !venderQ2) quinzenaVenda = 1;
  else if (!venderQ1 && venderQ2) quinzenaVenda = 2;

  // Gozo "diferente" se qualquer gozo interno divergir do período do contador
  const diff1 = !!p1.gozo_inicio && p1.gozo_inicio !== p1.contador_inicio;
  const diff2 = !!p2.gozo_inicio && p2.gozo_inicio !== p2.contador_inicio;

  return {
    quinzena1_inicio: p1.contador_inicio,
    quinzena1_fim: p1.contador_fim,
    quinzena2_inicio: p2.contador_inicio || null,
    quinzena2_fim: p2.contador_fim || null,
    gozo_quinzena1_inicio: p1.gozo_inicio || null,
    gozo_quinzena1_fim: p1.gozo_fim || null,
    gozo_quinzena2_inicio: p2.contador_inicio ? (p2.gozo_inicio || null) : null,
    gozo_quinzena2_fim: p2.contador_inicio ? (p2.gozo_fim || null) : null,
    vender_q1: venderQ1,
    vender_q2: venderQ2,
    dias_vendidos_q1: dq1,
    dias_vendidos_q2: dq2,
    vender_dias: venderQ1 || venderQ2,
    dias_vendidos: totalVend > 0 ? totalVend : null,
    quinzena_venda: quinzenaVenda,
    gozo_diferente: diff1 || diff2,
  };
}

export function validatePerPeriodo(p1: PeriodoState, p2: PeriodoState, enviadoQ1: boolean, enviadoQ2: boolean, originalQ1Fim?: string, originalQ2Fim?: string): string | null {
  if (!p1.contador_inicio || !p1.contador_fim) return "Datas do 1º período (contador) são obrigatórias.";
  if (!p2.contador_inicio || !p2.contador_fim) return "Datas do 2º período (contador) são obrigatórias.";

  const checkP = (label: string, p: PeriodoState, enviado: boolean, origFim?: string) => {
    const dias = p.tipo === "vender" ? p.dias_vendidos : 0;
    const diasGozo = 15 - dias;
    if (p.tipo === "vender" && (dias < 1 || dias > 15)) return `${label}: dias vendidos deve estar entre 1 e 15.`;
    if (diasGozo > 0) {
      if (!p.gozo_inicio || !p.gozo_fim) return `${label}: informe as datas reais de gozo interno.`;
      if (p.gozo_inicio !== p.contador_inicio) {
        const ref = enviado && origFim ? origFim : p.contador_fim;
        try {
          const gi = parseISO(p.gozo_inicio);
          const cf = parseISO(ref);
          if (gi <= cf) {
            return `${label}: o início do gozo interno deve ser posterior a ${formatBR(ref)} (período do contador).`;
          }
        } catch { /* ignore */ }
      }
      try {
        const gi = parseISO(p.gozo_inicio);
        const gf = parseISO(p.gozo_fim);
        const dur = differenceInDays(gf, gi) + 1;
        if (dur !== diasGozo) return `${label}: duração do gozo interno (${dur}d) não bate com o esperado (${diasGozo}d).`;
      } catch { /* ignore */ }
    }
    return null;
  };

  const e1 = checkP("1º período", p1, enviadoQ1, originalQ1Fim);
  if (e1) return e1;
  const e2 = checkP("2º período", p2, enviadoQ2, originalQ2Fim);
  if (e2) return e2;
  return null;
}
