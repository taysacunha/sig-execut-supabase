import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeftRight, AlertTriangle } from "lucide-react";

interface Folga {
  id: string;
  data_sabado: string;
  colaborador_id: string;
  colaborador?: { nome: string; familiar_id?: string | null } | null;
}

interface TrocarFolgaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folga: Folga | null;
  allFolgas: Folga[];
}

export function TrocarFolgaDialog({
  open,
  onOpenChange,
  folga,
  allFolgas,
}: TrocarFolgaDialogProps) {
  const queryClient = useQueryClient();
  const [targetFolgaId, setTargetFolgaId] = useState("");

  // Query colaboradores para saber quem tem familiar
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-troca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, familiar_id")
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Mapa de colaboradores para acesso rápido
  const colabMap = useMemo(() => new Map(colaboradores.map(c => [c.id, c])), [colaboradores]);

  // Get other folgas (different collaborator, não incluindo familiares do colaborador atual)
  const otherFolgas = useMemo(() => {
    if (!folga) return [];
    
    const currentColab = colabMap.get(folga.colaborador_id);
    const excludeIds = new Set([folga.colaborador_id]);
    
    // Se o colaborador atual tem familiar, excluir também
    if (currentColab?.familiar_id) {
      excludeIds.add(currentColab.familiar_id);
    }
    
    return allFolgas.filter(f => !excludeIds.has(f.colaborador_id));
  }, [allFolgas, folga, colabMap]);

  // Verificar se a troca envolve grupos familiares
  const targetFolga = allFolgas.find(f => f.id === targetFolgaId);
  
  const swapInfo = useMemo(() => {
    if (!folga || !targetFolga) return null;
    
    const sourceColab = colabMap.get(folga.colaborador_id);
    const targetColab = colabMap.get(targetFolga.colaborador_id);
    
    const sourceFamiliarId = sourceColab?.familiar_id;
    const targetFamiliarId = targetColab?.familiar_id;
    
    // Verificar se familiares tem folgas no mês
    const sourceFamiliarFolga = sourceFamiliarId 
      ? allFolgas.find(f => f.colaborador_id === sourceFamiliarId)
      : null;
    const targetFamiliarFolga = targetFamiliarId 
      ? allFolgas.find(f => f.colaborador_id === targetFamiliarId)
      : null;
    
    // Detectar se há inconsistência (um tem familiar com folga e outro não)
    const hasInconsistency = (sourceFamiliarFolga && !targetFamiliarFolga) || 
                             (!sourceFamiliarFolga && targetFamiliarFolga);
    
    return {
      sourceFamiliarFolga,
      targetFamiliarFolga,
      hasInconsistency,
      sourceFamiliarId,
      targetFamiliarId,
    };
  }, [folga, targetFolga, colabMap, allFolgas]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!folga || !targetFolgaId || !swapInfo) throw new Error("Dados inválidos");

      const target = allFolgas.find((f) => f.id === targetFolgaId);
      if (!target) throw new Error("Folga destino não encontrada");

      const fmt = (s: string) => format(new Date(s + "T12:00:00"), "dd/MM");
      const sourceName = folga.colaborador?.nome || "colega";
      const targetName = target.colaborador?.nome || "colega";
      const justSrc = `Trocada com ${targetName} (${fmt(folga.data_sabado)} ↔ ${fmt(target.data_sabado)})`;
      const justTgt = `Trocada com ${sourceName} (${fmt(target.data_sabado)} ↔ ${fmt(folga.data_sabado)})`;

      // Troca principal
      const { error: error1 } = await supabase
        .from("ferias_folgas")
        .update({
          data_sabado: target.data_sabado,
          is_excecao: true,
          excecao_motivo: "Troca entre colaboradores",
          excecao_justificativa: justSrc,
        })
        .eq("id", folga.id);

      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from("ferias_folgas")
        .update({
          data_sabado: folga.data_sabado,
          is_excecao: true,
          excecao_motivo: "Troca entre colaboradores",
          excecao_justificativa: justTgt,
        })
        .eq("id", target.id);

      if (error2) throw error2;

      // Se ambos têm familiares com folgas, trocar também
      if (swapInfo.sourceFamiliarFolga && swapInfo.targetFamiliarFolga) {
        const { error: error3 } = await supabase
          .from("ferias_folgas")
          .update({
            data_sabado: target.data_sabado,
            is_excecao: true,
            excecao_motivo: "Troca junto com familiar",
            excecao_justificativa: `Trocada com familiar de ${targetName} (${fmt(swapInfo.sourceFamiliarFolga.data_sabado)} ↔ ${fmt(target.data_sabado)})`,
          })
          .eq("id", swapInfo.sourceFamiliarFolga.id);

        if (error3) throw error3;

        const { error: error4 } = await supabase
          .from("ferias_folgas")
          .update({
            data_sabado: folga.data_sabado,
            is_excecao: true,
            excecao_motivo: "Troca junto com familiar",
            excecao_justificativa: `Trocada com familiar de ${sourceName} (${fmt(swapInfo.targetFamiliarFolga.data_sabado)} ↔ ${fmt(folga.data_sabado)})`,
          })
          .eq("id", swapInfo.targetFamiliarFolga.id);

        if (error4) throw error4;
      }
    },
    onSuccess: () => {
      toast.success("Folgas trocadas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-pdf"] });
      onOpenChange(false);
      setTargetFolgaId("");
    },
    onError: () => toast.error("Erro ao trocar folgas"),
  });

  const canSwap = !swapInfo?.hasInconsistency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Trocar Folgas entre Colaboradores
          </DialogTitle>
          <DialogDescription>
            Troque os sábados de folga entre dois colaboradores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Colaborador 1</Label>
            <div className="p-3 bg-muted rounded-md">
              <div className="font-medium">
                {folga?.colaborador?.nome || "—"}
              </div>
              <div className="text-sm text-muted-foreground">
                Sábado:{" "}
                {folga
                  ? format(
                      new Date(folga.data_sabado + "T12:00:00"),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )
                  : "—"}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label>Trocar com *</Label>
            <Select value={targetFolgaId} onValueChange={setTargetFolgaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {otherFolgas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.colaborador?.nome || "—"} -{" "}
                    {format(new Date(f.data_sabado + "T12:00:00"), "dd/MM", {
                      locale: ptBR,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {swapInfo?.hasInconsistency && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Não é possível realizar esta troca: um dos colaboradores tem familiar com folga no mês, mas o outro não. 
                Isso quebraria a regra de familiares folgando juntos.
              </span>
            </div>
          )}

          {swapInfo && !swapInfo.hasInconsistency && swapInfo.sourceFamiliarFolga && swapInfo.targetFamiliarFolga && (
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-sm">
              <strong>Nota:</strong> Ambos os colaboradores têm familiares com folgas. 
              A troca será aplicada aos dois pares para manter a regra de familiares juntos.
            </div>
          )}

          {targetFolga && canSwap && (
            <div className="p-3 bg-primary/10 rounded-md border border-primary/20">
              <div className="text-sm font-medium">Resultado da troca:</div>
              <div className="text-sm mt-1">
                • {folga?.colaborador?.nome} →{" "}
                {format(
                  new Date(targetFolga.data_sabado + "T12:00:00"),
                  "dd/MM",
                  { locale: ptBR }
                )}
              </div>
              <div className="text-sm">
                • {targetFolga.colaborador?.nome} →{" "}
                {folga
                  ? format(new Date(folga.data_sabado + "T12:00:00"), "dd/MM", {
                      locale: ptBR,
                    })
                  : "—"}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!targetFolgaId || mutation.isPending || !canSwap}
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Trocar Folgas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
