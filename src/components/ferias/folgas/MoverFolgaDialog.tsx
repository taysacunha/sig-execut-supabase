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
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight } from "lucide-react";

interface Folga {
  id: string;
  data_sabado: string;
  colaborador_id: string;
  colaborador?: { nome: string; nome_exibicao?: string | null; familiar_id?: string | null } | null;
}

interface MoverFolgaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folga: Folga | null;
  saturdaysOfMonth: string[];
}

const getDisplayName = (colaborador: Folga["colaborador"]): string => {
  if (!colaborador) return "colaborador";
  if (colaborador.nome_exibicao) return colaborador.nome_exibicao;
  const parts = colaborador.nome.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export function MoverFolgaDialog({
  open,
  onOpenChange,
  folga,
  saturdaysOfMonth,
}: MoverFolgaDialogProps) {
  const queryClient = useQueryClient();
  const [newSaturday, setNewSaturday] = useState("");

  // Query para buscar folgas do mês (para encontrar familiar)
  const { data: allFolgas = [] } = useQuery({
    queryKey: ["ferias-folgas-move-dialog", saturdaysOfMonth[0]],
    queryFn: async () => {
      if (!saturdaysOfMonth.length) return [];
      const monthStart = saturdaysOfMonth[0];
      const monthEnd = saturdaysOfMonth[saturdaysOfMonth.length - 1];
      
      const { data, error } = await supabase
        .from("ferias_folgas")
        .select("id, data_sabado, colaborador_id")
        .gte("data_sabado", monthStart)
        .lte("data_sabado", monthEnd);

      if (error) throw error;
      return data;
    },
    enabled: open && saturdaysOfMonth.length > 0,
  });

  // Verificar se tem familiar
  const familiarId = folga?.colaborador?.familiar_id;
  const familiarFolga = useMemo(() => {
    if (!familiarId) return null;
    return allFolgas.find(f => f.colaborador_id === familiarId);
  }, [familiarId, allFolgas]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!folga || !newSaturday) throw new Error("Dados inválidos");

      const fmt = (s: string) => format(new Date(s + "T12:00:00"), "dd/MM");
      const justificativa = `Movida de ${fmt(folga.data_sabado)} para ${fmt(newSaturday)}`;

      // Mover a folga principal
      const { error } = await supabase
        .from("ferias_folgas")
        .update({
          data_sabado: newSaturday,
          is_excecao: true,
          excecao_motivo: "Mudança de sábado",
          excecao_justificativa: justificativa,
        })
        .eq("id", folga.id);

      if (error) throw error;

      // Se tem familiar com folga no mês, mover junto
      if (familiarFolga) {
        const familiarJust = `Movida de ${fmt(familiarFolga.data_sabado)} para ${fmt(newSaturday)} (junto com familiar)`;
        const { error: familiarError } = await supabase
          .from("ferias_folgas")
          .update({
            data_sabado: newSaturday,
            is_excecao: true,
            excecao_motivo: "Movido junto com familiar",
            excecao_justificativa: familiarJust,
          })
          .eq("id", familiarFolga.id);

        if (familiarError) throw familiarError;
      }
    },
    onSuccess: () => {
      toast.success(familiarFolga 
        ? "Folgas movidas com sucesso (incluindo familiar)!" 
        : "Folga movida com sucesso!"
      );
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-pdf"] });
      onOpenChange(false);
      setNewSaturday("");
    },
    onError: () => toast.error("Erro ao mover folga"),
  });

  const availableSaturdays = saturdaysOfMonth.filter(
    (sat) => sat !== folga?.data_sabado
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Mover Folga de Sábado
          </DialogTitle>
          <DialogDescription>
            Mover a folga de {getDisplayName(folga?.colaborador)} para outro sábado do mês.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Sábado Atual</Label>
            <div className="p-3 bg-muted rounded-md font-medium">
              {folga
                ? format(
                    new Date(folga.data_sabado + "T12:00:00"),
                    "dd/MM/yyyy (EEEE)",
                    { locale: ptBR }
                  )
                : "—"}
            </div>
          </div>

          {familiarFolga && (
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-sm">
              <strong>Atenção:</strong> O familiar também tem folga neste mês e será movido junto para manter a regra de familiares juntos.
            </div>
          )}

          <div className="space-y-2">
            <Label>Novo Sábado *</Label>
            <Select value={newSaturday} onValueChange={setNewSaturday}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo sábado" />
              </SelectTrigger>
              <SelectContent>
                {availableSaturdays.map((sat) => (
                  <SelectItem key={sat} value={sat}>
                    {format(new Date(sat + "T12:00:00"), "dd/MM/yyyy (EEEE)", {
                      locale: ptBR,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!newSaturday || mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {familiarFolga ? "Mover Ambos" : "Mover Folga"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
