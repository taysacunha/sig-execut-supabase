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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, CalendarPlus, Check } from "lucide-react";
import {
  Bem, BemInput, BemCategoria, BemSituacao, BemPagamento,
  BEM_CATEGORIAS, BEM_SITUACOES,
  useSaveBem, useBemPagamentos, useSaveBemPagamento, useDeleteBemPagamento,
  useBemHistorico, useGerarLancamentoBem,
} from "@/hooks/useDespesasBens";
import { useDespesasLookups } from "@/hooks/useDespesasLancamentos";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import {
  useDespesasValues, DespesasValuesScope, ToggleValuesButton,
} from "@/contexts/DespesasValuesContext";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Bem | null;
}

function BemDialogInner({ open, onOpenChange, editing }: Props) {
  const { centros, pessoas } = useDespesasLookups();
  const saveMut = useSaveBem();

  const empty = (): BemInput => ({
    codigo: null,
    descricao: "",
    categoria: "equipamento",
    situacao: "em_uso",
    centro_custo_id: "",
    responsavel_id: null,
    fornecedor_id: null,
    local: null,
    marca: null,
    modelo: null,
    numero_serie: null,
    quantidade: 1,
    data_aquisicao: null,
    nota_fiscal: null,
    garantia_ate: null,
    observacao: null,
  });

  const [form, setForm] = useState<BemInput>(empty());

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const {
        id: _i, created_at: _c, updated_at: _u, responsavel: _r, fornecedor: _f,
        centro_custo: _cc, is_active: _a, pagamentos: _p, ...rest
      } = editing as any;
      setForm(rest);
    } else setForm(empty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const podeSalvar = form.descricao.trim().length > 0 && !!form.centro_custo_id;

  async function salvar() {
    try {
      await saveMut.mutateAsync({ id: editing?.id, input: form });
      toast.success(editing ? "Bem atualizado" : "Bem criado");
      if (!editing) onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  const pessoaOpts = (pessoas.data ?? []).map((p: any) => ({ value: p.id, label: p.nome }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle>{editing ? "Editar bem permanente" : "Novo bem permanente"}</DialogTitle>
            <ToggleValuesButton />
          </div>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="aquisicoes" disabled={!editing}>Aquisições / Pagamentos</TabsTrigger>
            <TabsTrigger value="historico" disabled={!editing}>Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Código / patrimônio</Label>
                <Input value={form.codigo ?? ""} maxLength={30}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select value={form.situacao} onValueChange={(v: BemSituacao) => setForm({ ...form, situacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BEM_SITUACOES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} maxLength={200}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v: BemCategoria) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BEM_CATEGORIAS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro de custo *</Label>
                <ComboboxSelect
                  value={form.centro_custo_id || null}
                  onChange={(v) => setForm({ ...form, centro_custo_id: v ?? "" })}
                  options={(centros.data ?? []).map(c => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar centro de custo…"
                />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <ComboboxSelect
                  value={form.responsavel_id}
                  onChange={(v) => setForm({ ...form, responsavel_id: v })}
                  options={pessoaOpts}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar pessoa…"
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <ComboboxSelect
                  value={form.fornecedor_id}
                  onChange={(v) => setForm({ ...form, fornecedor_id: v })}
                  options={pessoaOpts}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar pessoa…"
                />
              </div>
              <div className="space-y-2">
                <Label>Local / setor</Label>
                <Input value={form.local ?? ""} onChange={(e) => setForm({ ...form, local: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={form.marca ?? ""} onChange={(e) => setForm({ ...form, marca: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={form.modelo ?? ""} onChange={(e) => setForm({ ...form, modelo: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Número de série</Label>
                <Input value={form.numero_serie ?? ""} onChange={(e) => setForm({ ...form, numero_serie: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Nota fiscal</Label>
                <Input value={form.nota_fiscal ?? ""} onChange={(e) => setForm({ ...form, nota_fiscal: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Data de aquisição</Label>
                <Input type="date" value={form.data_aquisicao ?? ""}
                  onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Garantia até</Label>
                <Input type="date" value={form.garantia_ate ?? ""}
                  onChange={(e) => setForm({ ...form, garantia_ate: e.target.value || null })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observação</Label>
                <Textarea value={form.observacao ?? ""} rows={3}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value || null })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="aquisicoes" className="mt-4">
            {editing && <PagamentosTab bemId={editing.id} />}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {editing && <HistoricoTab bemId={editing.id} />}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || saveMut.isPending}>
            {editing ? "Salvar alterações" : "Criar bem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagamentosTab({ bemId }: { bemId: string }) {
  const { showValues, formatValue } = useDespesasValues();
  const { categorias, planos } = useDespesasLookups() as any;
  const { data: pagamentos = [], isLoading } = useBemPagamentos(bemId);
  const saveMut = useSaveBemPagamento();
  const delMut = useDeleteBemPagamento();
  const gerarMut = useGerarLancamentoBem();
  const [editing, setEditing] = useState<Partial<BemPagamento> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BemPagamento | null>(null);

  const total = pagamentos.reduce((s, p) => s + Number(p.valor ?? 0), 0);

  const start = () => setEditing({
    bem_id: bemId,
    data_compra: new Date().toISOString().slice(0, 10),
    valor: 0,
    descricao: "",
  });

  async function salvar() {
    if (!editing) return;
    if (!editing.descricao?.trim()) { toast.error("Informe a descrição"); return; }
    if (!editing.data_compra) { toast.error("Informe a data da compra"); return; }
    try {
      await saveMut.mutateAsync({ ...(editing as any), bem_id: bemId });
      toast.success("Registro salvo");
      setEditing(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function lancar(p: BemPagamento) {
    try {
      await gerarMut.mutateAsync({ pagamentoId: p.id, bemId });
      toast.success("Lançamento criado no calendário");
    } catch (e: any) { toast.error(e?.message ?? "Erro ao lançar"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total investido:{" "}
          <span className="font-semibold text-foreground">
            {showValues ? formatValue(total) : "R$ ******"}
          </span>
        </div>
        <Button size="sm" onClick={start}><Plus className="h-4 w-4 mr-2" />Nova aquisição</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
        pagamentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma aquisição registrada.</p> :
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data da compra</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Calendário</TableHead>
            <TableHead className="w-32"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {pagamentos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{new Date(p.data_compra + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{p.descricao}</TableCell>
                <TableCell className="text-right">{showValues ? formatValue(p.valor) : "R$ ******"}</TableCell>
                <TableCell>
                  {p.lancamento_id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3 w-3" />Lançado
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => lancar(p)} disabled={gerarMut.isPending}>
                      <CalendarPlus className="h-4 w-4 mr-1" />Lançar
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(p)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }

      {editing && (
        <div className="border rounded-md p-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2"><Label>Data da compra *</Label>
            <Input type="date" value={editing.data_compra ?? ""}
              onChange={(e) => setEditing({ ...editing, data_compra: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Valor *</Label>
            <Input type="number" step="0.01" value={editing.valor ?? 0}
              onChange={(e) => setEditing({ ...editing, valor: Number(e.target.value) })} />
          </div>
          <div className="space-y-2 md:col-span-2"><Label>Descrição *</Label>
            <Input value={editing.descricao ?? ""} maxLength={200}
              onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Categoria</Label>
            <ComboboxSelect
              value={editing.categoria_id ?? null}
              onChange={(v) => setEditing({ ...editing, categoria_id: v })}
              options={((categorias?.data ?? []) as any[]).map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Opcional"
              searchPlaceholder="Buscar categoria…"
            />
          </div>
          <div className="space-y-2"><Label>Plano de conta</Label>
            <ComboboxSelect
              value={editing.plano_conta_id ?? null}
              onChange={(v) => setEditing({ ...editing, plano_conta_id: v })}
              options={((planos?.data ?? []) as any[]).map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Opcional"
              searchPlaceholder="Buscar plano de conta…"
            />
          </div>
          <div className="space-y-2 md:col-span-2"><Label>Observação</Label>
            <Textarea rows={2} value={editing.observacao ?? ""}
              onChange={(e) => setEditing({ ...editing, observacao: e.target.value || null })} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={saveMut.isPending}>Salvar aquisição</Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aquisição?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro <b>{confirmDelete?.descricao}</b> será removido. Lançamentos já gerados no
              calendário permanecem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) delMut.mutate(
                  { id: confirmDelete.id, bem_id: bemId },
                  {
                    onSuccess: () => { toast.success("Registro excluído"); setConfirmDelete(null); },
                    onError: (err: any) => toast.error(err?.message ?? "Erro"),
                  }
                );
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoricoTab({ bemId }: { bemId: string }) {
  const { data: hist = [], isLoading } = useBemHistorico(bemId);
  const lbl = (v: string | null) =>
    v ? (BEM_SITUACOES.find((s) => s.v === v)?.l ?? v) : "—";
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (hist.length === 0) return <p className="text-sm text-muted-foreground">Sem mudanças de situação registradas.</p>;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Data</TableHead><TableHead>De</TableHead>
        <TableHead>Para</TableHead><TableHead>Motivo</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {hist.map((h) => (
          <TableRow key={h.id}>
            <TableCell>{new Date(h.data + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
            <TableCell>{lbl(h.situacao_anterior)}</TableCell>
            <TableCell>{lbl(h.situacao_nova)}</TableCell>
            <TableCell className="text-muted-foreground">{h.motivo ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function BemDialog(props: Props) {
  return (
    <DespesasValuesScope active={props.open}>
      <BemDialogInner {...props} />
    </DespesasValuesScope>
  );
}