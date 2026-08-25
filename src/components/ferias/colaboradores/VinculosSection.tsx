import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import {
  useColaboradorVinculos,
  labelTipoDesligamento,
} from "@/hooks/ferias/useColaboradorVinculos";

interface Props {
  colaboradorId: string;
}

const fmt = (d?: string | null) =>
  d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : null;

export function VinculosSection({ colaboradorId }: Props) {
  const { data: vinculos = [], isLoading } = useColaboradorVinculos(colaboradorId);

  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
        <History className="h-4 w-4" />
        Histórico de vínculos
      </h4>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : vinculos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum vínculo registrado.</p>
      ) : (
        <div className="space-y-2">
          {vinculos.map((v) => (
            <div key={v.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium">
                  {fmt(v.data_admissao)} → {fmt(v.data_demissao) ?? "atual"}
                </span>
                <Badge variant={v.data_demissao ? "secondary" : "default"}>
                  {v.data_demissao ? "Encerrado" : "Vínculo ativo"}
                </Badge>
              </div>
              {v.data_demissao && (
                <p className="text-xs text-muted-foreground mt-1">
                  Desligamento: {labelTipoDesligamento(v.tipo_desligamento)}
                </p>
              )}
              {v.motivo && <p className="text-xs text-muted-foreground">Motivo: {v.motivo}</p>}
              {v.observacao && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  Obs.: {v.observacao}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
