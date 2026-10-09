import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { traduzirErroDespesas } from "@/lib/despesasErros";
import { useBaixarEncargoVeiculo } from "@/hooks/useDespesasVeiculos";
import type { Lancamento } from "@/hooks/useDespesasLancamentos";
import { podeBaixarEncargoVeiculo } from "@/lib/veiculoEncargos";

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Baixa de encargo de veículo: apenas data e observação, sem valor. */
export function BaixaEncargoDialog({ lancamento, onClose }: { lancamento: Lancamento | null; onClose: () => void }) {
  const mut = useBaixarEncargoVeiculo();
  const [data, setData] = useState(hojeIso());
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (lancamento) { setData(hojeIso()); setObs(""); }
  }, [lancamento]);

  async function salvar() {
    if (!lancamento || !podeBaixarEncargoVeiculo(lancamento.status, data)) return;
    try {
      await mut.mutateAsync({ id: lancamento.id, data, obs: obs.trim() });
      toast.success("Baixa registrada");
      onClose();
    } catch (e: any) {
      toast.error(traduzirErroDespesas(e));
    }
  }

  return (
    <Dialog open={!!lancamento} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dar baixa no encargo</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{lancamento?.descricao}</div>
            {lancamento && (
              <div className="text-muted-foreground">
                Vencimento: {new Date(lancamento.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Data do pagamento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={!lancamento || !podeBaixarEncargoVeiculo(lancamento.status, data) || mut.isPending}>
            {mut.isPending ? "Salvando…" : "Dar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
