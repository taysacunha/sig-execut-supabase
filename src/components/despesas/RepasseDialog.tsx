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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, CheckCircle2, XCircle, Pencil, Check, X } from "lucide-react";
import {
  Repasse, RepasseItemOrigem, RepasseItemTipo,
  useSaveRepasseItem, useDeleteRepasseItem, useUpdateRepasseStatus,
  useSaveRepasseBeneficiario, useDeleteRepasseBeneficiario,
  useRepasseInquilinos,
} from "@/hooks/useDespesasRepasses";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import { usePessoas } from "@/hooks/useDespesasPessoas";
import { useDespesasValues } from "@/contexts/DespesasValuesContext";

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

export function RepasseDialog({ open, onOpenChange, repasse }: Props) {
  const { showValues, formatValue } = useDespesasValues();
  const money = (n: number) => (showValues ? formatValue(n) : "R$ ******");
  const saveItem = useSaveRepasseItem();
  const delItem = useDeleteRepasseItem();
  const updStatus = useUpdateRepasseStatus();
  const saveBenef = useSaveRepasseBeneficiario();
  const delBenef = useDeleteRepasseBeneficiario();
  const pessoas = usePessoas({});
  const inquilinos = useRepasseInquilinos(repasse);

  const [novoBenef, setNovoBenef] = useState<{ pessoa_id: string | null; valor: number; observacao: string }>(
    { pessoa_id: null, valor: 0, observacao: "" },
  );

  useEffect(() => {
    setNovoBenef({ pessoa_id: null, valor: 0, observacao: "" });
  }, [repasse?.id]);

  const [novo, setNovo] = useState<{
    tipo: RepasseItemTipo; origem: RepasseItemOrigem; descricao: string; valor: number;
  }>({ tipo: "credito", origem: "aluguel", descricao: "", valor: 0 });

  const [confirmDelete, setConfirmDelete] = useState<
    { tipo: "item" | "benef"; id: string; label: string } | null
  >(null);
  const [editItem, setEditItem] = useState<
    { id: string; tipo: RepasseItemTipo; origem: RepasseItemOrigem; descricao: string; valor: number } | null
  >(null);
  const [editBenef, setEditBenef] = useState<
    { id: string; pessoa_id: string | null; valor: number; observacao: string } | null
  >(null);

  if (!repasse) return null;

  const beneficiarios = repasse.beneficiarios ?? [];
  const distribuido = beneficiarios.reduce((s, b) => s + Number(b.valor || 0), 0);
  const restante = Number(repasse.valor_liquido || 0) - distribuido;

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

  async function adicionarBenef() {
    if (!repasse) return;
    if (!novoBenef.pessoa_id || novoBenef.valor <= 0) {
      toast.error("Selecione a pessoa e informe um valor");
      return;
    }
    try {
      await saveBenef.mutateAsync({
        repasse_id: repasse.id,
        pessoa_id: novoBenef.pessoa_id,
        valor: novoBenef.valor,
        observacao: novoBenef.observacao || null as any,
        ordem: (repasse.beneficiarios?.length ?? 0) + 1,
      });
      setNovoBenef({ pessoa_id: null, valor: 0, observacao: "" });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function marcarPago() {
    if (!repasse) return;
    if (distribuido <= 0) {
      toast.error("Defina ao menos um beneficiário antes de baixar o repasse.");
      return;
    }
    if (distribuido > Number(repasse.valor_liquido || 0) + 0.009) {
      toast.error("Soma dos beneficiários excede o valor líquido.");
      return;
    }
    try {
      await updStatus.mutateAsync({
        id: repasse.id, status: "pago",
        data_pagamento: new Date().toISOString().slice(0, 10),
      });
      toast.success("Repasse marcado como pago — lançamento criado no calendário");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  const podeEditarItens = repasse.status === "aberto";
  const podeEditarBenef = repasse.status !== "pago" && repasse.status !== "cancelado";

  async function confirmarExclusao() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.tipo === "item") await delItem.mutateAsync(confirmDelete.id);
      else await delBenef.mutateAsync(confirmDelete.id);
      toast.success("Excluído com sucesso");
      setConfirmDelete(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao excluir"); }
  }

  async function salvarItemEdit() {
    if (!repasse || !editItem) return;
    if (!editItem.descricao.trim() || editItem.valor <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    try {
      await saveItem.mutateAsync({
        id: editItem.id, repasse_id: repasse.id, tipo: editItem.tipo,
        origem: editItem.origem, descricao: editItem.descricao, valor: editItem.valor,
      });
      toast.success("Item atualizado");
      setEditItem(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function salvarBenefEdit() {
    if (!repasse || !editBenef) return;
    if (!editBenef.pessoa_id || editBenef.valor <= 0) {
      toast.error("Selecione a pessoa e informe um valor");
      return;
    }
    try {
      await saveBenef.mutateAsync({
        id: editBenef.id, repasse_id: repasse.id, pessoa_id: editBenef.pessoa_id,
        valor: editBenef.valor, observacao: (editBenef.observacao || null) as any,
      });
      toast.success("Beneficiário atualizado");
      setEditBenef(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Repasse — {repasse.proprietario?.nome} — {new Date(repasse.competencia + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
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

        <Tabs defaultValue="beneficiarios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="beneficiarios">Beneficiários · {beneficiarios.length}</TabsTrigger>
            <TabsTrigger value="itens">Itens · {(repasse.itens ?? []).length}</TabsTrigger>
            <TabsTrigger value="imoveis">Imóveis · {(inquilinos.data ?? []).length}</TabsTrigger>
          </TabsList>

          <TabsContent value="beneficiarios" className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Distribuição</h3>
            <div className="text-sm">
              Distribuído: <span className="font-medium">{money(distribuido)}</span>
              {" · "}Restante:{" "}
              <span className={restante < 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                {money(restante)}
              </span>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Pessoa</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-24" />
            </TableRow></TableHeader>
            <TableBody>
              {beneficiarios
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((b, i) => editBenef?.id === b.id ? (
                  <TableRow key={b.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <ComboboxSelect
                        value={editBenef.pessoa_id}
                        onChange={(v) => setEditBenef({ ...editBenef, pessoa_id: v })}
                        options={(pessoas.data ?? []).map((p) => ({
                          value: p.id,
                          label: `${p.nome} (${p.tipo_pessoa === "juridica" ? "PJ" : "PF"})`,
                          keywords: [p.cpf_cnpj ?? "", ...(p.papeis ?? [])],
                        }))}
                        placeholder="Selecione uma pessoa"
                        searchPlaceholder="Buscar…"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editBenef.observacao}
                        onChange={(e) => setEditBenef({ ...editBenef, observacao: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.01" min={0} className="text-right"
                        value={editBenef.valor}
                        onChange={(e) => setEditBenef({ ...editBenef, valor: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={salvarBenefEdit} disabled={saveBenef.isPending} title="Salvar">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditBenef(null)} title="Cancelar">
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={b.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{b.pessoa?.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.pessoa?.tipo_pessoa === "juridica" ? "PJ" : "PF"}
                        {b.pessoa?.cpf_cnpj ? ` · ${b.pessoa.cpf_cnpj}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.observacao ?? ""}</TableCell>
                    <TableCell className="text-right">{money(b.valor)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {podeEditarBenef && (
                        <>
                          <Button
                            size="icon" variant="ghost" title="Editar"
                            onClick={() => setEditBenef({
                              id: b.id, pessoa_id: b.pessoa_id, valor: Number(b.valor),
                              observacao: b.observacao ?? "",
                            })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" title="Excluir"
                            onClick={() => setConfirmDelete({
                              tipo: "benef", id: b.id,
                              label: `${b.pessoa?.nome ?? "Beneficiário"} — ${money(b.valor)}`,
                            })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {beneficiarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum beneficiário definido. Adicione ao menos um antes de baixar o repasse.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {podeEditarBenef && (
            <div className="border rounded-md p-3 mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
              <div className="space-y-1">
                <Label>Pessoa</Label>
                <ComboboxSelect
                  value={novoBenef.pessoa_id}
                  onChange={(v) => setNovoBenef({ ...novoBenef, pessoa_id: v })}
                  options={(pessoas.data ?? []).map((p) => ({
                    value: p.id,
                    label: `${p.nome} (${p.tipo_pessoa === "juridica" ? "PJ" : "PF"})`,
                    keywords: [p.cpf_cnpj ?? "", ...(p.papeis ?? [])],
                  }))}
                  placeholder="Selecione uma pessoa"
                  searchPlaceholder="Buscar por nome, documento ou papel…"
                  emptyText="Nenhuma pessoa encontrada."
                  allowClear
                />
              </div>
              <div className="space-y-1">
                <Label>Valor</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={novoBenef.valor}
                    onChange={(e) => setNovoBenef({ ...novoBenef, valor: Number(e.target.value) })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNovoBenef({ ...novoBenef, valor: Math.max(0, Number(restante.toFixed(2))) })
                    }
                    title="Usar valor restante"
                  >
                    Restante
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Observação</Label>
                <Input
                  value={novoBenef.observacao}
                  onChange={(e) => setNovoBenef({ ...novoBenef, observacao: e.target.value })}
                />
              </div>
              <Button size="icon" onClick={adicionarBenef}><Plus className="h-4 w-4" /></Button>
            </div>
          )}
          </TabsContent>

          <TabsContent value="itens" className="mt-3">
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
          <div className="border rounded-md p-3 mt-3 grid gap-3 md:grid-cols-5">
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
          </TabsContent>

          <TabsContent value="imoveis" className="mt-3">
            <div className="border rounded-md p-3">
              {inquilinos.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : (inquilinos.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum imóvel vinculado a este proprietário.</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {(inquilinos.data ?? []).map((r) => (
                    <li key={r.imovel_id} className="flex flex-wrap gap-x-2">
                      <span className="font-medium">
                        {r.imovel_codigo ? `${r.imovel_codigo} — ` : ""}{r.imovel_descricao}
                      </span>
                      <span className="text-muted-foreground">
                        {r.inquilino
                          ? `→ ${r.inquilino.nome} (${r.inquilino.tipo_pessoa === "juridica" ? "PJ" : "PF"}${r.inquilino.cpf_cnpj ? ` · ${r.inquilino.cpf_cnpj}` : ""})`
                          : "→ Sem inquilino"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-xs text-muted-foreground mt-2">Para alterar, edite o cadastro do imóvel.</div>
            </div>
          </TabsContent>
        </Tabs>

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