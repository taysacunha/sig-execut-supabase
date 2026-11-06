import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wand2, AlertTriangle, CheckCircle2, XCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateVacations, saveGeneratedVacations, recheckVacationConflicts, GenerationResult, GeneratedVacation } from "@/lib/vacationGenerator";
import { addDays, format, parseISO } from "date-fns";
import { PreviewFeriasTable } from "./PreviewFeriasTable";

interface GeradorFeriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anoReferencia: number;
  onSuccess: () => void;
}

export function GeradorFeriasDialog({ open, onOpenChange, anoReferencia, onSuccess }: GeradorFeriasDialogProps) {
  const [setorFilter, setSetorFilter] = useState<string>("all");
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVacations, setSelectedVacations] = useState<Set<string>>(new Set());

  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-gerador"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_setores").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Check forms count (no longer requires "aprovado")
  const { data: formsCount = 0 } = useQuery({
    queryKey: ["ferias-formularios-count", anoReferencia],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ferias_formulario_anual")
        .select("*", { count: "exact", head: true })
        .eq("ano_referencia", anoReferencia);
      if (error) throw error;
      return count || 0;
    },
  });

  useEffect(() => {
    if (open) {
      setGenerationResult(null);
      setSelectedVacations(new Set());
      setSetorFilter("all");
    }
  }, [open]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateVacations(anoReferencia, setorFilter !== "all" ? setorFilter : undefined);
      setGenerationResult(result);
      const successIds = new Set(result.success.map(v => v.colaborador_id));
      setSelectedVacations(successIds);
      toast.success(`Geração concluída: ${result.success.length} sem conflitos, ${result.conflicts.length} com conflitos`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar férias");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generationResult) return;
    setIsSaving(true);
    try {
      const vacationsToSave: GeneratedVacation[] = [
        ...generationResult.success.filter(v => selectedVacations.has(v.colaborador_id)),
        ...generationResult.conflicts.filter(v => selectedVacations.has(v.colaborador_id)),
      ];
      if (vacationsToSave.length === 0) { toast.error("Selecione pelo menos uma férias para salvar"); return; }
      const { saved, errors } = await saveGeneratedVacations(vacationsToSave, true);
      if (errors.length > 0) {
        toast.error(`Salvo ${saved} férias. Erros: ${errors.join(", ")}`);
      } else {
        toast.success(`${saved} férias salvas com sucesso!`);
        onSuccess();
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar férias");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeDate = (colaboradorId: string, periodo: 1 | 2, inicio: string) => {
    if (!inicio) return;
    setGenerationResult((prev) => {
      if (!prev?.context) return prev;
      const fim = format(addDays(parseISO(inicio), 14), "yyyy-MM-dd");
      const patch = (v: GeneratedVacation): GeneratedVacation =>
        v.colaborador_id !== colaboradorId ? v
          : periodo === 1 ? { ...v, quinzena1_inicio: inicio, quinzena1_fim: fim }
          : { ...v, quinzena2_inicio: inicio, quinzena2_fim: fim };
      const success = prev.success.map(patch);
      const conflicts = prev.conflicts.map(patch);
      const all = [...success, ...conflicts];
      const recheck = (v: GeneratedVacation) => ({ ...v, conflicts: recheckVacationConflicts(v, all, prev.context!) });
      return { ...prev, success: success.map(recheck), conflicts: conflicts.map(recheck) };
    });
  };

  const toggleVacationSelection = (colaboradorId: string) => {
    const newSelection = new Set(selectedVacations);
    if (newSelection.has(colaboradorId)) newSelection.delete(colaboradorId);
    else newSelection.add(colaboradorId);
    setSelectedVacations(newSelection);
  };

  const selectAll = (list: GeneratedVacation[]) => {
    const newSelection = new Set(selectedVacations);
    list.forEach(v => newSelection.add(v.colaborador_id));
    setSelectedVacations(newSelection);
  };

  const deselectAll = (list: GeneratedVacation[]) => {
    const newSelection = new Set(selectedVacations);
    list.forEach(v => newSelection.delete(v.colaborador_id));
    setSelectedVacations(newSelection);
  };

  const hasForms = formsCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Gerar Férias Automaticamente - {anoReferencia}
          </DialogTitle>
          <DialogDescription>
            Gera férias a partir dos formulários anuais, respeitando as regras de conflito e priorizando o mês de preferência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasForms && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pré-requisitos não atendidos</AlertTitle>
              <AlertDescription>
                Nenhum formulário anual encontrado para {anoReferencia}.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating || !hasForms}>
              {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : <><Wand2 className="h-4 w-4 mr-2" />Gerar Prévia</>}
            </Button>
          </div>

          {generationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">{generationResult.success.length}</div>
                  <div className="text-sm text-muted-foreground">Sem Conflitos</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-yellow-600">{generationResult.conflicts.length}</div>
                  <div className="text-sm text-muted-foreground">Com Conflitos</div>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                  <XCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                  <div className="text-2xl font-bold text-destructive">{generationResult.unprocessed.length}</div>
                  <div className="text-sm text-muted-foreground">Não Processados</div>
                </div>
              </div>

              <Tabs defaultValue="success" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="success" className="gap-2"><CheckCircle2 className="h-4 w-4" />Sem Conflitos ({generationResult.success.length})</TabsTrigger>
                  <TabsTrigger value="conflicts" className="gap-2"><AlertTriangle className="h-4 w-4" />Com Conflitos ({generationResult.conflicts.length})</TabsTrigger>
                  <TabsTrigger value="unprocessed" className="gap-2"><XCircle className="h-4 w-4" />Não Processados ({generationResult.unprocessed.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="success" className="mt-4">
                  {generationResult.success.length > 0 ? (
                    <PreviewFeriasTable vacations={generationResult.success} selectedIds={selectedVacations} onToggleSelection={toggleVacationSelection} onSelectAll={() => selectAll(generationResult.success)} onDeselectAll={() => deselectAll(generationResult.success)} />
                  ) : <div className="text-center py-8 text-muted-foreground">Nenhuma férias gerada sem conflitos</div>}
                </TabsContent>

                <TabsContent value="conflicts" className="mt-4">
                  {generationResult.conflicts.length > 0 ? (
                    <>
                      <Alert className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Férias com conflitos</AlertTitle>
                        <AlertDescription>A coluna Conflitos mostra em qual período ocorre o choque e com quem. Altere a data de início do período em vermelho aqui mesmo (o fim é calculado em 15 dias); os conflitos são recalculados na hora. Se salvar com conflito, a férias será marcada como exceção.</AlertDescription>
                      </Alert>
                      <PreviewFeriasTable vacations={generationResult.conflicts} selectedIds={selectedVacations} onToggleSelection={toggleVacationSelection} onSelectAll={() => selectAll(generationResult.conflicts)} onDeselectAll={() => deselectAll(generationResult.conflicts)} showConflicts onChangeDate={handleChangeDate} />
                    </>
                  ) : <div className="text-center py-8 text-muted-foreground">Nenhuma férias com conflitos</div>}
                </TabsContent>

                <TabsContent value="unprocessed" className="mt-4">
                  {generationResult.unprocessed.length > 0 ? (
                    <div className="space-y-2">
                      {generationResult.unprocessed.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          <div><span className="font-medium">{item.colaborador_nome}</span><span className="text-muted-foreground ml-2">— {item.motivo}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-center py-8 text-muted-foreground">Todos os formulários foram processados</div>}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {generationResult && <span>{selectedVacations.size} férias selecionadas para salvar</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              {generationResult && (
                <Button onClick={handleSave} disabled={isSaving || selectedVacations.size === 0}>
                  {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar Selecionadas ({selectedVacations.size})</>}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
