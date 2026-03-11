import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, User, Building2, AlertTriangle, DollarSign } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FeriasViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ferias: any | null;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  em_gozo: "Em Gozo",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  aprovada: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  em_gozo: "bg-green-500/10 text-green-600 border-green-500/20",
  concluida: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

const excecaoMotivoLabels: Record<string, string> = {
  familiar: "Familiar sem coincidência",
  setor: "Conflito de setor",
  conflito_setor: "Conflito de setor",
  conflito_equipe: "Conflito de equipe",
  ajuste_setor: "Ajuste de setor",
  mes_bloqueado: "Férias em janeiro/dezembro",
  venda_acima_limite: "Venda acima de 10 dias",
  periodo_aquisitivo: "Período aquisitivo irregular",
  outro: "Outro",
};

export function FeriasViewDialog({ open, onOpenChange, ferias }: FeriasViewDialogProps) {
  if (!ferias) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Calculate adjusted dates when there's a sale
  const diasVendidos = ferias.dias_vendidos || 0;
  const hasVenda = ferias.vender_dias && diasVendidos > 0;

  const getAdjustedPeriodInfo = () => {
    if (!hasVenda || diasVendidos >= 16) return null;

    // For 1-15 days: calculate remaining per period
    const vendidosP1 = ferias.dias_periodo1 ?? (ferias.quinzena_venda === 1 ? diasVendidos : 0);
    const vendidosP2 = ferias.dias_periodo2 ?? (ferias.quinzena_venda === 2 ? diasVendidos : 0);
    const restantesP1 = 15 - vendidosP1;
    const restantesP2 = 15 - vendidosP2;

    let p1Fim = ferias.quinzena1_fim;
    let p2Fim = ferias.quinzena2_fim;

    if (restantesP1 > 0 && restantesP1 < 15 && ferias.quinzena1_inicio) {
      try {
        p1Fim = format(addDays(parseISO(ferias.quinzena1_inicio), restantesP1 - 1), "yyyy-MM-dd");
      } catch { /* ignore */ }
    }
    if (restantesP2 > 0 && restantesP2 < 15 && ferias.quinzena2_inicio) {
      try {
        p2Fim = format(addDays(parseISO(ferias.quinzena2_inicio), restantesP2 - 1), "yyyy-MM-dd");
      } catch { /* ignore */ }
    }

    return { vendidosP1, vendidosP2, restantesP1, restantesP2, p1Fim, p2Fim };
  };

  const adjustedInfo = getAdjustedPeriodInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Detalhes das Férias
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{ferias.colaborador?.nome || "—"}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {ferias.colaborador?.setor_titular?.nome || "Sem setor"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={statusColors[ferias.status]}>
              {statusLabels[ferias.status] || ferias.status}
            </Badge>
          </div>

          <Separator />

          {/* Periods */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">1º Período (Direito)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {formatDate(ferias.quinzena1_inicio)} a {formatDate(ferias.quinzena1_fim)}
                </p>
              </CardContent>
            </Card>

            {ferias.quinzena2_inicio ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">2º Período (Direito)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {formatDate(ferias.quinzena2_inicio)} a {formatDate(ferias.quinzena2_fim)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-yellow-500/20 bg-yellow-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-600">Período Único</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Apenas 1 período cadastrado</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Gozo diferente */}
          {ferias.gozo_diferente && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Gozo em Datas Diferentes
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {ferias.gozo_quinzena1_inicio && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary">
                          {ferias.gozo_quinzena2_inicio ? "1º Período (Gozo)" : "Gozo Único"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {formatDate(ferias.gozo_quinzena1_inicio)} a {formatDate(ferias.gozo_quinzena1_fim)}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {ferias.gozo_quinzena2_inicio && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary">2º Período (Gozo)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          {formatDate(ferias.gozo_quinzena2_inicio)} a {formatDate(ferias.gozo_quinzena2_fim)}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Venda de dias */}
          {hasVenda && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Venda de Dias</p>
                    <p className="text-sm text-muted-foreground">
                      {diasVendidos} dias vendidos — {30 - diasVendidos} dias restantes
                    </p>
                  </div>
                </div>

                {/* Distribution detail for 1-15 days */}
                {adjustedInfo && (
                  <div className="grid gap-4 md:grid-cols-2 mt-2">
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-primary">1º Período — {adjustedInfo.vendidosP1} vendidos, {adjustedInfo.restantesP1} restantes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {adjustedInfo.restantesP1 > 0 ? (
                          <p className="text-sm">{formatDate(ferias.quinzena1_inicio)} a {formatDate(adjustedInfo.p1Fim)}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Período totalmente vendido</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-primary">2º Período — {adjustedInfo.vendidosP2} vendidos, {adjustedInfo.restantesP2} restantes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {adjustedInfo.restantesP2 > 0 ? (
                          <p className="text-sm">{formatDate(ferias.quinzena2_inicio)} a {formatDate(adjustedInfo.p2Fim)}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Período totalmente vendido</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Residual for >=16 */}
                {diasVendidos >= 16 && diasVendidos < 30 && ferias.gozo_quinzena1_inicio && (
                  <Card className="border-primary/20 bg-primary/5 mt-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-primary">Período de gozo residual — {30 - diasVendidos} dias</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{formatDate(ferias.gozo_quinzena1_inicio)} a {formatDate(ferias.gozo_quinzena1_fim)}</p>
                    </CardContent>
                  </Card>
                )}

                {diasVendidos === 30 && (
                  <p className="text-sm text-destructive font-medium">Venda integral — sem período de gozo</p>
                )}
              </div>
            </>
          )}

          {/* Exceção */}
          {ferias.is_excecao && (
            <>
              <Separator />
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Exceção
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Motivo</p>
                    <p className="text-sm">
                      {excecaoMotivoLabels[ferias.excecao_motivo] || ferias.excecao_motivo || "—"}
                    </p>
                  </div>
                  {ferias.excecao_justificativa && (
                    <div>
                      <p className="text-xs text-muted-foreground">Justificativa</p>
                      <p className="text-sm">{ferias.excecao_justificativa}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Período Aquisitivo */}
          {(ferias.periodo_aquisitivo_inicio || ferias.periodo_aquisitivo_fim) && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Período Aquisitivo</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(ferias.periodo_aquisitivo_inicio)} a {formatDate(ferias.periodo_aquisitivo_fim)}
                </p>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="text-xs text-muted-foreground">
            <p>Criado em: {formatDate(ferias.created_at)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
