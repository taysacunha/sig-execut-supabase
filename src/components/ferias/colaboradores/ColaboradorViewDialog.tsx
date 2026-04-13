import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Colaborador } from "@/pages/ferias/FeriasColaboradores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Building2, Briefcase, Users, Calendar, FileText, AlertTriangle } from "lucide-react";
import { AfastamentosSection } from "./AfastamentosSection";

interface ColaboradorViewDialogProps {
  open: boolean;
  onOpenChange: () => void;
  colaborador: Colaborador | null;
}

const ColaboradorViewDialog = ({ open, onOpenChange, colaborador }: ColaboradorViewDialogProps) => {
  // Fetch familiar name if exists
  const { data: familiar } = useQuery({
    queryKey: ["ferias-familiar", colaborador?.familiar_id],
    enabled: !!colaborador?.familiar_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("nome")
        .eq("id", colaborador!.familiar_id!)
        .single();
      if (error) return null;
      return data;
    },
  });

  // Fetch setores substitutos
  const { data: setoresSubstitutos = [] } = useQuery({
    queryKey: ["ferias-setores-substitutos-view", colaborador?.id],
    enabled: !!colaborador?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaborador_setores_substitutos")
        .select("setor_id, ferias_setores(nome)")
        .eq("colaborador_id", colaborador!.id);
      if (error) return [];
      return data;
    },
  });

  if (!colaborador) return null;

  const formatDate = (dateString: string) => {
    return format(new Date(dateString + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
  };

  const InfoRow = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) => (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {colaborador.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={colaborador.status === "ativo" ? "default" : "secondary"}>
              {colaborador.status === "ativo" ? "Ativo" : "Inativo"}
            </Badge>
            {colaborador.aviso_previo_inicio && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Em Aviso Prévio
              </Badge>
            )}
          </div>

          <Separator />

          {/* Dados Pessoais */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Dados Pessoais</h4>
            <div className="grid grid-cols-2 gap-x-6">
              <InfoRow label="CPF" value={colaborador.cpf} icon={FileText} />
              <InfoRow label="Data de Nascimento" value={formatDate(colaborador.data_nascimento)} icon={Calendar} />
              <InfoRow label="Data de Admissão" value={formatDate(colaborador.data_admissao)} icon={Calendar} />
              {familiar && (
                <InfoRow label="Familiar Vinculado" value={familiar.nome} icon={Users} />
              )}
            </div>
          </div>

          <Separator />

          {/* Vínculos Organizacionais */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Vínculos Organizacionais</h4>
            <div className="grid grid-cols-2 gap-x-6">
              <InfoRow label="Unidade" value={colaborador.ferias_unidades?.nome} icon={Building2} />
              <InfoRow label="Setor Titular" value={colaborador.ferias_setores?.nome} icon={Briefcase} />
              <InfoRow label="Cargo" value={colaborador.ferias_cargos?.nome} icon={Briefcase} />
              <InfoRow label="Equipe" value={colaborador.ferias_equipes?.nome} icon={Users} />
            </div>
          </div>

          {/* Setores Substitutos */}
          {setoresSubstitutos.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Setores Substitutos</h4>
                <div className="flex flex-wrap gap-2">
                  {setoresSubstitutos.map((s: any) => (
                    <Badge key={s.setor_id} variant="outline">
                      {s.ferias_setores?.nome}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Aviso Prévio */}
          {colaborador.aviso_previo_inicio && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Aviso Prévio
                </h4>
                <div className="grid grid-cols-2 gap-x-6">
                  <InfoRow label="Início" value={formatDate(colaborador.aviso_previo_inicio)} icon={Calendar} />
                  {colaborador.aviso_previo_fim && (
                    <InfoRow label="Fim" value={formatDate(colaborador.aviso_previo_fim)} icon={Calendar} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Afastamentos */}
          <Separator />
          <AfastamentosSection
            colaboradorId={colaborador.id}
            colaboradorNome={colaborador.nome}
          />

          {/* Observações */}
          {colaborador.observacoes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Observações</h4>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                  {colaborador.observacoes}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColaboradorViewDialog;
