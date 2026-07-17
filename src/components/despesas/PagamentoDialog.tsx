import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FormaPagamento, Lancamento,
  useAddPagamento, useDespesasLookups,
} from "@/hooks/useDespesasLancamentos";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lancamento: Lancamento | null;
}

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "cheque", label: "Cheque" },
  { value: "outro", label: "Outro" },
];

export function PagamentoDialog({ open, onOpenChange, lancamento }: Props) {
  const { contas } = useDespesasLookups();
  const addMut = useAddPagamento();

  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState(0);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [contaId, setContaId] = useState<string | null>(null);
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open || !lancamento) return;
    setData(new Date().toISOString().slice(0, 10));
    const restante = Number(lancamento.valor_total) - Number(lancamento.valor_pago);
    setValor(restante > 0 ? Number(restante.toFixed(2)) : 0);
    setForma("pix");
    setContaId(lancamento.conta_bancaria_id);
    setObs("");
  }, [open, lancamento]);

  if (!lancamento) return null;

  const restante = Number(lancamento.valor_total) - Number(lancamento.valor_pago);
  const podeSalvar = valor > 0 && valor <= restante + 0.001;

  async function salvar() {
    if (!lancamento) return;
    try {
      await addMut.mutateAsync({
        lancamento_id: lancamento.id,
        data_pagamento: data,
        valor,
        forma_pagamento: forma,
        conta_bancaria_id: contaId,
        observacao: obs.trim() || null,
      });
      toast.success("Pagamento registrado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar pagamento");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{lancamento.descricao}</div>
            <div className="text-muted-foreground">
              Total: R$ {Number(lancamento.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              {" · "}
              Pago: R$ {Number(lancamento.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              {" · "}
              Restante: R$ {restante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number" min={0} step="0.01"
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={(v: FormaPagamento) => setForma(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta bancária</Label>
              <Select
                value={contaId ?? "__none__"}
                onValueChange={(v) => setContaId(v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem conta —</SelectItem>
                  {(contas.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || addMut.isPending}>
            {addMut.isPending ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}