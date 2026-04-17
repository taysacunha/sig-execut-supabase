import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CreditCard } from "lucide-react";

const MOTIVOS_PERDA = [
  { value: "falta_injustificada", label: "Falta injustificada" },
  { value: "atestado_medico", label: "Atestado médico" },
  { value: "aviso_previo", label: "Aviso prévio" },
  { value: "suspensao", label: "Suspensão disciplinar" },
  { value: "outro", label: "Outro motivo" },
] as const;

interface Colaborador {
  id: string;
  nome: string;
}

interface Afastamento {
  colaborador_id: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
}

interface PerdaFolgaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  selectedSetor?: string;
}

// Get all saturdays of a given month
function getSaturdaysOfMonth(year: number, month: number): string[] {
  const saturdays: string[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 6) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      saturdays.push(`${y}-${m}-${d}`);
    }
    date.setDate(date.getDate() + 1);
  }
  return saturdays;
}

export function PerdaFolgaDialog({ open, onOpenChange, year, month, selectedSetor }: PerdaFolgaDialogProps) {
  const queryClient = useQueryClient();
  const [colaboradorId, setColaboradorId] = useState("");
  const [motivoKey, setMotivoKey] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-perda", selectedSetor],
    queryFn: async () => {
      let query = supabase
        .from("ferias_colaboradores")
        .select("id, nome")
        .eq("status", "ativo");
      if (selectedSetor) {
        query = query.eq("setor_titular_id", selectedSetor);
      }
      const { data, error } = await query.order("nome");
      if (error) throw error;
      return data as Colaborador[];
    },
  });

  const { data: existingPerdas = [] } = useQuery({
    queryKey: ["ferias-perdas-check", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_folgas_perdas")
        .select("colaborador_id")
        .eq("ano", year)
        .eq("mes", month);
      if (error) throw error;
      return data.map(p => p.colaborador_id);
    },
  });

  // Query afastamentos that overlap the selected month
  const { data: afastamentos = [] } = useQuery({
    queryKey: ["ferias-afastamentos-perda", year, month],
    queryFn: async () => {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
      const { data, error } = await supabase
        .from("ferias_afastamentos")
        .select("colaborador_id, data_inicio, data_fim, motivo")
        .lte("data_inicio", monthEnd)
        .gte("data_fim", monthStart);
      if (error) throw error;
      return data as Afastamento[];
    },
  });

  // Query available 'folga' credits for selected colaborador
  const { data: creditosDisponiveis = [] } = useQuery({
    queryKey: ["ferias-creditos-perda-check", colaboradorId],
    queryFn: async () => {
      if (!colaboradorId) return [];
      const { data, error } = await supabase
        .from("ferias_folgas_creditos")
        .select("id, dias")
        .eq("colaborador_id", colaboradorId)
        .eq("tipo", "folga")
        .eq("status", "disponivel");
      if (error) throw error;
      return data || [];
    },
    enabled: !!colaboradorId,
  });

  const totalCreditosDias = creditosDisponiveis.reduce((s: number, c: any) => s + (c.dias || 0), 0);

  const saturdaysOfMonth = useMemo(() => getSaturdaysOfMonth(year, month), [year, month]);

  // Check if a collaborator has an afastamento covering ANY saturday of the month
  const getAfastamentoForColab = (colabId: string): Afastamento | null => {
    const colabAfastamentos = afastamentos.filter(a => a.colaborador_id === colabId);
    if (colabAfastamentos.length === 0) return null;
    const coversAnySaturday = saturdaysOfMonth.some(sat =>
      colabAfastamentos.some(a => sat >= a.data_inicio && sat <= a.data_fim)
    );
    return coversAnySaturday ? colabAfastamentos[0] : null;
  };

  const selectedAfastamento = colaboradorId ? getAfastamentoForColab(colaboradorId) : null;
  const isAfastado = !!selectedAfastamento;

  const addPerdaMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const motivo = MOTIVOS_PERDA.find(m => m.value === motivoKey)?.label || motivoKey;
      const { error } = await supabase
        .from("ferias_folgas_perdas")
        .insert({
          colaborador_id: colaboradorId,
          ano: year,
          mes: month,
          motivo,
          observacoes: observacoes || null,
          created_by: user.user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perda de folga registrada!");
      queryClient.invalidateQueries({ queryKey: ["ferias-perdas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-perdas-check"] });
      handleClose();
    },
    onError: (err: any) => {
      const msg = err?.message || "Erro desconhecido";
      toast.error(`Erro ao registrar perda: ${msg}`);
    },
  });

  const handleClose = () => {
    setColaboradorId("");
    setMotivoKey("");
    setObservacoes("");
    onOpenChange(false);
  };

  const availableColaboradores = colaboradores.filter(c => !existingPerdas.includes(c.id));

  const isFormValid = colaboradorId && motivoKey && (motivoKey !== "outro" || observacoes.trim()) && !isAfastado;

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Perda de Folga</DialogTitle>
          <DialogDescription>
            Registre quando um colaborador perde o direito à folga de sábado do mês.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Colaborador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {availableColaboradores.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Todos os colaboradores já têm perda registrada
                  </div>
                ) : (
                  availableColaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {isAfastado && selectedAfastamento && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este colaborador está afastado de{" "}
                <strong>{formatDate(selectedAfastamento.data_inicio)}</strong> a{" "}
                <strong>{formatDate(selectedAfastamento.data_fim)}</strong> e já não entra na escala de folgas de{" "}
                {String(month).padStart(2, "0")}/{year}. Não é necessário registrar perda.
              </AlertDescription>
            </Alert>
          )}

          {colaboradorId && !isAfastado && totalCreditosDias > 0 && (
            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertDescription>
                Este colaborador possui <strong>{creditosDisponiveis.length} crédito(s)</strong> de folga
                disponível(is) (<strong>{totalCreditosDias} dia(s)</strong>). A perda será registrada normalmente;
                os créditos permanecem disponíveis para uso futuro.
              </AlertDescription>
            </Alert>
          )}

            <RadioGroup value={motivoKey} onValueChange={setMotivoKey} className="space-y-2">
              {MOTIVOS_PERDA.map(motivo => (
                <div key={motivo.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={motivo.value} id={motivo.value} />
                  <Label htmlFor={motivo.value} className="font-normal cursor-pointer">
                    {motivo.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>
              Observações {motivoKey === "outro" && "*"}
            </Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder={motivoKey === "outro" ? "Descreva o motivo..." : "Detalhes adicionais (opcional)"}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => addPerdaMutation.mutate()}
            disabled={!isFormValid || addPerdaMutation.isPending}
          >
            {addPerdaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
