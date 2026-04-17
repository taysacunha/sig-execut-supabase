import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, isSaturday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CalendarDays } from "lucide-react";

interface Credito {
  id: string;
  colaborador_id: string;
  dias: number;
  origem_data: string;
  justificativa: string;
  colaborador?: { nome: string; nome_exibicao?: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credito: Credito | null;
}

// Get all future Saturdays for the next 6 months
function getFutureSaturdays(monthsAhead = 6): string[] {
  const result: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = addMonths(today, monthsAhead);
  const cursor = new Date(today);
  while (cursor <= end) {
    if (isSaturday(cursor)) {
      result.push(format(cursor, "yyyy-MM-dd"));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function UtilizarCreditoFolgaDialog({ open, onOpenChange, credito }: Props) {
  const queryClient = useQueryClient();
  const [dataSabado, setDataSabado] = useState("");

  const saturdays = useMemo(() => getFutureSaturdays(6), []);

  const colabName = credito?.colaborador?.nome_exibicao || credito?.colaborador?.nome || "—";

  const handleClose = () => {
    setDataSabado("");
    onOpenChange(false);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!credito || !dataSabado) throw new Error("Dados incompletos");

      // Insert folga as exception
      const { error: folgaError } = await supabase
        .from("ferias_folgas")
        .insert({
          colaborador_id: credito.colaborador_id,
          data_sabado: dataSabado,
          is_excecao: true,
          excecao_motivo: "credito_folga",
          excecao_justificativa: `Crédito de folga — origem ${credito.origem_data}`,
        });
      if (folgaError) throw folgaError;

      // Mark credit as used
      const { error: creditError } = await supabase
        .from("ferias_folgas_creditos")
        .update({
          status: "utilizado",
          utilizado_em: new Date().toISOString().split("T")[0],
          utilizado_referencia: `Folga em ${dataSabado}`,
        })
        .eq("id", credito.id);
      if (creditError) throw creditError;
    },
    onSuccess: () => {
      toast.success("Crédito utilizado e folga agendada!");
      queryClient.invalidateQueries({ queryKey: ["ferias-creditos"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-pdf"] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(`Erro ao utilizar crédito: ${err?.message || "Erro desconhecido"}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Utilizar Crédito de Folga
          </DialogTitle>
          <DialogDescription>
            Agende uma folga extra (sábado) consumindo o crédito de <strong>{colabName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert>
            <CalendarDays className="h-4 w-4" />
            <AlertDescription>
              <strong>{credito?.dias || 0} dia(s)</strong> de crédito serão consumidos. A folga será marcada como exceção.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Data do Sábado *</Label>
            <Select value={dataSabado} onValueChange={setDataSabado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um sábado" />
              </SelectTrigger>
              <SelectContent>
                {saturdays.map((s) => (
                  <SelectItem key={s} value={s}>
                    {format(new Date(s + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Apenas sábados futuros (próximos 6 meses)</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!dataSabado || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
