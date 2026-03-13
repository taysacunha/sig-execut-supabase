import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, User, Building2, AlertTriangle, DollarSign, Layers } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

const distribuicaoLabels: Record<string, string> = {
  "1": "1º Período",
  "2": "2º Período",
  ambos: "Ambos os Períodos",
  livre: "Distribuição Livre",
};

export function FeriasViewDialog({ open, onOpenChange, ferias }: FeriasViewDialogProps) {
  // Fetch flexible gozo periods when dialog is open and ferias has gozo_flexivel
  const { data: gozoPeriodos = [] } = useQuery({
    queryKey: ["ferias-gozo-periodos", ferias?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_gozo_periodos" as any)
        .select("*")
        .eq("ferias_id", ferias.id)
        .order("numero");
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!ferias?.id && !!ferias?.gozo_flexivel,
  });

  if (!ferias) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const diasVendidos = ferias.dias_vendidos || 0;
  const hasVenda = ferias.vender_dias && diasVendidos > 0;
  const isFlexivel = !!ferias.gozo_flexivel;

  // Group flexible periods by referencia_periodo
  const periodosByRef = gozoPeriodos.reduce((acc: Record<string, any[]>, p: any) => {
    const key = p.referencia_periodo ? String(p.referencia_periodo) : "livre";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

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

          {/* Official Periods - always 2 */}
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">2º Período (Direito)</CardTitle>
              </CardHeader>
              <CardContent>
                {ferias.quinzena2_inicio ? (
                  <p className="text-sm">
                    {formatDate(ferias.quinzena2_inicio)} a {formatDate(ferias.quinzena2_fim)}
                  </p>
                ) : (
                  <p className="text-sm text-amber-600 italic">Ainda não definido</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Flexible gozo periods */}
          {isFlexivel && gozoPeriodos.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Períodos de Gozo
                  {ferias.distribuicao_tipo && (
                    <Badge variant="secondary" className="text-xs">
                      {distribuicaoLabels[ferias.distribuicao_tipo] || ferias.distribuicao_tipo}
                    </Badge>
                  )}
                </h4>

                {Object.entries(periodosByRef).map(([refKey, periodos]) => (
                  <div key={refKey} className="space-y-2">
                    {refKey !== "livre" && (
                      <p className="text-xs text-muted-foreground font-medium">
                        Ref. {refKey}º Período
                      </p>
                    )}
                    <div className="grid gap-2 md:grid-cols-2">
                      {(periodos as any[]).map((p: any, idx: number) => (
                        <Card key={p.id || idx} className="border-primary/20 bg-primary/5">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-primary">
                                Sub-período {p.numero || idx + 1}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {p.dias} dias
                              </Badge>
                            </div>
                            <p className="text-sm">
                              {formatDate(p.data_inicio)} a {formatDate(p.data_fim)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Legacy gozo diferente (non-flexible) */}
          {!isFlexivel && ferias.gozo_diferente && (
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

                {/* Legacy gozo dates from sale (non-flexible) */}
                {!isFlexivel && ferias.gozo_quinzena1_inicio && (
                  <div className="grid gap-4 md:grid-cols-2 mt-2">
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-primary">
                          {ferias.gozo_quinzena2_inicio ? "1º Período de Gozo" : "Período de Gozo"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{formatDate(ferias.gozo_quinzena1_inicio)} a {formatDate(ferias.gozo_quinzena1_fim)}</p>
                      </CardContent>
                    </Card>
                    {ferias.gozo_quinzena2_inicio && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-primary">2º Período de Gozo</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{formatDate(ferias.gozo_quinzena2_inicio)} a {formatDate(ferias.gozo_quinzena2_fim)}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
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
