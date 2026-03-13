import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Info, AlertTriangle, Plus, Trash2, DollarSign, CalendarClock } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface GozoPeriodo {
  id: string;
  dias: number;
  data_inicio: string;
  data_fim: string;
  referencia_periodo: number;
}

interface ExcecaoPeriodosSectionProps {
  excecaoTipo: "vender" | "gozo_diferente" | null;
  onExcecaoTipoChange: (tipo: "vender" | "gozo_diferente" | null) => void;
  distribuicaoTipo: string;
  onDistribuicaoTipoChange: (tipo: string) => void;
  diasVendidos: number;
  onDiasVendidosChange: (dias: number) => void;
  periodos: GozoPeriodo[];
  onPeriodosChange: (periodos: GozoPeriodo[]) => void;
  q1Inicio: string;
  q1Fim: string;
  q2Inicio: string;
  q2Fim: string;
}

const formatDateBR = (dateStr: string) => {
  try { return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return dateStr; }
};

const calcEndDate = (startDate: string, dias: number): string => {
  if (!startDate || dias <= 0) return "";
  try {
    return format(addDays(parseISO(startDate), dias - 1), "yyyy-MM-dd");
  } catch { return ""; }
};

const genId = () => Math.random().toString(36).substring(2, 9);

// Sub-component: renders a list of sub-periods with add/remove
function SubPeriodosList({
  periodos,
  onChange,
  totalDias,
  referenciaPeriodo,
  label,
}: {
  periodos: GozoPeriodo[];
  onChange: (periodos: GozoPeriodo[]) => void;
  totalDias: number;
  referenciaPeriodo: number;
  label: string;
}) {
  const diasUsados = periodos.reduce((sum, p) => sum + p.dias, 0);
  const diasRestantes = totalDias - diasUsados;

  const addPeriodo = () => {
    const dias = Math.max(1, diasRestantes);
    onChange([...periodos, { id: genId(), dias, data_inicio: "", data_fim: "", referencia_periodo: referenciaPeriodo }]);
  };

  const removePeriodo = (id: string) => {
    onChange(periodos.filter(p => p.id !== id));
  };

  const updatePeriodo = (id: string, field: keyof GozoPeriodo, value: any) => {
    onChange(periodos.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if (field === "dias" || field === "data_inicio") {
        const dias = field === "dias" ? value : updated.dias;
        const inicio = field === "data_inicio" ? value : updated.data_inicio;
        if (inicio && dias > 0) {
          updated.data_fim = calcEndDate(inicio, dias);
        }
      }
      return updated;
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label} — {totalDias} dias</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {periodos.map((p, idx) => (
          <div key={p.id} className="flex items-end gap-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Dias</Label>
                <Input
                  type="number"
                  min={1}
                  max={p.dias + diasRestantes}
                  value={p.dias}
                  onChange={(e) => updatePeriodo(p.id, "dias", Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input
                  type="date"
                  value={p.data_inicio}
                  onChange={(e) => updatePeriodo(p.id, "data_inicio", e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Fim (auto)</Label>
                <Input
                  type="date"
                  value={p.data_fim}
                  readOnly
                  className="h-9 bg-muted cursor-not-allowed"
                />
              </div>
            </div>
            {periodos.length > 1 && (
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removePeriodo(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={addPeriodo} disabled={diasRestantes <= 0}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar período
          </Button>
          <span className={cn("text-sm font-medium", diasRestantes === 0 ? "text-green-600" : diasRestantes < 0 ? "text-destructive" : "text-muted-foreground")}>
            {diasRestantes === 0 ? "✓ Distribuição completa" : diasRestantes > 0 ? `${diasRestantes} dias restantes` : `${Math.abs(diasRestantes)} dias excedentes`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExcecaoPeriodosSection({
  excecaoTipo,
  onExcecaoTipoChange,
  distribuicaoTipo,
  onDistribuicaoTipoChange,
  diasVendidos,
  onDiasVendidosChange,
  periodos,
  onPeriodosChange,
  q1Inicio,
  q1Fim,
  q2Inicio,
  q2Fim,
}: ExcecaoPeriodosSectionProps) {
  const diasGozo = 30 - diasVendidos;

  // Auto-balance for "ambos" in vender mode
  const handleAmbosVendaDiasChange = useCallback((periodo: 1 | 2, dias: number) => {
    const otherDias = diasGozo - dias;
    const updated = periodos.map(p => {
      if (p.referencia_periodo === periodo) {
        const newP = { ...p, dias };
        if (p.data_inicio) newP.data_fim = calcEndDate(p.data_inicio, dias);
        return newP;
      }
      if (p.referencia_periodo === (periodo === 1 ? 2 : 1)) {
        const newP = { ...p, dias: Math.max(0, otherDias) };
        if (p.data_inicio) newP.data_fim = calcEndDate(p.data_inicio, Math.max(0, otherDias));
        return newP;
      }
      return p;
    });
    onPeriodosChange(updated);
  }, [diasGozo, periodos, onPeriodosChange]);

  // Initialize periods when distribuicaoTipo changes
  useEffect(() => {
    if (excecaoTipo === "vender") {
      if (diasGozo <= 0) {
        onPeriodosChange([]);
        return;
      }
      if (distribuicaoTipo === "1") {
        onPeriodosChange([{ id: genId(), dias: diasGozo, data_inicio: "", data_fim: "", referencia_periodo: 1 }]);
      } else if (distribuicaoTipo === "2") {
        onPeriodosChange([{ id: genId(), dias: diasGozo, data_inicio: "", data_fim: "", referencia_periodo: 2 }]);
      } else if (distribuicaoTipo === "ambos") {
        const d1 = Math.ceil(diasGozo / 2);
        const d2 = diasGozo - d1;
        onPeriodosChange([
          { id: genId(), dias: d1, data_inicio: "", data_fim: "", referencia_periodo: 1 },
          { id: genId(), dias: d2, data_inicio: "", data_fim: "", referencia_periodo: 2 },
        ]);
      } else if (distribuicaoTipo === "livre") {
        onPeriodosChange([{ id: genId(), dias: diasGozo, data_inicio: "", data_fim: "", referencia_periodo: 0 }]);
      }
    } else if (excecaoTipo === "gozo_diferente") {
      if (distribuicaoTipo === "1") {
        onPeriodosChange([{ id: genId(), dias: 15, data_inicio: "", data_fim: "", referencia_periodo: 1 }]);
      } else if (distribuicaoTipo === "2") {
        onPeriodosChange([{ id: genId(), dias: 15, data_inicio: "", data_fim: "", referencia_periodo: 2 }]);
      } else if (distribuicaoTipo === "ambos") {
        onPeriodosChange([
          { id: genId(), dias: 15, data_inicio: "", data_fim: "", referencia_periodo: 1 },
          { id: genId(), dias: 15, data_inicio: "", data_fim: "", referencia_periodo: 2 },
        ]);
      }
    }
  }, [distribuicaoTipo, excecaoTipo]);

  // Reset distribuição when diasVendidos changes in vender mode
  useEffect(() => {
    if (excecaoTipo === "vender" && distribuicaoTipo) {
      // Re-trigger period init
      const dt = distribuicaoTipo;
      onDistribuicaoTipoChange("");
      setTimeout(() => onDistribuicaoTipoChange(dt), 0);
    }
  }, [diasVendidos]);

  // Reset when tipo changes
  useEffect(() => {
    onDistribuicaoTipoChange("");
    onPeriodosChange([]);
    if (excecaoTipo === "gozo_diferente") {
      onDiasVendidosChange(0);
    }
  }, [excecaoTipo]);

  return (
    <div className="space-y-4">
      {/* Toggle buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={excecaoTipo === "vender" ? "default" : "outline"}
          size="sm"
          onClick={() => onExcecaoTipoChange(excecaoTipo === "vender" ? null : "vender")}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Vender dias de férias
        </Button>
        <Button
          type="button"
          variant={excecaoTipo === "gozo_diferente" ? "default" : "outline"}
          size="sm"
          onClick={() => onExcecaoTipoChange(excecaoTipo === "gozo_diferente" ? null : "gozo_diferente")}
        >
          <CalendarClock className="h-4 w-4 mr-1" />
          Gozo em datas diferentes
        </Button>
      </div>

      {/* Official periods reference */}
      {(excecaoTipo === "vender" || excecaoTipo === "gozo_diferente") && q1Inicio && q1Fim && (
        <Alert className="border-muted bg-muted/30">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">Períodos oficiais</AlertTitle>
          <AlertDescription className="text-xs">
            1º: {formatDateBR(q1Inicio)} a {formatDateBR(q1Fim)}
            {q2Inicio && q2Fim && ` | 2º: ${formatDateBR(q2Inicio)} a ${formatDateBR(q2Fim)}`}
          </AlertDescription>
        </Alert>
      )}

      {/* ===== VENDER DIAS ===== */}
      {excecaoTipo === "vender" && (
        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
          {/* Days input */}
          <div>
            <Label>Quantidade de dias a vender (1-30)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={diasVendidos || ""}
              onChange={(e) => onDiasVendidosChange(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
              className="mt-1 max-w-[200px]"
            />
          </div>

          {diasVendidos === 30 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Venda integral — sem período de gozo</AlertTitle>
              <AlertDescription className="text-sm">
                Todos os 30 dias serão vendidos. Exige justificativa obrigatória.
              </AlertDescription>
            </Alert>
          )}

          {diasVendidos >= 1 && diasVendidos <= 29 && (
            <>
              {/* Distribuição selector */}
              <div className="space-y-2">
                <Label>Distribuição do gozo ({diasGozo} dias)</Label>
                <div className="flex flex-wrap gap-2">
                  {["1", "2", "ambos", "livre"].map((tipo) => (
                    <Button
                      key={tipo}
                      type="button"
                      variant={distribuicaoTipo === tipo ? "default" : "outline"}
                      size="sm"
                      onClick={() => onDistribuicaoTipoChange(tipo)}
                    >
                      {tipo === "1" ? "1º Período" : tipo === "2" ? "2º Período" : tipo === "ambos" ? "Ambos" : "Livre"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 1º ou 2º Período: single period */}
              {(distribuicaoTipo === "1" || distribuicaoTipo === "2") && periodos.length === 1 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-primary">
                      Gozo no {distribuicaoTipo === "1" ? "1º" : "2º"} período — {diasGozo} dias
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Data de Início</Label>
                      <Input
                        type="date"
                        value={periodos[0].data_inicio}
                        onChange={(e) => {
                          const updated = [...periodos];
                          updated[0] = { ...updated[0], data_inicio: e.target.value, data_fim: calcEndDate(e.target.value, diasGozo) };
                          onPeriodosChange(updated);
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data de Fim (auto)</Label>
                      <Input type="date" value={periodos[0].data_fim} readOnly className="mt-1 bg-muted cursor-not-allowed" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ambos: two periods with auto-balance */}
              {distribuicaoTipo === "ambos" && periodos.length === 2 && (
                <div className="space-y-3">
                  {periodos.map((p, idx) => (
                    <Card key={p.id} className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-primary">
                          {idx === 0 ? "1º" : "2º"} Período
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Dias</Label>
                            <Input
                              type="number"
                              min={0}
                              max={diasGozo}
                              value={p.dias}
                              onChange={(e) => handleAmbosVendaDiasChange(
                                p.referencia_periodo as 1 | 2,
                                Math.min(diasGozo, Math.max(0, parseInt(e.target.value) || 0))
                              )}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Data de Início</Label>
                            <Input
                              type="date"
                              value={p.data_inicio}
                              onChange={(e) => {
                                const updated = [...periodos];
                                updated[idx] = { ...updated[idx], data_inicio: e.target.value, data_fim: calcEndDate(e.target.value, p.dias) };
                                onPeriodosChange(updated);
                              }}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Data de Fim (auto)</Label>
                            <Input type="date" value={p.data_fim} readOnly className="mt-1 bg-muted cursor-not-allowed" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Livre: dynamic list */}
              {distribuicaoTipo === "livre" && (
                <SubPeriodosList
                  periodos={periodos}
                  onChange={onPeriodosChange}
                  totalDias={diasGozo}
                  referenciaPeriodo={0}
                  label="Períodos de gozo (livre)"
                />
              )}
            </>
          )}

          {/* Summary */}
          {diasVendidos >= 1 && (
            <Card className="border-muted bg-muted/30">
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Dias totais de férias:</span>
                  <span className="font-semibold">30 dias</span>
                </div>
                <div className="flex justify-between text-sm text-destructive">
                  <span>Dias vendidos:</span>
                  <span className="font-semibold">-{diasVendidos} dias</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-bold">
                  <span>Dias de gozo:</span>
                  <span>{diasGozo} dias</span>
                </div>
              </CardContent>
            </Card>
          )}

          {diasVendidos > 10 && (
            <Alert variant="destructive" className="border-destructive/30">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Venda acima de 10 dias será registrada como exceção.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* ===== GOZO EM DATAS DIFERENTES ===== */}
      {excecaoTipo === "gozo_diferente" && (
        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
          {/* Period selector */}
          <div className="space-y-2">
            <Label>Período com gozo diferente</Label>
            <div className="flex gap-2">
              {["1", "2", "ambos"].map((tipo) => (
                <Button
                  key={tipo}
                  type="button"
                  variant={distribuicaoTipo === tipo ? "default" : "outline"}
                  size="sm"
                  onClick={() => onDistribuicaoTipoChange(tipo)}
                >
                  {tipo === "1" ? "1º Período" : tipo === "2" ? "2º Período" : "Ambos"}
                </Button>
              ))}
            </div>
          </div>

          {/* Sub-periods for selected period(s) */}
          {(distribuicaoTipo === "1" || distribuicaoTipo === "ambos") && (
            <SubPeriodosList
              periodos={periodos.filter(p => p.referencia_periodo === 1)}
              onChange={(updated) => {
                const others = periodos.filter(p => p.referencia_periodo !== 1);
                onPeriodosChange([...updated, ...others]);
              }}
              totalDias={15}
              referenciaPeriodo={1}
              label="1º Período (Gozo diferente)"
            />
          )}

          {(distribuicaoTipo === "2" || distribuicaoTipo === "ambos") && (
            <SubPeriodosList
              periodos={periodos.filter(p => p.referencia_periodo === 2)}
              onChange={(updated) => {
                const others = periodos.filter(p => p.referencia_periodo !== 2);
                onPeriodosChange([...others, ...updated]);
              }}
              totalDias={15}
              referenciaPeriodo={2}
              label="2º Período (Gozo diferente)"
            />
          )}
        </div>
      )}
    </div>
  );
}
