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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Veiculo, VeiculoInput, VeiculoDocumento, VeiculoDocTipo,
  useSaveVeiculo, useVeiculoDocumentos, useSaveVeiculoDocumento, useDeleteVeiculoDocumento,
} from "@/hooks/useDespesasVeiculos";
import { useDespesasLookups } from "@/hooks/useDespesasLancamentos";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Veiculo | null;
}

const docTipos: { v: VeiculoDocTipo; l: string }[] = [
  { v: "ipva", l: "IPVA" },
  { v: "licenciamento", l: "Licenciamento" },
  { v: "seguro", l: "Seguro" },
  { v: "multa", l: "Multa" },
  { v: "manutencao", l: "Manutenção" },
  { v: "outro", l: "Outro" },
];

function VeiculoDialogInner({ open, onOpenChange, editing }: Props) {
  const { centros, pessoas } = useDespesasLookups();
  const saveMut = useSaveVeiculo();

  const empty = (): VeiculoInput => ({
    modelo: "", placa: null,
    motorista_id: null, proprietario_id: null, comprador_id: null,
    nota_fiscal: null, observacao: null,
    centro_custo_id: null,
    data_aquisicao: null, data_venda: null,
  });
  const [form, setForm] = useState<VeiculoInput>(empty());

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { id: _i, is_active: _a, motorista: _m, proprietario: _p, centro_custo: _cc, ...rest } = editing as any;
      setForm(rest);
    } else setForm(empty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const podeSalvar = form.modelo.trim().length > 0;

  async function salvar() {
    try {
      await saveMut.mutateAsync({ id: editing?.id, input: form });
      toast.success(editing ? "Veículo atualizado" : "Veículo criado");
      if (!editing) onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao salvar"); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle>{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle>
          </div>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="documentos" disabled={!editing}>Documentos</TabsTrigger>
            <TabsTrigger value="baixa" disabled={!editing}>Baixa por venda</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Modelo *</Label>
                <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} maxLength={120} />
              </div>
              <div className="space-y-2"><Label>Placa</Label>
                <Input value={form.placa ?? ""} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() || null })} maxLength={10} />
              </div>
              <div className="space-y-2"><Label>Centro de custo</Label>
                <ComboboxSelect
                  value={form.centro_custo_id}
                  onChange={(v) => setForm({ ...form, centro_custo_id: v })}
                  options={(centros.data ?? []).map(c => ({ value: c.id, label: c.nome }))}
                  placeholder="Necessário para gerar encargos"
                  searchPlaceholder="Buscar centro de custo…"
                  allowClear
                />
              </div>
              <div className="space-y-2"><Label>Motorista</Label>
                <ComboboxSelect
                  value={form.motorista_id}
                  onChange={(v) => setForm({ ...form, motorista_id: v })}
                  options={(pessoas.data ?? []).map(p => ({ value: p.id, label: p.nome }))}
                  placeholder="Opcional"
                  searchPlaceholder="Buscar pessoa…"
                  allowClear
                />
              </div>
              <div className="space-y-2"><Label>Proprietário</Label>
                <ComboboxSelect
                  value={form.proprietario_id}
                  onChange={(v) => setForm({ ...form, proprietario_id: v })}
                  options={(pessoas.data ?? []).map(p => ({ value: p.id, label: p.nome }))}
                  placeholder="Opcional"
                  searchPlaceholder="Buscar pessoa…"
                  allowClear
                />
              </div>
              <div className="space-y-2"><Label>Nota fiscal</Label>
                <Input value={form.nota_fiscal ?? ""} onChange={(e) => setForm({ ...form, nota_fiscal: e.target.value || null })} />
              </div>
              <div className="space-y-2"><Label>Data aquisição</Label>
                <Input type="date" value={form.data_aquisicao ?? ""} onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value || null })} />
              </div>
              <div className="space-y-2 md:col-span-2"><Label>Observação</Label>
                <Textarea rows={2} value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value || null })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            {editing && <DocumentosTab veiculoId={editing.id} />}
          </TabsContent>

          <TabsContent value="baixa" className="mt-4">
            {editing && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data de venda</Label>
                  <Input type="date" value={form.data_venda ?? ""} onChange={(e) => setForm({ ...form, data_venda: e.target.value || null })} />
                </div>
                <div className="space-y-2"><Label>Comprador</Label>
                  <ComboboxSelect
                    value={form.comprador_id}
                    onChange={(v) => setForm({ ...form, comprador_id: v })}
                    options={(pessoas.data ?? []).map(p => ({ value: p.id, label: p.nome }))}
                    placeholder="Opcional"
                    searchPlaceholder="Buscar pessoa…"
                    allowClear
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || saveMut.isPending}>
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentosTab({ veiculoId }: { veiculoId: string }) {
  const { data: docs = [], isLoading } = useVeiculoDocumentos(veiculoId);
  const saveMut = useSaveVeiculoDocumento();
  const delMut = useDeleteVeiculoDocumento();
  const { podeExcluir } = useDespesasPermissions();
  const [excluir, setExcluir] = useState<VeiculoDocumento | null>(null);
  const [editing, setEditing] = useState<Partial<VeiculoDocumento> | null>(null);

  const start = () => setEditing({
    veiculo_id: veiculoId, tipo: "ipva",
    valor: 0, parcelas: 1,
    vencimento_primeira_parcela: new Date().toISOString().slice(0, 10),
    ativo: true,
  });

  async function salvar() {
    if (!editing || !editing.vencimento_primeira_parcela || !Number.isInteger(editing.parcelas) || Number(editing.parcelas) < 1 || Number(editing.parcelas) > 24) {
      toast.error("Informe uma data e uma quantidade inteira de 1 a 24 parcelas.");
      return;
    }
    try {
      await saveMut.mutateAsync({ ...(editing as any), veiculo_id: veiculoId });
      toast.success("Documento salvo");
      setEditing(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={start}><Plus className="h-4 w-4 mr-2" />Novo documento</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
        docs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum documento.</p> :
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Parcelas</TableHead><TableHead>1º venc.</TableHead>
            <TableHead>Ativo</TableHead><TableHead className="w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="uppercase">{d.tipo}</TableCell>
                <TableCell>{d.parcelas}</TableCell>
                <TableCell>{new Date(d.vencimento_primeira_parcela + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{d.ativo ? "Sim" : "Não"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(d)}><Pencil className="h-4 w-4" /></Button>
                  {podeExcluir("veiculos") && <Button size="icon" variant="ghost" title="Desativar documento" onClick={() => setExcluir(d)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }

      {editing && (
        <div className="border rounded-md p-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2"><Label>Tipo</Label>
            <Select value={editing.tipo} onValueChange={(v: VeiculoDocTipo) => setEditing({ ...editing, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{docTipos.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Descrição</Label>
            <Input value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Parcelas</Label>
            <Input type="number" min={1} max={24} value={editing.parcelas ?? 1} onChange={(e) => setEditing({ ...editing, parcelas: Number(e.target.value) })} />
          </div>
          <div className="space-y-2"><Label>1ª parcela vence em</Label>
            <Input type="date" value={editing.vencimento_primeira_parcela ?? ""} onChange={(e) => setEditing({ ...editing, vencimento_primeira_parcela: e.target.value })} />
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={saveMut.isPending}>Salvar</Button>
          </div>
        </div>
      )}
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Desativar documento?</AlertDialogTitle>
            <AlertDialogDescription>O documento deixa de gerar novos encargos. Parcelas e ciclos anteriores são preservados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => {
              if (!excluir) return;
              delMut.mutate({ id: excluir.id, veiculo_id: veiculoId }, {
                onSuccess: () => { setExcluir(null); toast.success("Documento desativado"); },
                onError: (e: any) => toast.error(e?.message ?? "Erro ao desativar"),
              });
            }}>Desativar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function VeiculoDialog(props: Props) {
  return <VeiculoDialogInner {...props} />;
}
