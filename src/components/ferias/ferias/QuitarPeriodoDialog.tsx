import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuitarPeriodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodos: Array<{
    colaboradorId: string;
    colaboradorNome: string;
    periodoInicio: string;
    periodoFim: string;
    saldo: number;
  }>;
  onConfirm: (diasQuitados: number, observacoes: string) => void;
  isLoading?: boolean;
}

export function QuitarPeriodoDialog({
  open, onOpenChange, periodos, onConfirm, isLoading,
}: QuitarPeriodoDialogProps) {
  const [dias, setDias] = useState(30);
  const [obs, setObs] = useState("Férias gozadas antes da implantação do sistema");

  const isBatch = periodos.length > 1;
  const formatDate = (d: string) => {
    try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  const handleConfirm = () => {
    onConfirm(dias, obs);
    setDias(30);
    setObs("Férias gozadas antes da implantação do sistema");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBatch ? `Quitar ${periodos.length} períodos` : "Quitar período aquisitivo"}
          </DialogTitle>
          <DialogDescription>
            Registre que as férias deste período já foram gozadas antes do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isBatch && periodos.length === 1 && (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Colaborador:</span> {periodos[0].colaboradorNome}</div>
              <div><span className="font-medium">Período:</span> {formatDate(periodos[0].periodoInicio)} a {formatDate(periodos[0].periodoFim)}</div>
              <div><span className="font-medium">Saldo atual:</span> {periodos[0].saldo} dias</div>
            </div>
          )}

          {isBatch && (
            <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto space-y-1">
              {periodos.map((p, i) => (
                <div key={i}>{p.colaboradorNome} — {formatDate(p.periodoInicio)} a {formatDate(p.periodoFim)}</div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Dias a quitar</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={dias}
              onChange={e => setDias(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Ex: Férias gozadas antes do sistema"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || dias < 1 || dias > 30}>
            {isLoading ? "Salvando..." : isBatch ? `Quitar ${periodos.length} períodos` : "Quitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
