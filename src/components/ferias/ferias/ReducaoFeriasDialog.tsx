import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays, differenceInCalendarDays } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CalendarMinus, AlertTriangle } from "lucide-react";

interface ReducaoFeriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ferias: any | null;
  colaboradorNome: string;
  onSuccess: () => void;
}

/** Calcula dias restantes considerando o tipo de férias (padrão x exceção/gozo diferente). */
function calcDiasRestantes(ferias: any) {
  if (!ferias) return { total: 0, gozados: 0, vendidos: 0, disponiveis: 0, endField: "quinzena2_fim" };

  const useGozo = ferias.gozo_diferente || ferias.is_excecao;
  const q1Inicio = useGozo && ferias.gozo_quinzena1_inicio ? ferias.gozo_quinzena1_inicio : ferias.quinzena1_inicio;
  const q1Fim = useGozo && ferias.gozo_quinzena1_fim ? ferias.gozo_quinzena1_fim : ferias.quinzena1_fim;
  const q2Inicio = useGozo && ferias.gozo_quinzena2_inicio ? ferias.gozo_quinzena2_inicio : ferias.quinzena2_inicio;
  const q2Fim = useGozo && ferias.gozo_quinzena2_fim ? ferias.gozo_quinzena2_fim : ferias.quinzena2_fim;

  const dias = (inicio?: string | null, fim?: string | null) => {
    if (!inicio || !fim) return 0;
    return differenceInCalendarDays(parseISO(fim), parseISO(inicio)) + 1;
  };

  const dq1 = dias(q1Inicio, q1Fim);
  const dq2 = dias(q2Inicio, q2Fim);
  const total = dq1 + dq2;

  // Determinar dias já gozados (períodos com data_fim < hoje)
  const hoje = new Date();
  const gozadoQ1 = q1Fim && parseISO(q1Fim) < hoje ? dq1 : 0;
  const gozadoQ2 = q2Fim && parseISO(q2Fim) < hoje ? dq2 : 0;
  const gozados = gozadoQ1 + gozadoQ2;

  const vendidos = ferias.dias_vendidos || 0;
  const disponiveis = Math.max(0, total - gozados);

  // Escolher o último período com dias restantes (preferir q2 se ainda não totalmente gozado)
  let endField: string;
  if (q2Inicio && q2Fim && parseISO(q2Fim) >= hoje) {
    endField = useGozo && ferias.gozo_quinzena2_fim ? "gozo_quinzena2_fim" : "quinzena2_fim";
  } else if (q1Fim && parseISO(q1Fim) >= hoje) {
    endField = useGozo && ferias.gozo_quinzena1_fim ? "gozo_quinzena1_fim" : "quinzena1_fim";
  } else {
    // Fallback - tudo já gozado, usar q2 se houver, senão q1
    endField = q2Fim
      ? (useGozo && ferias.gozo_quinzena2_fim ? "gozo_quinzena2_fim" : "quinzena2_fim")
      : (useGozo && ferias.gozo_quinzena1_fim ? "gozo_quinzena1_fim" : "quinzena1_fim");
  }

  return { total, gozados, vendidos, disponiveis, endField };
}

export function ReducaoFeriasDialog({ open, onOpenChange, ferias, colaboradorNome, onSuccess }: ReducaoFeriasDialogProps) {
  const queryClient = useQueryClient();
  const [diasReduzir, setDiasReduzir] = useState(1);
  const [justificativa, setJustificativa] = useState("");

  const calc = useMemo(() => calcDiasRestantes(ferias), [ferias]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!ferias) throw new Error("Férias não encontrada");
      if (!justificativa.trim()) throw new Error("Justificativa é obrigatória");
      if (diasReduzir < 1) throw new Error("Informe pelo menos 1 dia");
      if (diasReduzir > calc.disponiveis) throw new Error(`Máximo disponível para reduzir: ${calc.disponiveis} dia(s)`);

      const { data: { user } } = await supabase.auth.getUser();

      const endDateField = calc.endField;
      const currentEnd = parseISO(ferias[endDateField]);
      const newEnd = subDays(currentEnd, diasReduzir);

      // Insert credit
      const { error: creditError } = await supabase
        .from("ferias_folgas_creditos")
        .insert({
          colaborador_id: ferias.colaborador_id,
          tipo: "ferias",
          origem_data: ferias[endDateField],
          dias: diasReduzir,
          justificativa: justificativa.trim(),
          status: "disponivel",
          created_by: user?.id || null,
        });
      if (creditError) throw creditError;

      // Update ferias end date
      const updatePayload: Record<string, string> = {};
      updatePayload[endDateField] = format(newEnd, "yyyy-MM-dd");

      const { error } = await supabase
        .from("ferias_ferias")
        .update(updatePayload)
        .eq("id", ferias.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${diasReduzir} dia(s) de férias removido(s) e crédito gerado!`);
      queryClient.invalidateQueries({ queryKey: ["ferias-ferias"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-creditos"] });
      onSuccess();
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao reduzir férias");
    },
  });

  const handleClose = () => {
    setDiasReduzir(1);
    setJustificativa("");
    onOpenChange(false);
  };

  const noDisponiveis = calc.disponiveis === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarMinus className="h-5 w-5 text-warning" />
            Reduzir Dias de Férias
          </DialogTitle>
          <DialogDescription>
            Reduzir dias de férias de <strong>{colaboradorNome}</strong>. 
            Os dias removidos serão registrados como crédito.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {noDisponiveis ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não há dias restantes para reduzir. Total: {calc.total} dia(s) — Vendidos: {calc.vendidos} — Já gozados: {calc.gozados}.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription className="text-xs">
                Disponível para reduzir: <strong>{calc.disponiveis} dia(s)</strong>
                {calc.vendidos > 0 && <> · {calc.vendidos} vendidos</>}
                {calc.gozados > 0 && <> · {calc.gozados} já gozados</>}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Dias a reduzir *</Label>
            <Input
              type="number"
              min={1}
              max={calc.disponiveis}
              value={diasReduzir}
              onChange={(e) => setDiasReduzir(parseInt(e.target.value) || 1)}
              disabled={noDisponiveis}
            />
          </div>

          <div className="space-y-2">
            <Label>Justificativa *</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Colaborador precisa retornar 3 dias antes por demanda da imobiliária..."
              rows={3}
              disabled={noDisponiveis}
            />
          </div>

          {!noDisponiveis && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              O colaborador receberá {diasReduzir} dia(s) de crédito que poderá(ão) ser utilizado(s) 
              em outras férias ou pago(s). Este registro ficará apenas no controle interno.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={noDisponiveis || !justificativa.trim() || diasReduzir < 1 || diasReduzir > calc.disponiveis || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Redução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
