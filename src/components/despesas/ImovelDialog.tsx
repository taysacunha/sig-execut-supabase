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
  Imovel, ImovelInput, ImovelSituacao, ImovelTipo,
  useSaveImovel, useImovelEncargos, useSaveEncargo, useDeleteEncargo,
  useImovelHistorico, ImovelEncargo, EncargoTipo,
} from "@/hooks/useDespesasImoveis";
import { useDespesasLookups } from "@/hooks/useDespesasLancamentos";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Imovel | null;
}

const situacoes: { v: ImovelSituacao; l: string }[] = [
  { v: "alugado", l: "Alugado" },
  { v: "vago", l: "Desocupado" },
  { v: "vendido", l: "Vendido" },
  { v: "proprio_uso", l: "Uso próprio" },
];
const tipos: { v: ImovelTipo; l: string }[] = [
  { v: "comercial", l: "Comercial" },
  { v: "residencial", l: "Residencial" },
  { v: "terreno", l: "Terreno" },
  { v: "outro", l: "Outro" },
];

export function ImovelDialog({ open, onOpenChange, editing }: Props) {
  const { centros, pessoas } = useDespesasLookups();
  const saveMut = useSaveImovel();

  const empty = (): ImovelInput => ({
    codigo: null,
    descricao: "",
    tipo: "comercial",
    situacao: "vago",
    endereco: null, numero: null, complemento: null, bairro: null,
    cidade: null, uf: null, cep: null,
    matricula: null, inscricao_municipal: null,
    area_total: null,
    proprietario_id: null, inquilino_id: null,
    centro_custo_id: "",
    valor_aluguel: 0, taxa_administracao_pct: 0,
    data_aquisicao: null, data_venda: null, observacao: null,
  });

  const [form, setForm] = useState<ImovelInput>(empty());

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { id: _i, created_at: _c, updated_at: _u,
        proprietario: _p, inquilino: _in, centro_custo: _cc, is_active: _a,
        ...rest } = editing as any;
      setForm(rest);
    } else setForm(empty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const podeSalvar = form.descricao.trim().length > 0 && !!form.centro_custo_id;

  async function salvar() {
    try {
      await saveMut.mutateAsync({ id: editing?.id, input: form });
      toast.success(editing ? "Imóvel atualizado" : "Imóvel criado");
      if (!editing) onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar imóvel" : "Novo imóvel"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="encargos" disabled={!editing}>Encargos</TabsTrigger>
            <TabsTrigger value="historico" disabled={!editing}>Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={form.codigo ?? ""} onChange={(e) => setForm({ ...form, codigo: e.target.value || null })} maxLength={30} />
              </div>
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select value={form.situacao} onValueChange={(v: ImovelSituacao) => setForm({ ...form, situacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{situacoes.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: ImovelTipo) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{tipos.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro de custo *</Label>
                <Select value={form.centro_custo_id} onValueChange={(v) => setForm({ ...form, centro_custo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(centros.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Proprietário</Label>
                <Select value={form.proprietario_id ?? "__none__"} onValueChange={(v) => setForm({ ...form, proprietario_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem —</SelectItem>
                    {(pessoas.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Inquilino atual</Label>
                <Select value={form.inquilino_id ?? "__none__"} onValueChange={(v) => setForm({ ...form, inquilino_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem —</SelectItem>
                    {(pessoas.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.endereco ?? ""} onChange={(e) => setForm({ ...form, endereco: e.target.value || null })} />
              </div>
              <div className="space-y-2"><Label>Nº</Label><Input value={form.numero ?? ""} onChange={(e) => setForm({ ...form, numero: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>Complemento</Label><Input value={form.complemento ?? ""} onChange={(e) => setForm({ ...form, complemento: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>Bairro</Label><Input value={form.bairro ?? ""} onChange={(e) => setForm({ ...form, bairro: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>Cidade</Label><Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>UF</Label><Input value={form.uf ?? ""} onChange={(e) => setForm({ ...form, uf: e.target.value || null })} maxLength={2} /></div>
              <div className="space-y-2"><Label>CEP</Label><Input value={form.cep ?? ""} onChange={(e) => setForm({ ...form, cep: e.target.value || null })} maxLength={10} /></div>
              <div className="space-y-2"><Label>Matrícula</Label><Input value={form.matricula ?? ""} onChange={(e) => setForm({ ...form, matricula: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>Inscrição municipal</Label><Input value={form.inscricao_municipal ?? ""} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>Área total (m²)</Label><Input type="number" step="0.01" value={form.area_total ?? ""} onChange={(e) => setForm({ ...form, area_total: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="space-y-2"><Label>Valor de aluguel</Label><Input type="number" step="0.01" value={form.valor_aluguel ?? 0} onChange={(e) => setForm({ ...form, valor_aluguel: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Taxa de administração (%)</Label><Input type="number" step="0.01" value={form.taxa_administracao_pct ?? 0} onChange={(e) => setForm({ ...form, taxa_administracao_pct: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Aquisição</Label><Input type="date" value={form.data_aquisicao ?? ""} onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>Venda</Label><Input type="date" value={form.data_venda ?? ""} onChange={(e) => setForm({ ...form, data_venda: e.target.value || null })} /></div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observação</Label>
                <Textarea rows={2} value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value || null })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="encargos" className="mt-4">
            {editing && <EncargosTab imovelId={editing.id} />}
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            {editing && <HistoricoTab imovelId={editing.id} />}
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

// ---------------- Encargos ----------------
const encargoTipos: { v: EncargoTipo; l: string }[] = [
  { v: "iptu", l: "IPTU" },
  { v: "tcr", l: "TCR" },
  { v: "spu", l: "SPU" },
  { v: "condominio", l: "Condomínio" },
  { v: "outro", l: "Outro" },
];

function EncargosTab({ imovelId }: { imovelId: string }) {
  const { data: encargos = [], isLoading } = useImovelEncargos(imovelId);
  const saveMut = useSaveEncargo();
  const delMut = useDeleteEncargo();
  const [editing, setEditing] = useState<Partial<ImovelEncargo> | null>(null);

  const start = () => setEditing({
    imovel_id: imovelId, tipo: "iptu",
    valor_anual: 0, parcelas: 1,
    vencimento_primeira_parcela: new Date().toISOString().slice(0, 10),
    ativo: true,
  });

  async function salvar() {
    if (!editing) return;
    try {
      await saveMut.mutateAsync({ ...(editing as any), imovel_id: imovelId });
      toast.success("Encargo salvo");
      setEditing(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={start}><Plus className="h-4 w-4 mr-2" />Novo encargo</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
        encargos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum encargo cadastrado.</p> :
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead><TableHead>Valor anual</TableHead>
            <TableHead>Parcelas</TableHead><TableHead>1º venc.</TableHead>
            <TableHead>Ativo</TableHead><TableHead className="w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {encargos.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="uppercase">{e.tipo}</TableCell>
                <TableCell>R$ {Number(e.valor_anual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{e.parcelas}</TableCell>
                <TableCell>{new Date(e.vencimento_primeira_parcela + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{e.ativo ? "Sim" : "Não"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => delMut.mutate({ id: e.id, imovel_id: imovelId })}>
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
          <div className="space-y-2"><Label>Tipo</Label>
            <Select value={editing.tipo} onValueChange={(v: EncargoTipo) => setEditing({ ...editing, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{encargoTipos.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Descrição</Label>
            <Input value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Valor anual</Label>
            <Input type="number" step="0.01" value={editing.valor_anual ?? 0} onChange={(e) => setEditing({ ...editing, valor_anual: Number(e.target.value) })} />
          </div>
          <div className="space-y-2"><Label>Parcelas</Label>
            <Input type="number" min={1} max={24} value={editing.parcelas ?? 1} onChange={(e) => setEditing({ ...editing, parcelas: Number(e.target.value) })} />
          </div>
          <div className="space-y-2"><Label>1ª parcela vence em</Label>
            <Input type="date" value={editing.vencimento_primeira_parcela ?? ""} onChange={(e) => setEditing({ ...editing, vencimento_primeira_parcela: e.target.value })} />
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={saveMut.isPending}>Salvar encargo</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricoTab({ imovelId }: { imovelId: string }) {
  const { data: hist = [], isLoading } = useImovelHistorico(imovelId);
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
            <TableCell className="capitalize">{h.situacao_anterior ?? "—"}</TableCell>
            <TableCell className="capitalize">{h.situacao_nova}</TableCell>
            <TableCell className="text-muted-foreground">{h.motivo ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}