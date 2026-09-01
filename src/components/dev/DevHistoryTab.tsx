import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, X, FileDown } from "lucide-react";
import { useDevTrackerLog, DEV_CHANGE_TYPES, type DevLogEntry } from "@/hooks/useDevTrackerLog";

interface Props {
  systems: { value: string; label: string }[];
  hourlyRate: number;
}

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const emptyForm = {
  occurred_on: new Date().toISOString().slice(0, 10),
  system_name: "",
  title: "",
  description: "",
  change_type: "novo",
  hours: "",
};

export function DevHistoryTab({ systems, hourlyRate }: Props) {
  const { entries, isLoading, error, createEntry, updateEntry, deleteEntry } = useDevTrackerLog();

  const [filterSystem, setFilterSystem] = useState("todos");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DevLogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DevLogEntry | null>(null);
  const [form, setForm] = useState(emptyForm);

  const showValue = hourlyRate > 0;

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterSystem !== "todos" && e.system_name !== filterSystem) return false;
      if (filterFrom && e.occurred_on < filterFrom) return false;
      if (filterTo && e.occurred_on > filterTo) return false;
      return true;
    });
  }, [entries, filterSystem, filterFrom, filterTo]);

  const groups = useMemo(() => {
    const map = new Map<string, DevLogEntry[]>();
    for (const e of filtered) {
      const key = monthKey(e.occurred_on);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalHours = filtered.reduce((s, e) => s + Number(e.hours || 0), 0);

  const systemLabel = (value: string) => systems.find((s) => s.value === value)?.label || value;
  const typeLabel = (value: string) => DEV_CHANGE_TYPES.find((t) => t.value === value)?.label || value;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (entry: DevLogEntry) => {
    setEditing(entry);
    setForm({
      occurred_on: entry.occurred_on,
      system_name: entry.system_name,
      title: entry.title,
      description: entry.description || "",
      change_type: entry.change_type,
      hours: String(entry.hours ?? ""),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.occurred_on || !form.system_name || !form.title.trim()) {
      toast({ title: "Preencha data, sistema e título", variant: "destructive" });
      return;
    }
    const payload = {
      occurred_on: form.occurred_on,
      system_name: form.system_name,
      title: form.title.trim(),
      description: form.description.trim() || null,
      change_type: form.change_type,
      hours: parseFloat(form.hours) || 0,
    };
    try {
      if (editing) {
        await updateEntry.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Lançamento atualizado!" });
      } else {
        await createEntry.mutateAsync(payload);
        toast({ title: "Lançamento adicionado!" });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEntry.mutateAsync(deleteTarget.id);
      toast({ title: "Lançamento excluído!" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const clearFilters = () => {
    setFilterSystem("todos");
    setFilterFrom("");
    setFilterTo("");
  };

  const hasFilters = filterSystem !== "todos" || !!filterFrom || !!filterTo;

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(16);
    doc.text("Histórico de Desenvolvimento - SIG Execut", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(9);
    doc.text(
      `Gerado em: ${new Date().toLocaleDateString("pt-BR")}${showValue ? ` | Valor/hora: ${formatCurrency(hourlyRate)}` : ""}`,
      pageWidth / 2, 22, { align: "center" }
    );

    const hoursX = showValue ? 235 : 275;
    let y = 32;

    for (const [key, items] of groups) {
      if (y > pageHeight - 40) { doc.addPage(); y = 15; }
      const h = items.reduce((s, e) => s + Number(e.hours || 0), 0);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(monthLabel(key), 14, y);
      y += 7;

      doc.setFontSize(8);
      doc.text("Data", 14, y);
      doc.text("Funcionalidade", 38, y);
      doc.text("Descrição", 110, y);
      doc.text("Horas", hoursX, y, { align: "right" });
      if (showValue) doc.text("Valor (R$)", 280, y, { align: "right" });
      y += 5;
      doc.setFont("helvetica", "normal");

      for (const e of items) {
        if (y > pageHeight - 20) { doc.addPage(); y = 15; }
        doc.text(formatDate(e.occurred_on), 14, y);
        doc.text(e.title.substring(0, 38), 38, y);
        doc.text((e.description || "").substring(0, showValue ? 60 : 80), 110, y);
        doc.text(Number(e.hours).toFixed(1), hoursX, y, { align: "right" });
        if (showValue) {
          doc.text((Number(e.hours) * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 280, y, { align: "right" });
        }
        y += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.text("Subtotal do mês:", 14, y);
      doc.text(h.toFixed(1), hoursX, y, { align: "right" });
      if (showValue) {
        doc.text((h * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 280, y, { align: "right" });
      }
      y += 10;
    }

    if (y > pageHeight - 20) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL GERAL:", 14, y);
    doc.text(`${totalHours.toFixed(1)} horas`, hoursX, y, { align: "right" });
    if (showValue) {
      doc.text(`R$ ${(totalHours * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 280, y, { align: "right" });
    }

    doc.save("historico-desenvolvimento-sig-execut.pdf");
  };


  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Sistema</label>
          <Select value={filterSystem} onValueChange={setFilterSystem}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os sistemas</SelectItem>
              {systems.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" className="h-9 w-40" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" className="h-9 w-40" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />Limpar
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filtered.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />PDF do Histórico
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />Novo lançamento
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Carregando histórico...</span>
        </div>
      ) : error ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Erro ao carregar o histórico: {error.message}
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhum lançamento no histórico{hasFilters ? " para os filtros aplicados" : ""}.
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, items]) => {
            const h = items.reduce((s, e) => s + Number(e.hours || 0), 0);
            return (
              <Card key={key}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold">{monthLabel(key)}</span>
                    <span className="text-xs text-muted-foreground">
                      {items.length} lançamentos · {h.toFixed(1)}h{showValue ? ` · ${formatCurrency(h * hourlyRate)}` : ""}
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Data</TableHead>
                        <TableHead className="w-44">Sistema</TableHead>
                        <TableHead>Funcionalidade</TableHead>
                        <TableHead className="w-28">Tipo</TableHead>
                        <TableHead className="text-right w-20">Horas</TableHead>
                        {showValue && <TableHead className="text-right w-28">Valor</TableHead>}
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(e.occurred_on)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{systemLabel(e.system_name)}</TableCell>
                          <TableCell>
                            <div className="font-medium">{e.title}</div>
                            {e.description && (
                              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{e.description}</div>
                            )}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{typeLabel(e.change_type)}</Badge></TableCell>
                          <TableCell className="text-right">{Number(e.hours).toFixed(1)}</TableCell>
                          {showValue && (
                            <TableCell className="text-right">{formatCurrency(Number(e.hours) * hourlyRate)}</TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(e)} title="Excluir">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="font-semibold">Subtotal do mês</TableCell>
                        <TableCell className="text-right font-semibold">{h.toFixed(1)}</TableCell>
                        {showValue && (
                          <TableCell className="text-right font-semibold">{formatCurrency(h * hourlyRate)}</TableCell>
                        )}
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span className="text-lg font-bold">TOTAL DO HISTÓRICO</span>
              <div className="flex gap-8 text-lg font-bold">
                <span>{totalHours.toFixed(1)} horas</span>
                {showValue && <span>{formatCurrency(totalHours * hourlyRate)}</span>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog add/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>Registro cronológico das ações de desenvolvimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Data de início</label>
                <Input type="date" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={form.change_type} onValueChange={(v) => setForm({ ...form, change_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEV_CHANGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Sistema</label>
              <Select value={form.system_name} onValueChange={(v) => setForm({ ...form, system_name: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o sistema" /></SelectTrigger>
                <SelectContent>
                  {systems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Funcionalidade / ação</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Correção do calendário de veículos" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição detalhada</label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="O que foi feito, onde e por quê" />
            </div>
            <div>
              <label className="text-sm font-medium">Horas dedicadas</label>
              <Input type="number" step="0.5" min="0" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              {showValue && form.hours && (
                <p className="text-xs text-muted-foreground mt-1">
                  Valor estimado: {formatCurrency((parseFloat(form.hours) || 0) * hourlyRate)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createEntry.isPending || updateEntry.isPending}>
              {editing ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento "{deleteTarget?.title}" de {deleteTarget ? formatDate(deleteTarget.occurred_on) : ""} será removido
              permanentemente do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DevHistoryTab;
