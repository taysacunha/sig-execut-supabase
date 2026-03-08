import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Lock, Plus, Pencil, Trash2, FileDown, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";

const DEV_CODE = "EXECUT2026";

const SYSTEMS = [
  { value: "infraestrutura", label: "Login / Infraestrutura" },
  { value: "escalas", label: "Sistema de Escalas (Plantões)" },
  { value: "vendas", label: "Sistema de Vendas" },
  { value: "ferias", label: "Sistema de Férias / Folgas" },
  { value: "estoque", label: "Sistema de Estoque" },
];

interface DevFeature {
  id: string;
  system_name: string;
  feature_name: string;
  description: string | null;
  hours: number;
  cost: number;
  display_order: number;
}

const DevTracker = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [features, setFeatures] = useState<DevFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<DevFeature | null>(null);
  const [form, setForm] = useState({ system_name: "", feature_name: "", description: "", hours: "", cost: "" });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === DEV_CODE) {
      setAuthenticated(true);
      loadFeatures();
    } else {
      toast({ title: "Código incorreto", variant: "destructive" });
    }
  };

  const loadFeatures = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dev_tracker" as any)
      .select("*")
      .order("system_name")
      .order("display_order");
    if (error) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } else {
      setFeatures((data as any) || []);
    }
    setLoading(false);
  };

  const openAdd = () => {
    setEditingFeature(null);
    setForm({ system_name: "", feature_name: "", description: "", hours: "", cost: "" });
    setDialogOpen(true);
  };

  const openEdit = (f: DevFeature) => {
    setEditingFeature(f);
    setForm({
      system_name: f.system_name,
      feature_name: f.feature_name,
      description: f.description || "",
      hours: String(f.hours),
      cost: String(f.cost),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.system_name || !form.feature_name) {
      toast({ title: "Preencha sistema e funcionalidade", variant: "destructive" });
      return;
    }
    const payload = {
      system_name: form.system_name,
      feature_name: form.feature_name,
      description: form.description || null,
      hours: parseFloat(form.hours) || 0,
      cost: parseFloat(form.cost) || 0,
    };

    if (editingFeature) {
      const { error } = await supabase
        .from("dev_tracker" as any)
        .update(payload)
        .eq("id", editingFeature.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("dev_tracker" as any).insert(payload);
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: editingFeature ? "Atualizado!" : "Adicionado!" });
    setDialogOpen(false);
    loadFeatures();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta funcionalidade?")) return;
    const { error } = await supabase.from("dev_tracker" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removido!" });
      loadFeatures();
    }
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text("Registro de Desenvolvimento - SIG Execut", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, 22, { align: "center" });

    let y = 32;
    let grandTotalHours = 0;
    let grandTotalCost = 0;

    for (const sys of SYSTEMS) {
      const items = features.filter((f) => f.system_name === sys.value);
      if (items.length === 0) continue;

      const totalHours = items.reduce((s, i) => s + i.hours, 0);
      const totalCost = items.reduce((s, i) => s + i.cost, 0);
      grandTotalHours += totalHours;
      grandTotalCost += totalCost;

      if (y > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 15;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(sys.label, 14, y);
      y += 7;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Funcionalidade", 14, y);
      doc.text("Descrição", 80, y);
      doc.text("Horas", 200, y, { align: "right" });
      doc.text("Valor (R$)", 270, y, { align: "right" });
      y += 5;
      doc.setFont("helvetica", "normal");

      for (const item of items) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 15;
        }
        doc.text(item.feature_name.substring(0, 35), 14, y);
        doc.text((item.description || "").substring(0, 55), 80, y);
        doc.text(item.hours.toFixed(1), 200, y, { align: "right" });
        doc.text(item.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 270, y, { align: "right" });
        y += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.text(`Subtotal ${sys.label}:`, 14, y);
      doc.text(totalHours.toFixed(1), 200, y, { align: "right" });
      doc.text(totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 270, y, { align: "right" });
      y += 10;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL GERAL:", 14, y);
    doc.text(`${grandTotalHours.toFixed(1)} horas`, 200, y, { align: "right" });
    doc.text(`R$ ${grandTotalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 270, y, { align: "right" });

    doc.save("registro-desenvolvimento-sig-execut.pdf");
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle>Área Restrita</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Input
                  type={showCode ? "text" : "password"}
                  placeholder="Digite o código de acesso"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowCode(!showCode)}
                >
                  {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" className="w-full">Acessar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const grouped = SYSTEMS.map((sys) => ({
    ...sys,
    items: features.filter((f) => f.system_name === sys.value),
  })).filter((g) => g.items.length > 0);

  const grandTotalHours = features.reduce((s, f) => s + f.hours, 0);
  const grandTotalCost = features.reduce((s, f) => s + f.cost, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Desenvolvimento</h1>
          <p className="text-muted-foreground text-sm">Funcionalidades, horas e custos por sistema</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dev/deploy-guide">
            <Button variant="outline" size="sm">Guia de Deploy</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="mr-2 h-4 w-4" />Exportar PDF
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />Adicionar
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma funcionalidade registrada. Clique em "Adicionar" para começar.
          </CardContent>
        </Card>
      ) : (
        <>
          {grouped.map((group) => {
            const totalH = group.items.reduce((s, i) => s + i.hours, 0);
            const totalC = group.items.reduce((s, i) => s + i.cost, 0);
            return (
              <Card key={group.value} className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{group.label}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionalidade</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right w-24">Horas</TableHead>
                        <TableHead className="text-right w-32">Valor</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.feature_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{item.description}</TableCell>
                          <TableCell className="text-right">{item.hours.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">Subtotal — {group.label}</TableCell>
                        <TableCell className="text-right font-semibold">{totalH.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(totalC)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">TOTAL GERAL</span>
              <div className="flex gap-8 text-lg font-bold">
                <span>{grandTotalHours.toFixed(1)} horas</span>
                <span>{formatCurrency(grandTotalCost)}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFeature ? "Editar Funcionalidade" : "Nova Funcionalidade"}</DialogTitle>
            <DialogDescription>Preencha os dados da funcionalidade desenvolvida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sistema</label>
              <Select value={form.system_name} onValueChange={(v) => setForm({ ...form, system_name: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o sistema" /></SelectTrigger>
                <SelectContent>
                  {SYSTEMS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Funcionalidade</label>
              <Input value={form.feature_name} onChange={(e) => setForm({ ...form, feature_name: e.target.value })} placeholder="Ex: Gerador de escalas automático" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descrição do que foi desenvolvido" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Horas</label>
                <Input type="number" step="0.5" min="0" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Valor (R$)</label>
                <Input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingFeature ? "Atualizar" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DevTracker;
