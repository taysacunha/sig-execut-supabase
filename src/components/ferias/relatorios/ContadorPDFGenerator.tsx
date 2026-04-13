import { useState } from "react";
import { getYearOptions } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, FileCheck, Calendar, Users } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function ContadorPDFGenerator() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedSetor, setSelectedSetor] = useState<string>("_all_");
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("_all_");
  const [generating, setGenerating] = useState(false);

  const years = getYearOptions(3, 3);

  const { data: setores } = useQuery({
    queryKey: ["ferias-setores-relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: ferias, isLoading } = useQuery({
    queryKey: ["ferias-contador", selectedYear, selectedSetor, selectedMonths, selectedPeriodo],
    queryFn: async () => {
      let query = supabase
        .from("ferias_ferias")
        .select(`
          *,
          colaborador:ferias_colaboradores(
            id, nome, cpf,
            setor:ferias_setores(id, nome),
            unidade:ferias_unidades(id, nome)
          )
        `)
        .gte("quinzena1_inicio", `${selectedYear}-01-01`)
        .lte("quinzena1_inicio", `${selectedYear}-12-31`)
        .order("quinzena1_inicio");

      const { data, error } = await query;
      if (error) throw error;

      let result = data || [];

      // Filtrar por setor
      if (selectedSetor !== "_all_") {
        result = result.filter((f) => f.colaborador?.setor?.id === selectedSetor);
      }

      // Filtrar por meses selecionados
      if (selectedMonths.length > 0) {
        result = result.filter((f) => {
          const q1Month = f.quinzena1_inicio ? new Date(f.quinzena1_inicio + "T00:00:00").getMonth() + 1 : null;
          const q2Month = f.quinzena2_inicio ? new Date(f.quinzena2_inicio + "T00:00:00").getMonth() + 1 : null;
          
          if (selectedPeriodo === "1") {
            return q1Month !== null && selectedMonths.includes(q1Month);
          } else if (selectedPeriodo === "2") {
            return q2Month !== null && selectedMonths.includes(q2Month);
          }
          return (q1Month !== null && selectedMonths.includes(q1Month)) || 
                 (q2Month !== null && selectedMonths.includes(q2Month));
        });
      }

      // Filtrar por período (quinzena)
      if (selectedPeriodo === "2") {
        result = result.filter((f) => f.quinzena2_inicio && f.quinzena2_fim);
      }

      // Ordenar por nome
      result.sort((a, b) => (a.colaborador?.nome || "").localeCompare(b.colaborador?.nome || ""));

      return result;
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  const calcularDiasContador = (inicio: string, fim: string, diasVendidos: number | null) => {
    const dias = differenceInDays(parseISO(fim), parseISO(inicio)) + 1;
    const vendidosContador = Math.min(diasVendidos || 0, 10);
    return dias - vendidosContador;
  };

  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => 
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a, b) => a - b)
    );
  };

  const generatePDF = async () => {
    if (!ferias || ferias.length === 0) {
      toast.error("Nenhum dado para gerar relatório");
      return;
    }

    setGenerating(true);

    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Relatório de Férias para Contador", pageWidth / 2, 20, { align: "center" });

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      const setorNome = selectedSetor === "_all_" ? "Todos os Setores" : setores?.find((s) => s.id === selectedSetor)?.nome || "";
      const mesesLabel = selectedMonths.length === 0 ? "Todos" : selectedMonths.map(m => MONTHS[m - 1]).join(", ");
      const periodoLabel = selectedPeriodo === "_all_" ? "Ambos" : selectedPeriodo === "1" ? "1ª Quinzena" : "2ª Quinzena";
      pdf.text(`Ano: ${selectedYear} | Setor: ${setorNome}`, pageWidth / 2, 28, { align: "center" });
      pdf.text(`Meses: ${mesesLabel} | Período: ${periodoLabel}`, pageWidth / 2, 34, { align: "center" });
      pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 40, { align: "center" });

      // Table header
      const startY = 50;
      const colWidths = [50, 35, 28, 28, 28, 28, 25, 25, 25];
      const headers = ["Colaborador", "CPF", "1ª Quinz. Início", "1ª Quinz. Fim", "2ª Quinz. Início", "2ª Quinz. Fim", "Dias Vend.", "Dias Gozo", "Status"];

      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, startY, pageWidth - margin * 2, 10, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      let xPos = margin + 2;
      headers.forEach((header, i) => {
        pdf.text(header, xPos, startY + 7);
        xPos += colWidths[i];
      });

      // Table rows
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      let yPos = startY + 15;

      ferias.forEach((f, index) => {
        if (yPos > pageHeight - 25) {
          pdf.addPage();
          yPos = 25;
        }

        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, yPos - 5, pageWidth - margin * 2, 8, "F");
        }

        xPos = margin + 2;
        const diasVendidosContador = Math.min(f.dias_vendidos || 0, 10);
        const diasGozo1 = calcularDiasContador(f.quinzena1_inicio, f.quinzena1_fim, f.quinzena_venda === 1 ? diasVendidosContador : 0);
        const diasGozo2 = f.quinzena2_inicio && f.quinzena2_fim ? calcularDiasContador(f.quinzena2_inicio, f.quinzena2_fim, f.quinzena_venda === 2 ? diasVendidosContador : 0) : 0;

        const rowData = [
          (f.colaborador?.nome || "N/A").substring(0, 28),
          f.colaborador?.cpf || "-",
          formatDate(f.quinzena1_inicio),
          formatDate(f.quinzena1_fim),
          f.quinzena2_inicio ? formatDate(f.quinzena2_inicio) : "-",
          f.quinzena2_fim ? formatDate(f.quinzena2_fim) : "-",
          diasVendidosContador.toString(),
          `${diasGozo1 + diasGozo2}`,
          f.status === "aprovada" ? "Aprovada" : f.status === "pendente" ? "Pendente" : f.status || "-",
        ];

        rowData.forEach((text, i) => {
          pdf.text(text, xPos, yPos);
          xPos += colWidths[i];
        });

        yPos += 8;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Total de registros: ${ferias.length}`, margin, pageHeight - 10);
      pdf.text("* Dias vendidos limitados a 10 para fins contábeis", pageWidth - margin, pageHeight - 10, { align: "right" });

      pdf.save(`relatorio-contador-${selectedYear}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Relatório para Contador
          </CardTitle>
          <CardDescription>
            Gera relatório oficial com períodos de férias para envio ao contador. 
            Os dias vendidos são limitados a 10 conforme legislação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todos os Setores</SelectItem>
                  {setores?.map((setor) => (
                    <SelectItem key={setor.id} value={setor.id}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Ambos</SelectItem>
                  <SelectItem value="1">1ª Quinzena</SelectItem>
                  <SelectItem value="2">2ª Quinzena</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={generatePDF} disabled={generating || isLoading || !ferias?.length}>
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Gerar PDF
              </Button>
            </div>
          </div>

          {/* Month filter */}
          <div className="space-y-2">
            <Label>Meses {selectedMonths.length > 0 && <span className="text-muted-foreground text-xs">({selectedMonths.length} selecionados)</span>}</Label>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((month, idx) => (
                <div key={idx} className="flex items-center space-x-1">
                  <Checkbox
                    id={`month-${idx}`}
                    checked={selectedMonths.includes(idx + 1)}
                    onCheckedChange={() => toggleMonth(idx + 1)}
                  />
                  <label htmlFor={`month-${idx}`} className="text-sm cursor-pointer">
                    {month.substring(0, 3)}
                  </label>
                </div>
              ))}
              {selectedMonths.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedMonths([])}>
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Preview dos Dados
            {ferias && (
              <Badge variant="secondary" className="ml-2">
                {ferias.length} registros
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !ferias?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhuma férias encontrada para os filtros selecionados</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>1ª Quinzena</TableHead>
                    <TableHead>2ª Quinzena</TableHead>
                    <TableHead className="text-center">Dias Vendidos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ferias.slice(0, 20).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.colaborador?.nome || "N/A"}</TableCell>
                      <TableCell className="text-muted-foreground">{f.colaborador?.cpf || "-"}</TableCell>
                      <TableCell>
                        {formatDate(f.quinzena1_inicio)} - {formatDate(f.quinzena1_fim)}
                      </TableCell>
                      <TableCell>
                        {f.quinzena2_inicio ? `${formatDate(f.quinzena2_inicio)} - ${formatDate(f.quinzena2_fim)}` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={f.dias_vendidos && f.dias_vendidos > 10 ? "destructive" : "secondary"}>
                          {Math.min(f.dias_vendidos || 0, 10)}
                          {f.dias_vendidos && f.dias_vendidos > 10 && "*"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.status === "aprovada" ? "default" : "outline"}>
                          {f.status === "aprovada" ? "Aprovada" : f.status === "pendente" ? "Pendente" : f.status || "-"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {ferias.length > 20 && (
                <div className="p-2 text-center text-sm text-muted-foreground border-t">
                  Mostrando 20 de {ferias.length} registros. O PDF conterá todos.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
