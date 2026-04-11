import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileDown, Eye, DollarSign, ShieldAlert, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

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

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// --- Sub-components ---

interface FeatureTableProps {
  items: DevFeature[];
  hourlyRate: number;
  onView: (f: DevFeature) => void;
  onEdit: (f: DevFeature) => void;
  onDelete: (id: string) => void;
  systemLabel?: string;
}

const FeatureTable = ({ items, hourlyRate, onView, onEdit, onDelete, systemLabel }: FeatureTableProps) => {
  const totalH = items.reduce((s, i) => s + i.hours, 0);
  const totalC = totalH * hourlyRate;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Funcionalidade</TableHead>
          <TableHead className="text-right w-24">Horas</TableHead>
          <TableHead className="text-right w-32">Valor</TableHead>
          <TableHead className="w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.feature_name}</TableCell>
            <TableCell className="text-right">{item.hours.toFixed(1)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.hours * hourlyRate)}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(item)} title="Visualizar">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)} title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(item.id)} title="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Subtotal{systemLabel ? ` — ${systemLabel}` : ""}</TableCell>
          <TableCell className="text-right font-semibold">{totalH.toFixed(1)}</TableCell>
          <TableCell className="text-right font-semibold">{formatCurrency(totalC)}</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
};

const DevTracker = () => {
  const { role, loading: roleLoading, isAdmin } = useUserRole();
  const [features, setFeatures] = useState<DevFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<DevFeature | null>(null);
  const [viewingFeature, setViewingFeature] = useState<DevFeature | null>(null);
  const [form, setForm] = useState({ system_name: "", feature_name: "", description: "", hours: "" });
  const [hourlyRate, setHourlyRate] = useState(() => {
    const saved = localStorage.getItem("dev_tracker_hourly_rate");
    return saved ? parseFloat(saved) : 0;
  });
  const [activeTab, setActiveTab] = useState("todos");

  useEffect(() => {
    localStorage.setItem("dev_tracker_hourly_rate", String(hourlyRate));
  }, [hourlyRate]);

  // Auto-load when role is resolved and user has access
  useEffect(() => {
    if (!roleLoading && isAdmin) {
      loadFeatures();
    }
  }, [roleLoading, isAdmin]);

  const loadFeatures = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("dev_tracker" as any)
      .select("*")
      .order("system_name")
      .order("display_order");
    if (error) {
      console.error("DevTracker load error:", error);
      if (error.code === "42501" || error.message?.includes("permission") || error.message?.includes("RLS")) {
        setLoadError("Sem permissão para acessar os registros. Verifique se sua role é admin ou super_admin.");
      } else {
        setLoadError(`Erro ao carregar dados: ${error.message}`);
      }
      setFeatures([]);
    } else {
      setFeatures((data as any) || []);
    }
    setLoading(false);
  };

  const openAdd = () => {
    setEditingFeature(null);
    setForm({ system_name: "", feature_name: "", description: "", hours: "" });
    setDialogOpen(true);
  };

  const openEdit = (f: DevFeature) => {
    setEditingFeature(f);
    setForm({
      system_name: f.system_name,
      feature_name: f.feature_name,
      description: f.description || "",
      hours: String(f.hours),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.system_name || !form.feature_name) {
      toast({ title: "Preencha sistema e funcionalidade", variant: "destructive" });
      return;
    }
    const hours = parseFloat(form.hours) || 0;
    const payload = {
      system_name: form.system_name,
      feature_name: form.feature_name,
      description: form.description || null,
      hours,
      cost: hours * hourlyRate,
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
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} | Valor/hora: ${formatCurrency(hourlyRate)}`, pageWidth / 2, 22, { align: "center" });

    let y = 32;
    let grandTotalHours = 0;

    for (const sys of SYSTEMS) {
      const items = features.filter((f) => f.system_name === sys.value);
      if (items.length === 0) continue;

      const totalHours = items.reduce((s, i) => s + i.hours, 0);
      grandTotalHours += totalHours;

      if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }

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
        if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 15; }
        doc.text(item.feature_name.substring(0, 35), 14, y);
        doc.text((item.description || "").substring(0, 55), 80, y);
        doc.text(item.hours.toFixed(1), 200, y, { align: "right" });
        doc.text((item.hours * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 270, y, { align: "right" });
        y += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.text(`Subtotal ${sys.label}:`, 14, y);
      doc.text(totalHours.toFixed(1), 200, y, { align: "right" });
      doc.text((totalHours * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 270, y, { align: "right" });
      y += 10;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL GERAL:", 14, y);
    doc.text(`${grandTotalHours.toFixed(1)} horas`, 200, y, { align: "right" });
    doc.text(`R$ ${(grandTotalHours * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 270, y, { align: "right" });

    doc.save("registro-desenvolvimento-sig-execut.pdf");
  };

  // --- Loading role ---
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- Access denied ---
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-lg font-semibold text-foreground">Acesso Restrito</p>
            <p className="text-sm text-muted-foreground">
              Esta página é acessível apenas para administradores (admin / super_admin).
            </p>
            <p className="text-xs text-muted-foreground">
              Sua role atual: <span className="font-medium">{role || "nenhuma"}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Data ---
  const grouped = SYSTEMS.map((sys) => ({
    ...sys,
    items: features.filter((f) => f.system_name === sys.value),
  })).filter((g) => g.items.length > 0);

  const grandTotalHours = features.reduce((s, f) => s + f.hours, 0);
  const grandTotalCost = grandTotalHours * hourlyRate;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Desenvolvimento</h1>
          <p className="text-muted-foreground text-sm">Funcionalidades, horas e custos por sistema</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-1.5">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">R$/hora:</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="h-8 w-24 text-right"
              value={hourlyRate || ""}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              placeholder="0,00"
            />
          </div>
          <Link to="/dev/deploy-guide">
            <Button variant="outline" size="sm">Guia de Deploy</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="mr-2 h-4 w-4" />PDF
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />Adicionar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
            <p className="text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadFeatures}>Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : features.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma funcionalidade registrada. Clique em "Adicionar" para começar.
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1 mb-4">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              {SYSTEMS.map((s) => {
                const count = features.filter((f) => f.system_name === s.value).length;
                if (count === 0) return null;
                return (
                  <TabsTrigger key={s.value} value={s.value}>
                    {s.label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Tab: Todos - Accordion */}
            <TabsContent value="todos">
              <Accordion type="multiple" defaultValue={grouped.map((g) => g.value)}>
                {grouped.map((group) => (
                  <AccordionItem key={group.value} value={group.value}>
                    <AccordionTrigger className="text-base font-semibold">
                      <div className="flex items-center gap-3">
                        <span>{group.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {group.items.length} itens · {group.items.reduce((s, i) => s + i.hours, 0).toFixed(1)}h · {formatCurrency(group.items.reduce((s, i) => s + i.hours, 0) * hourlyRate)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <FeatureTable
                        items={group.items}
                        hourlyRate={hourlyRate}
                        onView={setViewingFeature}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        systemLabel={group.label}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            {/* Tabs individuais */}
            {SYSTEMS.map((sys) => {
              const items = features.filter((f) => f.system_name === sys.value);
              if (items.length === 0) return null;
              return (
                <TabsContent key={sys.value} value={sys.value}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{sys.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <FeatureTable
                        items={items}
                        hourlyRate={hourlyRate}
                        onView={setViewingFeature}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        systemLabel={sys.label}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Total geral */}
          <Card className="border-primary/30 bg-primary/5 mt-6">
            <CardContent className="py-4 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span className="text-lg font-bold text-foreground">TOTAL GERAL</span>
              <div className="flex gap-8 text-lg font-bold">
                <span>{grandTotalHours.toFixed(1)} horas</span>
                <span>{formatCurrency(grandTotalCost)}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog: Visualizar */}
      <Dialog open={!!viewingFeature} onOpenChange={(open) => !open && setViewingFeature(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Funcionalidade</DialogTitle>
            <DialogDescription>Informações completas do item registrado.</DialogDescription>
          </DialogHeader>
          {viewingFeature && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sistema</p>
                <p className="font-medium">{SYSTEMS.find((s) => s.value === viewingFeature.system_name)?.label}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Funcionalidade</p>
                <p className="font-medium">{viewingFeature.feature_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                <p className="text-sm whitespace-pre-wrap">{viewingFeature.description || "Sem descrição"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Horas</p>
                  <p className="text-lg font-bold">{viewingFeature.hours.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Valor Calculado</p>
                  <p className="text-lg font-bold">{formatCurrency(viewingFeature.hours * hourlyRate)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingFeature(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add/Edit */}
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
            <div>
              <label className="text-sm font-medium">Horas</label>
              <Input type="number" step="0.5" min="0" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              {hourlyRate > 0 && form.hours && (
                <p className="text-xs text-muted-foreground mt-1">
                  Valor estimado: {formatCurrency((parseFloat(form.hours) || 0) * hourlyRate)}
                </p>
              )}
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
