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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MoveRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Folga {
  id: string;
  data_sabado: string;
  colaborador_id: string;
  colaborador?: { nome: string; nome_exibicao: string | null; familiar_id: string | null } | null;
}

interface Colaborador {
  id: string;
  nome: string;
  nome_exibicao: string | null;
  familiar_id: string | null;
}

interface MoverFolgasLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folgas: Folga[];
  saturdaysOfMonth: string[];
  colaboradores: Colaborador[];
}

const getDisplayName = (colaborador: { nome: string; nome_exibicao?: string | null } | null | undefined): string => {
  if (!colaborador) return "—";
  if (colaborador.nome_exibicao) return colaborador.nome_exibicao;
  const parts = colaborador.nome.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export function MoverFolgasLoteDialog({
  open,
  onOpenChange,
  folgas,
  saturdaysOfMonth,
  colaboradores,
}: MoverFolgasLoteDialogProps) {
  const queryClient = useQueryClient();
  const [targetSaturday, setTargetSaturday] = useState<string>("");
  const [selectedColabIds, setSelectedColabIds] = useState<Set<string>>(new Set());

  // Colaboradores que TÊM folga no mês E NÃO estão alocados no sábado alvo
  const availableColabs = useMemo(() => {
    if (!targetSaturday) return [];
    
    // Colaboradores já alocados no sábado alvo
    const allocatedOnTarget = new Set(
      folgas.filter(f => f.data_sabado === targetSaturday).map(f => f.colaborador_id)
    );
    
    // Colaboradores que TÊM folga no mês (apenas esses podem ser movidos)
    const colabsComFolga = new Set(folgas.map(f => f.colaborador_id));
    
    // Retornar apenas colaboradores que TÊM folga E NÃO estão no sábado alvo
    return colaboradores
      .filter(c => colabsComFolga.has(c.id) && !allocatedOnTarget.has(c.id))
      .map(c => {
        const currentFolga = folgas.find(f => f.colaborador_id === c.id);
        return {
          ...c,
          currentSaturday: currentFolga?.data_sabado || null,
          folgaId: currentFolga?.id || null,
        };
      })
      .sort((a, b) => {
        // Ordenar por nome
        return a.nome.localeCompare(b.nome);
      });
  }, [targetSaturday, folgas, colaboradores]);

  // Incluir familiares automaticamente
  const effectiveSelection = useMemo(() => {
    const result = new Set(selectedColabIds);
    
    // Para cada selecionado, incluir familiar se tiver
    for (const colabId of selectedColabIds) {
      const colab = colaboradores.find(c => c.id === colabId);
      if (colab?.familiar_id) {
        // Verificar se o familiar está disponível (não está no sábado alvo)
        const familiarAvailable = availableColabs.some(c => c.id === colab.familiar_id);
        if (familiarAvailable) {
          result.add(colab.familiar_id);
        }
      }
    }
    
    return result;
  }, [selectedColabIds, colaboradores, availableColabs]);

  // Reset quando muda o sábado alvo
  const handleTargetChange = (value: string) => {
    setTargetSaturday(value);
    setSelectedColabIds(new Set());
  };

  // Toggle seleção individual
  const toggleSelection = (colabId: string) => {
    setSelectedColabIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(colabId)) {
        newSet.delete(colabId);
        // Também desmarcar familiar se estiver selecionado
        const colab = colaboradores.find(c => c.id === colabId);
        if (colab?.familiar_id && newSet.has(colab.familiar_id)) {
          newSet.delete(colab.familiar_id);
        }
      } else {
        newSet.add(colabId);
      }
      return newSet;
    });
  };

  // Selecionar/desselecionar todos
  const toggleAll = () => {
    if (selectedColabIds.size === availableColabs.length) {
      setSelectedColabIds(new Set());
    } else {
      setSelectedColabIds(new Set(availableColabs.map(c => c.id)));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (effectiveSelection.size === 0) {
        throw new Error("Selecione ao menos um colaborador");
      }
      if (!targetSaturday) {
        throw new Error("Selecione o sábado alvo");
      }

      const colabsToMove = Array.from(effectiveSelection);
      let updated = 0;
      let inserted = 0;

      for (const colabId of colabsToMove) {
        const colabInfo = availableColabs.find(c => c.id === colabId);
        
        if (colabInfo?.folgaId) {
          // Atualizar folga existente
          const { error } = await supabase
            .from("ferias_folgas")
            .update({
              data_sabado: targetSaturday,
              is_excecao: true,
              excecao_motivo: "Realocado em lote",
              excecao_justificativa: colabInfo.currentSaturday 
                ? `Movido de ${format(new Date(colabInfo.currentSaturday + "T12:00:00"), "dd/MM")} para ${format(new Date(targetSaturday + "T12:00:00"), "dd/MM")}`
                : `Alocado em lote para ${format(new Date(targetSaturday + "T12:00:00"), "dd/MM")}`,
            })
            .eq("id", colabInfo.folgaId);

          if (error) throw error;
          updated++;
        } else {
          // Inserir nova folga
          const { error } = await supabase
            .from("ferias_folgas")
            .insert({
              colaborador_id: colabId,
              data_sabado: targetSaturday,
              is_excecao: true,
              excecao_motivo: "Alocado em lote",
              excecao_justificativa: `Alocado em lote para ${format(new Date(targetSaturday + "T12:00:00"), "dd/MM")}`,
            });

          if (error) throw error;
          inserted++;
        }
      }

      return { updated, inserted, total: updated + inserted };
    },
    onSuccess: (data) => {
      toast.success(`${data.total} folga(s) realocada(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-pdf"] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setTargetSaturday("");
    setSelectedColabIds(new Set());
    onOpenChange(false);
  };

  // Identificar familiares entre os selecionados
  const hasFamiliarInSelection = useMemo(() => {
    for (const colabId of effectiveSelection) {
      const colab = colaboradores.find(c => c.id === colabId);
      if (colab?.familiar_id && effectiveSelection.has(colab.familiar_id)) {
        return true;
      }
    }
    return false;
  }, [effectiveSelection, colaboradores]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mover Folgas em Lote
          </DialogTitle>
          <DialogDescription>
            Selecione o sábado alvo e escolha os colaboradores a realocar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Seletor de sábado ALVO */}
          <div className="space-y-2">
            <Label>Sábado Alvo (destino)</Label>
            <Select value={targetSaturday} onValueChange={handleTargetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o sábado de destino" />
              </SelectTrigger>
              <SelectContent>
                {saturdaysOfMonth.map(sat => {
                  const count = folgas.filter(f => f.data_sabado === sat).length;
                  return (
                    <SelectItem key={sat} value={sat}>
                      {format(new Date(sat + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      <Badge variant="secondary" className="ml-2">{count}</Badge>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de colaboradores NÃO alocados no sábado alvo */}
          {targetSaturday && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Colaboradores para realocar ({availableColabs.length})</Label>
                {availableColabs.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedColabIds.size === availableColabs.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                )}
              </div>
              
              {availableColabs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Todos os colaboradores já estão alocados neste sábado
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                  {availableColabs.map(colab => {
                    const isSelected = effectiveSelection.has(colab.id);
                    const isAutoIncluded = !selectedColabIds.has(colab.id) && effectiveSelection.has(colab.id);
                    
                    return (
                      <div 
                        key={colab.id} 
                        className={cn(
                          "flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer",
                          isAutoIncluded && "bg-sky-50 border border-sky-200"
                        )}
                        onClick={() => toggleSelection(colab.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(colab.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-input cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className={cn(
                            "text-sm font-medium",
                            isAutoIncluded && "text-sky-700"
                          )}>
                            {getDisplayName(colab)}
                          </span>
                          {colab.currentSaturday && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (atual: {format(new Date(colab.currentSaturday + "T12:00:00"), "dd/MM")})
                            </span>
                          )}
                          {isAutoIncluded && (
                            <span className="text-xs text-sky-600 ml-2">(familiar incluído)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Resumo da seleção */}
          {effectiveSelection.size > 0 && (
            <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-muted">
              <MoveRight className="h-4 w-4" />
              <span>
                {effectiveSelection.size} colaborador(es) será(ão) movido(s) para{" "}
                {format(new Date(targetSaturday + "T12:00:00"), "dd/MM", { locale: ptBR })}
              </span>
              {hasFamiliarInSelection && (
                <Badge variant="secondary" className="bg-sky-100 text-sky-800 text-xs">
                  Inclui familiares
                </Badge>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={effectiveSelection.size === 0 || !targetSaturday || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Mover {effectiveSelection.size} Folga(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
