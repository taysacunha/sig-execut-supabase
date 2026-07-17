import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import {
  Repasse, RepasseItemOrigem, RepasseItemTipo,
  useSaveRepasseItem, useDeleteRepasseItem, useUpdateRepasseStatus,
  useUpdateRepasseCampos,
} from "@/hooks/useDespesasRepasses";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  repasse: Repasse | null;
}

const origens: { v: RepasseItemOrigem; l: string }[] = [
  { v: "aluguel", l: "Aluguel" },
  { v: "reembolso", l: "Reembolso" },
  { v: "encargo", l: "Encargo" },
  { v: "taxa_admin", l: "Taxa admin." },
  { v: "ajuste", l: "Ajuste" },
  { v: "outro", l: "Outro" },
];

function money(n: number) {
  return `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function RepasseDialog({ open, onOpenChange, repasse }: Props) {
  const saveItem = useSaveRepasseItem();
  const delItem = useDeleteRepasseItem();
  const updStatus = useUpdateRepasseStatus();
  const updCampos = useUpdateRepasseCampos();
  const [limite, setLimite] = useState<string>("");

  useEffect(() => {
    setLimite(repasse?.valor_limite_primeiro != null ? String(repasse.valor_limite_primeiro) : "");
  }, [repasse?.id, repasse?.valor_limite_primeiro]);

  const [novo, setNovo] = useState<{
    tipo: RepasseItemTipo; origem: RepasseItemOrigem; descricao: string; valor: number;
  }>({ tipo: "credito", origem: "aluguel", descricao: "", valor: 0 });

  if (!repasse) return null;

  async function adicionar() {
    if (!repasse) return;
    if (!novo.descricao.trim() || novo.valor <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    try {
      await saveItem.mutateAsync({ repasse_id: repasse.id, ...novo });
      setNovo({ tipo: "credito", origem: "aluguel", descricao: "", valor: 0 });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function marcarPago() {
    try {
      await updStatus.mutateAsync({
        id: repasse.id, status: "pago",
        data_pagamento: new Date().toISOString().slice(0, 10),
      });
      toast.success("Repasse marcado como pago — lançamento criado no calendário");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  const podeEditarItens = repasse.status === "aberto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Repasse — {repasse.proprietario?.nome} — {new Date(repasse.competencia + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Bruto</div>
            <div className="text-lg font-semibold">{money(repasse.valor_bruto)}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Taxa admin.</div>
            <div className="text-lg font-semibold text-destructive">−{money(repasse.taxa_administracao_valor)}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Líquido</div>
            <div className="text-lg font-semibold text-primary">{money(repasse.valor_liquido)}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="text-lg font-semibold capitalize">{repasse.status.replace("_", " ")}</div>
          </div>
        </div>

        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead><TableHead>Origem</TableHead>
            <TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-12" />
          </TableRow></TableHeader>
          <TableBody>
            {(repasse.itens ?? []).map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  {it.tipo === "credito" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" />Crédito</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" />Débito</span>
                  )}
                </TableCell>
                <TableCell className="capitalize">{it.origem.replace("_", " ")}</TableCell>
                <TableCell>{it.descricao}</TableCell>
                <TableCell className="text-right">{money(it.valor)}</TableCell>
                <TableCell>
                  {podeEditarItens && (
                    <Button size="icon" variant="ghost" onClick={() => delItem.mutate(it.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(repasse.itens ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum item.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {podeEditarItens && (
          <div className="border rounded-md p-3 mt-4 grid gap-3 md:grid-cols-5">
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={novo.tipo} onValueChange={(v: RepasseItemTipo) => setNovo({ ...novo, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Origem</Label>
              <Select value={novo.origem} onValueChange={(v: RepasseItemOrigem) => setNovo({ ...novo, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{origens.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2"><Label>Descrição</Label>
              <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
            </div>
            <div className="space-y-1"><Label>Valor</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: Number(e.target.value) })} />
                <Button size="icon" onClick={adicionar}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {repasse.status === "aberto" && (
            <Button variant="outline" onClick={() => updStatus.mutate({ id: repasse.id, status: "fechado" })}>
              Fechar repasse
            </Button>
          )}
          {repasse.status !== "pago" && repasse.status !== "cancelado" && (
            <Button onClick={marcarPago}>Marcar como pago</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}