import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, User, Building2, Clock, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface FormularioAnual {
  id: string;
  colaborador_id: string;
  ano_referencia: number;
  periodo1_mes: number | null;
  periodo1_quinzena: string | null;
  periodo2_mes: number | null;
  periodo2_quinzena: string | null;
  periodo3_mes: number | null;
  periodo3_quinzena: string | null;
  periodo_preferencia: number | null;
  vender_dias: boolean | null;
  dias_vender: number | null;
  status: string | null;
  observacao?: string | null;
  data_inicio_preferencia?: string | null;
  data_inicio_q2_preferencia?: string | null;
  modo_periodo?: string | null;
  created_at: string | null;
  updated_at: string | null;
  colaborador?: {
    id: string;
    nome: string;
    setor_titular?: {
      id: string;
      nome: string;
    } | null;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { 
    label: "Pendente", 
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: <Clock className="h-4 w-4" />
  },
  aprovado: { 
    label: "Aprovado", 
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  rejeitado: { 
    label: "Rejeitado", 
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: <XCircle className="h-4 w-4" />
  },
  em_analise: { 
    label: "Em Análise", 
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: <Clock className="h-4 w-4" />
  },
};

interface FormularioAnualViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formulario: FormularioAnual | null;
}

export function FormularioAnualViewDialog({
  open,
  onOpenChange,
  formulario,
}: FormularioAnualViewDialogProps) {
  if (!formulario) return null;

  const status = statusConfig[formulario.status || "pendente"] || statusConfig.pendente;
  const modo30 = formulario.modo_periodo === "30";
  const fmtRange = (d: string | null | undefined, dias: number) => {
    if (!d) return null;
    try {
      const ini = parseISO(d);
      const fim = new Date(ini); fim.setDate(fim.getDate() + dias - 1);
      return `${format(ini, "dd/MM/yyyy")} a ${format(fim, "dd/MM/yyyy")}`;
    } catch { return d; }
  };
  const datas1 = fmtRange(formulario.data_inicio_preferencia, modo30 ? 30 : 15);
  const datas2 = modo30 ? null : fmtRange(formulario.data_inicio_q2_preferencia, 15);

  const formatPeriodo = (mes: number | null, quinzena: string | null) => {
    if (!mes) return null;
    if (!quinzena) return MONTHS[mes - 1];
    return `${quinzena === "1" ? "1ª" : "2ª"} quinzena de ${MONTHS[mes - 1]}`;
  };

  const mesPrefNum = formulario.periodo_preferencia === 2 ? formulario.periodo2_mes
    : formulario.periodo_preferencia === 3 ? formulario.periodo3_mes : formulario.periodo1_mes;
  const mesPreferido = mesPrefNum ? MONTHS[mesPrefNum - 1] : null;
  const periodo1 = formatPeriodo(formulario.periodo1_mes, formulario.periodo1_quinzena);
  const periodo2 = formatPeriodo(formulario.periodo2_mes, formulario.periodo2_quinzena);
  const periodo3 = formatPeriodo(formulario.periodo3_mes, formulario.periodo3_quinzena);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Detalhes do Formulário - {formulario.ano_referencia}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex justify-center">
            <Badge variant="outline" className={`${status.color} gap-2 px-4 py-2 text-base`}>
              {status.icon}
              {status.label}
            </Badge>
          </div>

          {/* Colaborador */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{formulario.colaborador?.nome || "—"}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {formulario.colaborador?.setor_titular?.nome || "Sem setor"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Períodos */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Períodos de Preferência</h4>
            
            {periodo1 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  formulario.periodo_preferencia === 1 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  1ª
                </span>
                <span className="text-sm">{periodo1}</span>
                {formulario.periodo_preferencia === 1 && (
                  <Badge variant="secondary" className="ml-auto text-xs">Preferido</Badge>
                )}
              </div>
            )}

            {periodo2 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  formulario.periodo_preferencia === 2 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  2ª
                </span>
                <span className="text-sm">{periodo2}</span>
                {formulario.periodo_preferencia === 2 && (
                  <Badge variant="secondary" className="ml-auto text-xs">Preferido</Badge>
                )}
              </div>
            )}

            {periodo3 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  formulario.periodo_preferencia === 3 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  3ª
                </span>
                <span className="text-sm">{periodo3}</span>
                {formulario.periodo_preferencia === 3 && (
                  <Badge variant="secondary" className="ml-auto text-xs">Preferido</Badge>
                )}
              </div>
            )}

            {!periodo1 && !periodo2 && !periodo3 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum período informado
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Formato</span>
              <Badge variant="outline">{modo30 ? "30 dias direto" : "15/15"}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{modo30 ? "Período" : "1º período"}</span>
              <span className="text-muted-foreground">{datas1 || (mesPreferido ? `${mesPreferido} (dia definido na geração)` : "Data não informada")}</span>
            </div>
            {!modo30 && (
              <div className="flex items-center justify-between gap-2">
                <span>2º período</span>
                <span className="text-muted-foreground">{datas2 || "Será sugerido na geração"}</span>
              </div>
            )}
          </div>

          {formulario.observacao && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-1">Observação</p>
              <p className="text-muted-foreground whitespace-pre-wrap break-words">{formulario.observacao}</p>
            </div>
          )}

          <Separator />

          {/* Venda de dias */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Venda de dias</span>
            </div>
            {formulario.vender_dias && formulario.dias_vender ? (
              <Badge variant="secondary">{formulario.dias_vender} dias</Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Não</span>
            )}
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Criado em: {formatDate(formulario.created_at)}</p>
            <p>Atualizado em: {formatDate(formulario.updated_at)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
