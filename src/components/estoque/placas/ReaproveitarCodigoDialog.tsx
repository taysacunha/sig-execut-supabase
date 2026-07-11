import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Placa, TIPO_USO_LABELS, STATUS_LABELS, formatPlacaTamanho, useCodigosReaproveitaveis,
} from "@/hooks/useEstoquePlacas";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  placa: Placa | null;
  materialNome: string;
  localNome: string;
}

export function ReaproveitarCodigoDialog({
  open, onOpenChange, placa, materialNome, localNome,
}: Props) {
  const queryClient = useQueryClient();
  const { data: codigos = [], isLoading } = useCodigosReaproveitaveis();
  const [origemId, setOrigemId] = useState<string>("");

  useEffect(() => { if (open) setOrigemId(""); }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!placa) throw new Error("Placa destino inválida");
      if (!origemId) throw new Error("Selecione um código para reaproveitar");
      const { error } = await (supabase as any).rpc("reaproveitar_codigo_placa", {
        p_placa_destino_id: placa.id,
        p_placa_origem_id: origemId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-placas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-placas-codigos-reaproveitaveis"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-placa-historico"] });
      toast.success("Código reaproveitado com sucesso!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao reaproveitar código"),
  });

  if (!placa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Reaproveitar código
          </DialogTitle>
          <DialogDescription>
            Transfira o código de uma placa roubada ou perdida para esta placa disponível.
            Nenhum saldo é movimentado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="text-xs uppercase text-muted-foreground">Placa destino</div>
            <div><span className="text-muted-foreground">Material:</span> <strong>{materialNome}</strong></div>
            <div>
              <span className="text-muted-foreground">Tipo:</span>{" "}
              {TIPO_USO_LABELS[placa.tipo_uso]} · {formatPlacaTamanho(placa.tamanho, placa.tamanho_outro)}
            </div>
            <div><span className="text-muted-foreground">Local:</span> {localNome}</div>
          </div>

          <div className="space-y-2">
            <Label>Código disponível para reaproveitamento *</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : codigos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum código de placa roubada ou perdida está disponível para reaproveitamento.
              </p>
            ) : (
              <Select value={origemId} onValueChange={setOrigemId}>
                <SelectTrigger><SelectValue placeholder="Selecione o código" /></SelectTrigger>
                <SelectContent>
                  {codigos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {STATUS_LABELS[c.status]}
                      {c.imovel_codigo_atual ? ` · imóvel ${c.imovel_codigo_atual}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={mutation.isPending || !origemId || codigos.length === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar reaproveitamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}