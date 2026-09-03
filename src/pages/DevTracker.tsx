import { useEffect, useMemo, useState } from "react";
import { useIsDevOwner } from "@/hooks/useIsDevOwner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileDown, DollarSign, ShieldAlert, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DevHistoryTab } from "@/components/dev/DevHistoryTab";
import { useDevTrackerLog, type DevLogEntry } from "@/hooks/useDevTrackerLog";

const SYSTEMS = [
  { value: "infraestrutura", label: "Login / Infraestrutura" },
  { value: "escalas", label: "Sistema de Escalas (Plantões)" },
  { value: "vendas", label: "Sistema de Vendas" },
  { value: "ferias", label: "Sistema de Férias / Folgas" },
  { value: "estoque", label: "Sistema de Estoque" },
  { value: "despesas", label: "Sistema de Gestão de Despesas" },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const systemLabel = (value: string) =>
  SYSTEMS.find((system) => system.value === value)?.label || value;

interface EntriesTableProps {
  items: DevLogEntry[];
  hourlyRate: number;
  label?: string;
}

function EntriesTable({ items, hourlyRate, label }: EntriesTableProps) {
  const showValue = hourlyRate > 0;
  const totalHours = items.reduce((sum, item) => sum + Number(item.hours || 0), 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Funcionalidade / ação</TableHead>
          <TableHead className="w-28">Data</TableHead>
          <TableHead className="text-right w-24">Horas</TableHead>
          {showValue && <TableHead className="text-right w-32">Valor</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <div className="font-medium">{item.title}</div>
              {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {item.occurred_on.split("-").reverse().join("/")}
            </TableCell>
            <TableCell className="text-right">{Number(item.hours).toFixed(1)}</TableCell>
            {showValue && (
              <TableCell className="text-right">{formatCurrency(Number(item.hours) * hourlyRate)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2} className="font-semibold">Subtotal{label ? ` — ${label}` : ""}</TableCell>
          <TableCell className="text-right font-semibold">{totalHours.toFixed(1)}</TableCell>
          {showValue && <TableCell className="text-right font-semibold">{formatCurrency(totalHours * hourlyRate)}</TableCell>}
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export default function DevTracker() {
  const { isDevOwner, loading: roleLoading, email } = useIsDevOwner();
  const { entries, isLoading, error } = useDevTrackerLog(isDevOwner);
  const [activeTab, setActiveTab] = useState("todos");
  const [hourlyRate, setHourlyRate] = useState(() => {
    const saved = localStorage.getItem("dev_tracker_hourly_rate");
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem("dev_tracker_hourly_rate", String(hourlyRate));
  }, [hourlyRate]);

  const grouped = useMemo(() => SYSTEMS.map((system) => ({
    ...system,
    items: entries.filter((entry) => entry.system_name === system.value),
  })).filter((group) => group.items.length > 0), [entries]);

  const invalidEntries = useMemo(() => entries.filter((entry) =>
    !SYSTEMS.some((system) => system.value === entry.system_name)
    || !entry.occurred_on
    || !Number.isFinite(Number(entry.hours))
    || Number(entry.hours) < 0
  ), [entries]);

  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const showValue = hourlyRate > 0;

  const handleExportPDF = async () => {
    if (invalidEntries.length > 0) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const hoursX = showValue ? 235 : 275;
    let y = 32;

    doc.setFontSize(16);
    doc.text("Registro de Desenvolvimento - SIG Execut", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}${showValue ? ` | Valor/hora: ${formatCurrency(hourlyRate)}` : ""}`, pageWidth / 2, 22, { align: "center" });

    for (const group of grouped) {
      if (y > pageHeight - 40) { doc.addPage(); y = 15; }
      const subtotal = group.items.reduce((sum, item) => sum + Number(item.hours || 0), 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(group.label, 14, y);
      y += 7;
      doc.setFontSize(8);
      doc.text("Funcionalidade / ação", 14, y);
      doc.text("Descrição", 85, y);
      doc.text("Horas", hoursX, y, { align: "right" });
      if (showValue) doc.text("Valor (R$)", 280, y, { align: "right" });
      y += 5;
      doc.setFont("helvetica", "normal");

      for (const item of group.items) {
        if (y > pageHeight - 20) { doc.addPage(); y = 15; }
        doc.text(item.title.substring(0, 38), 14, y);
        doc.text((item.description || "").substring(0, showValue ? 65 : 85), 85, y);
        doc.text(Number(item.hours).toFixed(1), hoursX, y, { align: "right" });
        if (showValue) doc.text((Number(item.hours) * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 280, y, { align: "right" });
        y += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.text(`Subtotal ${group.label}:`, 14, y);
      doc.text(subtotal.toFixed(1), hoursX, y, { align: "right" });
      if (showValue) doc.text((subtotal * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 }), 280, y, { align: "right" });
      y += 10;
    }

    if (y > pageHeight - 20) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL GERAL:", 14, y);
    doc.text(`${totalHours.toFixed(1)} horas`, hoursX, y, { align: "right" });
    if (showValue) doc.text(`R$ ${(totalHours * hourlyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 280, y, { align: "right" });
    doc.save("registro-desenvolvimento-sig-execut.pdf");
  };

  if (roleLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!isDevOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm"><CardContent className="py-12 text-center space-y-4">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <p className="text-lg font-semibold">Acesso Restrito</p>
          <p className="text-sm text-muted-foreground">Esta página é de uso exclusivo do responsável pelo desenvolvimento.</p>
          <p className="text-xs text-muted-foreground">Usuário atual: <span className="font-medium">{email || "não identificado"}</span></p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Registro de Desenvolvimento</h1>
          <p className="text-muted-foreground text-sm">Uma base única, organizada por sistema ou cronologicamente</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-1.5">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">R$/hora:</span>
            <Input type="number" step="0.01" min="0" className="h-8 w-24 text-right" value={hourlyRate || ""} onChange={(event) => setHourlyRate(parseFloat(event.target.value) || 0)} placeholder="0,00" />
          </div>
          <Link to="/dev/deploy-guide"><Button variant="outline" size="sm">Guia de Deploy</Button></Link>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={entries.length === 0 || invalidEntries.length > 0}>
            <FileDown className="mr-2 h-4 w-4" />PDF por sistema
          </Button>
        </div>
      </div>

      {invalidEntries.length > 0 && (
        <Card className="border-destructive mb-4"><CardContent className="py-4 text-sm text-destructive">
          Há {invalidEntries.length} lançamento(s) inválido(s). Corrija sistema, data ou horas na aba Histórico antes de emitir o relatório.
        </CardContent></Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /><span className="text-muted-foreground">Carregando...</span></div>
      ) : error ? (
        <Card><CardContent className="py-12 text-center text-destructive">Erro ao carregar o histórico: {error.message}</CardContent></Card>
      ) : (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1 mb-4">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              {grouped.map((group) => <TabsTrigger key={group.value} value={group.value}>{group.label} ({group.items.length})</TabsTrigger>)}
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="historico"><DevHistoryTab systems={SYSTEMS} hourlyRate={hourlyRate} entries={entries} /></TabsContent>
            <TabsContent value="todos">
              {entries.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum lançamento registrado no histórico.</CardContent></Card>
              ) : (
                <Accordion type="multiple" defaultValue={grouped.map((group) => group.value)}>
                  {grouped.map((group) => {
                    const subtotal = group.items.reduce((sum, item) => sum + Number(item.hours || 0), 0);
                    return (
                      <AccordionItem key={group.value} value={group.value}>
                        <AccordionTrigger className="text-base font-semibold">
                          <div className="flex items-center gap-3"><span>{group.label}</span><span className="text-xs font-normal text-muted-foreground">{group.items.length} lançamentos · {subtotal.toFixed(1)}h{showValue ? ` · ${formatCurrency(subtotal * hourlyRate)}` : ""}</span></div>
                        </AccordionTrigger>
                        <AccordionContent className="p-0"><EntriesTable items={group.items} hourlyRate={hourlyRate} label={group.label} /></AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </TabsContent>

            {grouped.map((group) => (
              <TabsContent key={group.value} value={group.value}>
                <Card><CardContent className="p-0"><EntriesTable items={group.items} hourlyRate={hourlyRate} label={group.label} /></CardContent></Card>
              </TabsContent>
            ))}
          </Tabs>

          <Card className="border-primary/30 bg-primary/5 mt-6"><CardContent className="py-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span className="text-lg font-bold">TOTAL GERAL DO HISTÓRICO</span>
            <div className="flex gap-8 text-lg font-bold"><span>{totalHours.toFixed(1)} horas</span>{showValue && <span>{formatCurrency(totalHours * hourlyRate)}</span>}</div>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
