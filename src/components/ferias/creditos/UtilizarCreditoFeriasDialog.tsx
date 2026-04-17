import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CreditCard, Info, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

interface Credito {
  id: string;
  colaborador_id: string;
  dias: number;
  origem_data: string;
  justificativa: string;
  status: string;
  tipo: string;
  colaborador?: { nome: string; nome_exibicao?: string | null } | null;
}

interface FeriasRecord {
  id: string;
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio: string | null;
  quinzena2_fim: string | null;
  status: string | null;
  gozo_diferente: boolean | null;
  gozo_quinzena1_inicio: string | null;
  gozo_quinzena1_fim: string | null;
  gozo_quinzena2_inicio: string | null;
  gozo_quinzena2_fim: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credito: Credito | null;
  allCredits: Credito[]; // all available 'ferias' credits to allow multi-select for same colab
}

type Scenario = "no_ferias" | "not_started" | "partial" | "all_used";

export function UtilizarCreditoFeriasDialog({ open, onOpenChange, credito, allCredits }: Props) {
  const queryClient = useQueryClient();
  const colabId = credito?.colaborador_id;

  const [selectedCreditIds, setSelectedCreditIds] = useState<string[]>([]);
  const [actionType, setActionType] = useState<string>("");
  const [targetFeriasId, setTargetFeriasId] = useState<string>("");
  const [novoInicio, setNovoInicio] = useState("");

  // Eligible credits for the same collaborator
  const colabCredits = useMemo(
    () => allCredits.filter(c => c.colaborador_id === colabId && c.status === "disponivel" && c.tipo === "ferias"),
    [allCredits, colabId]
  );

  const colabName = credito?.colaborador?.nome_exibicao || credito?.colaborador?.nome || "—";

  // Fetch existing ferias for this collaborator
  const { data: feriasExistentes = [], isLoading: loadingFerias } = useQuery({
    queryKey: ["utilizar-credito-ferias", colabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("id, quinzena1_inicio, quinzena1_fim, quinzena2_inicio, quinzena2_fim, status, gozo_diferente, gozo_quinzena1_inicio, gozo_quinzena1_fim, gozo_quinzena2_inicio, gozo_quinzena2_fim")
        .eq("colaborador_id", colabId!)
        .in("status", ["pendente", "aprovada", "ativa", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_gozo", "concluida"])
        .order("quinzena1_inicio");
      if (error) throw error;
      return (data || []) as FeriasRecord[];
    },
    enabled: !!colabId && open,
  });

  // Reset on open
  useEffect(() => {
    if (open && credito) {
      setSelectedCreditIds([credito.id]);
      setActionType("");
      setTargetFeriasId("");
      setNovoInicio("");
    }
  }, [open, credito]);

  const totalDias = useMemo(
    () => colabCredits.filter(c => selectedCreditIds.includes(c.id)).reduce((s, c) => s + c.dias, 0),
    [colabCredits, selectedCreditIds]
  );

  // Detect scenario
  const scenario: Scenario = useMemo(() => {
    if (!feriasExistentes || feriasExistentes.length === 0) return "no_ferias";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periodos: { inicio: string; fim: string }[] = [];
    feriasExistentes.forEach(f => {
      const q1i = f.gozo_diferente && f.gozo_quinzena1_inicio ? f.gozo_quinzena1_inicio : f.quinzena1_inicio;
      const q1f = f.gozo_diferente && f.gozo_quinzena1_fim ? f.gozo_quinzena1_fim : f.quinzena1_fim;
      periodos.push({ inicio: q1i, fim: q1f });
      const q2i = f.gozo_diferente && f.gozo_quinzena2_inicio ? f.gozo_quinzena2_inicio : f.quinzena2_inicio;
      const q2f = f.gozo_diferente && f.gozo_quinzena2_fim ? f.gozo_quinzena2_fim : f.quinzena2_fim;
      if (q2i && q2f) periodos.push({ inicio: q2i, fim: q2f });
    });
    const allUsed = periodos.every(p => parseISO(p.fim) < today);
    const someUsed = periodos.some(p => parseISO(p.fim) < today);
    if (allUsed) return "all_used";
    if (someUsed) return "partial";
    return "not_started";
  }, [feriasExistentes]);

  const remainingPeriodos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: { feriasId: string; label: string; quinzena: 1 | 2; fimAtual: string }[] = [];
    feriasExistentes.forEach(f => {
      const q1i = f.gozo_diferente && f.gozo_quinzena1_inicio ? f.gozo_quinzena1_inicio : f.quinzena1_inicio;
      const q1f = f.gozo_diferente && f.gozo_quinzena1_fim ? f.gozo_quinzena1_fim : f.quinzena1_fim;
      if (parseISO(q1f) >= today) {
        result.push({
          feriasId: f.id,
          label: `1ª Quinzena: ${format(parseISO(q1i), "dd/MM/yyyy")} a ${format(parseISO(q1f), "dd/MM/yyyy")}`,
          quinzena: 1,
          fimAtual: q1f,
        });
      }
      const q2i = f.gozo_diferente && f.gozo_quinzena2_inicio ? f.gozo_quinzena2_inicio : f.quinzena2_inicio;
      const q2f = f.gozo_diferente && f.gozo_quinzena2_fim ? f.gozo_quinzena2_fim : f.quinzena2_fim;
      if (q2i && q2f && parseISO(q2f) >= today) {
        result.push({
          feriasId: f.id,
          label: `2ª Quinzena: ${format(parseISO(q2i), "dd/MM/yyyy")} a ${format(parseISO(q2f), "dd/MM/yyyy")}`,
          quinzena: 2,
          fimAtual: q2f,
        });
      }
    });
    return result;
  }, [feriasExistentes]);

  const handleClose = () => {
    setSelectedCreditIds([]);
    setActionType("");
    setTargetFeriasId("");
    setNovoInicio("");
    onOpenChange(false);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (totalDias === 0) throw new Error("Selecione ao menos um crédito");
      if (!actionType) throw new Error("Selecione uma ação");

      let referencia = "";

      if (actionType === "criar_novo") {
        // Create new ferias period of totalDias days starting at novoInicio
        if (!novoInicio) throw new Error("Informe a data de início");
        const inicio = novoInicio;
        const fim = format(addDays(parseISO(novoInicio), totalDias - 1), "yyyy-MM-dd");
        const { error } = await supabase
          .from("ferias_ferias")
          .insert({
            colaborador_id: colabId,
            quinzena1_inicio: inicio,
            quinzena1_fim: fim,
            is_excecao: true,
            excecao_motivo: "credito_ferias",
            excecao_justificativa: `Período extra de ${totalDias} dia(s) gerado por créditos de férias`,
            origem: "credito",
            status: "aprovada",
          });
        if (error) throw error;
        referencia = `Período extra: ${inicio} a ${fim}`;
      } else if (actionType === "estender") {
        // Extend the data_fim of the chosen period by totalDias
        if (!targetFeriasId) throw new Error("Selecione um período");
        const target = remainingPeriodos.find(p => `${p.feriasId}-${p.quinzena}` === targetFeriasId);
        if (!target) throw new Error("Período inválido");
        const f = feriasExistentes.find(x => x.id === target.feriasId)!;
        const novoFim = format(addDays(parseISO(target.fimAtual), totalDias), "yyyy-MM-dd");

        const updateData: Record<string, any> = {};
        if (target.quinzena === 1) {
          if (f.gozo_diferente) updateData.gozo_quinzena1_fim = novoFim;
          else updateData.quinzena1_fim = novoFim;
        } else {
          if (f.gozo_diferente) updateData.gozo_quinzena2_fim = novoFim;
          else updateData.quinzena2_fim = novoFim;
        }
        updateData.is_excecao = true;
        updateData.excecao_motivo = "credito_ferias_extensao";

        const { error } = await supabase
          .from("ferias_ferias")
          .update(updateData)
          .eq("id", target.feriasId);
        if (error) throw error;
        referencia = `Extensão de período (${target.label}) em ${totalDias} dia(s)`;
      }

      // Mark all selected credits as used
      const { error: credErr } = await supabase
        .from("ferias_folgas_creditos")
        .update({
          status: "utilizado",
          utilizado_em: new Date().toISOString().split("T")[0],
          utilizado_referencia: referencia,
        })
        .in("id", selectedCreditIds);
      if (credErr) throw credErr;
    },
    onSuccess: () => {
      toast.success("Crédito de férias aplicado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ferias-creditos"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-ferias"] });
      queryClient.invalidateQueries({ queryKey: ["utilizar-credito-ferias"] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    },
  });

  const toggleCredit = (id: string) => {
    setSelectedCreditIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const isFormValid = useMemo(() => {
    if (totalDias === 0 || !actionType) return false;
    if (actionType === "criar_novo") return !!novoInicio;
    if (actionType === "estender") return !!targetFeriasId;
    return false;
  }, [totalDias, actionType, novoInicio, targetFeriasId]);

  const scenarioInfo: Record<Scenario, { title: string; desc: string }> = {
    no_ferias: {
      title: "Sem férias cadastradas",
      desc: `${colabName} não possui férias cadastradas. Será criado um período independente apenas com os dias do(s) crédito(s).`,
    },
    not_started: {
      title: "Férias cadastradas (não gozadas)",
      desc: "Você pode estender um dos períodos existentes ou criar um período adicional.",
    },
    partial: {
      title: "Férias parcialmente gozadas",
      desc: "Você pode estender o período restante ou criar um período independente para os dias do crédito.",
    },
    all_used: {
      title: "Todas as férias já gozadas",
      desc: "Será criado um período extra apenas com os dias do(s) crédito(s), marcado como exceção.",
    },
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Utilizar Crédito de Férias
          </DialogTitle>
          <DialogDescription>
            Aplique o(s) crédito(s) de férias de <strong>{colabName}</strong> em períodos novos ou existentes.
          </DialogDescription>
        </DialogHeader>

        {loadingFerias ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Multi-select credits */}
            {colabCredits.length > 1 && (
              <div className="space-y-2">
                <Label>Créditos disponíveis ({colabCredits.length})</Label>
                <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                  {colabCredits.map(c => (
                    <label
                      key={c.id}
                      className="flex items-start gap-3 cursor-pointer hover:bg-background rounded p-2 transition-colors"
                    >
                      <Checkbox
                        checked={selectedCreditIds.includes(c.id)}
                        onCheckedChange={() => toggleCredit(c.id)}
                      />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{c.dias} dia(s) — origem {format(parseISO(c.origem_data), "dd/MM/yyyy")}</div>
                        <div className="text-xs text-muted-foreground">{c.justificativa}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="text-sm font-medium text-primary">
                  Total selecionado: {totalDias} dia(s)
                </div>
              </div>
            )}

            {/* Scenario detection */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{scenarioInfo[scenario].title}</AlertTitle>
              <AlertDescription>{scenarioInfo[scenario].desc}</AlertDescription>
            </Alert>

            {/* Action options */}
            {totalDias > 0 && (
              <div className="space-y-3">
                <Label>O que fazer com os {totalDias} dia(s)?</Label>
                <RadioGroup value={actionType} onValueChange={setActionType}>
                  {/* Always allow creating new */}
                  <div className="flex items-start space-x-2 border rounded p-3 hover:bg-muted/50">
                    <RadioGroupItem value="criar_novo" id="criar_novo" className="mt-1" />
                    <Label htmlFor="criar_novo" className="font-normal cursor-pointer flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <Plane className="h-4 w-4" /> Criar período independente
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Novo período de {totalDias} dia(s) iniciando na data informada.
                      </div>
                    </Label>
                  </div>

                  {/* Only allow extend if there are remaining periodos */}
                  {remainingPeriodos.length > 0 && (
                    <div className="flex items-start space-x-2 border rounded p-3 hover:bg-muted/50">
                      <RadioGroupItem value="estender" id="estender" className="mt-1" />
                      <Label htmlFor="estender" className="font-normal cursor-pointer flex-1">
                        <div className="font-medium">Estender um período existente</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Adiciona {totalDias} dia(s) ao final de uma quinzena ainda não gozada.
                        </div>
                      </Label>
                    </div>
                  )}
                </RadioGroup>

                {/* Action-specific inputs */}
                {actionType === "criar_novo" && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                    <Label>Data de início do novo período *</Label>
                    <Input
                      type="date"
                      value={novoInicio}
                      onChange={(e) => setNovoInicio(e.target.value)}
                    />
                    {novoInicio && (
                      <p className="text-xs text-muted-foreground">
                        Período: {format(parseISO(novoInicio), "dd/MM/yyyy")} a{" "}
                        {format(addDays(parseISO(novoInicio), totalDias - 1), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                )}

                {actionType === "estender" && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                    <Label>Selecione o período a estender *</Label>
                    <RadioGroup value={targetFeriasId} onValueChange={setTargetFeriasId}>
                      {remainingPeriodos.map(p => {
                        const key = `${p.feriasId}-${p.quinzena}`;
                        const novoFim = format(addDays(parseISO(p.fimAtual), totalDias), "yyyy-MM-dd");
                        return (
                          <div key={key} className="flex items-start space-x-2 border rounded p-2">
                            <RadioGroupItem value={key} id={key} className="mt-1" />
                            <Label htmlFor={key} className="font-normal cursor-pointer flex-1 text-sm">
                              <div>{p.label}</div>
                              <div className="text-xs text-primary mt-1">
                                Novo fim: {format(parseISO(novoFim), "dd/MM/yyyy")} (+{totalDias} dia(s))
                              </div>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!isFormValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
