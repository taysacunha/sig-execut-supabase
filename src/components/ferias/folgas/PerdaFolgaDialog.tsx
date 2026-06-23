import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, CreditCard, Check, ChevronsUpDown } from "lucide-react";

const MOTIVOS_PERDA = [
  { value: "falta_injustificada", label: "Falta injustificada" },
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

interface PerdaRegistrada {
  id: string;
  colaborador_id: string | null;
  ano: number;
  mes: number;
  motivo: string;
  observacoes: string | null;
  colaborador?: { nome: string } | null;
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
  const [popoverOpen, setPopoverOpen] = useState(false);

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
      const { data, error } = await supabase
        .from("ferias_folgas_perdas")
        .insert({
          colaborador_id: colaboradorId,
          ano: year,
          mes: month,
          motivo: motivoKey,
          observacoes: observacoes || null,
          created_by: user.user?.id,
        })
        .select("id, colaborador_id, ano, mes, motivo, observacoes, colaborador:ferias_colaboradores!ferias_folgas_perdas_colaborador_id_fkey(nome)")
        .single();
      if (error) throw error;
      return data as PerdaRegistrada;
    },
    onSuccess: (perda) => {
      toast.success("Perda de folga registrada!");
      queryClient.setQueryData<PerdaRegistrada[]>(["ferias-perdas", year, month], (old = []) => {
        const semDuplicar = old.filter(p => p.colaborador_id !== perda.colaborador_id);
        return [perda, ...semDuplicar];
      });
      queryClient.setQueryData<string[]>(["ferias-perdas-check", year, month], (old = []) => (
        perda.colaborador_id && !old.includes(perda.colaborador_id) ? [...old, perda.colaborador_id] : old
      ));
      queryClient.setQueryData<{ colaborador_id: string | null }[]>(["ferias-perdas-gerador", year, month], (old = []) => {
        if (!perda.colaborador_id || old.some(p => p.colaborador_id === perda.colaborador_id)) return old;
        return [...old, { colaborador_id: perda.colaborador_id }];
      });
      queryClient.invalidateQueries({ queryKey: ["ferias-perdas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-perdas-check"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-perdas-gerador"] });
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
    setPopoverOpen(false);
    onOpenChange(false);
  };

  const availableColaboradores = colaboradores.filter(c => !existingPerdas.includes(c.id));
  const selectedColaborador = availableColaboradores.find(c => c.id === colaboradorId);

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
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between font-normal"
                  disabled={availableColaboradores.length === 0}
                >
                  <span className={cn("truncate", !selectedColaborador && "text-muted-foreground")}>
                    {selectedColaborador
                      ? selectedColaborador.nome
                      : availableColaboradores.length === 0
                        ? "Todos os colaboradores já têm perda registrada"
                        : "Selecione o colaborador"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {availableColaboradores.map(c => (
                        <CommandItem
                          key={c.id}
                          value={c.nome}
                          onSelect={() => {
                            setColaboradorId(c.id);
                            setPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              colaboradorId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {c.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

          <div className="space-y-3">
            <Label>Motivo *</Label>
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
